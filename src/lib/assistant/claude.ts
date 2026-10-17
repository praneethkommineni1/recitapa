import Anthropic from "@anthropic-ai/sdk";
import { describeEvent, describeState } from "./context.ts";
import { TOOLS, toAction } from "./tools.ts";
import { ChefUnavailableError, type AssistantAction, type CallUsage, type ChefInput, type ChefProvider, type ChefReply } from "./types.ts";

export const DEFAULT_MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 4;

// Models that take server-side refusal fallbacks ("default" form). Others get neither the beta nor the parameter.
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

/** Per-model request options: Haiku 4.5 rejects `effort`, and only some models take refusal fallbacks. */
function modelOptions(model: string) {
  const options: { output_config?: { effort: "low" }; betas?: string[]; fallbacks?: "default" } = {};
  // Voice turns need to feel immediate; low effort keeps latency down.
  if (!model.startsWith("claude-haiku")) options.output_config = { effort: "low" };
  if (FALLBACK_MODELS.has(model)) Object.assign(options, { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  return options;
}

const SYSTEM = `You are the voice sous-chef inside Recitapa, a recipe app. The cook has their hands busy and hears everything you say through text-to-speech, so:
- Speak in short, natural sentences. Usually one to three. No markdown, lists, emoji or headings.
- Say numbers and times the way a person would ("about four minutes").
- Lead with the action the cook should take right now.

You guide them through the recipe in real time. Each message includes the live plan, how long they have been cooking, running timers, and an event: something the cook said, a timer going off, or a check-in because they have been on a step a long time.

Use the tools to drive the cook-mode screen: move between steps, start timers for anything timed, and keep the plan accurate.

When something goes wrong (burnt, over-salted, curdled, missing ingredient, wrong pan, spilled, running late), stay calm and practical:
1. Say whether it is salvageable and the quickest fix.
2. Log it with log_mishap.
3. If the rest of the recipe should change because of it, update the remaining steps with revise_step or insert_step, then tell the cook briefly what changed.
If it is a safety issue (grease fire, undercooked poultry, a cut or burn), put safety first: grease fire means cover with a lid and turn off the heat, never water.

If the cook asks something unrelated to cooking, answer very briefly and steer back to the food.`;

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

export async function claudeTurn(input: ChefInput, model: string = DEFAULT_MODEL): Promise<ChefReply> {
  const { recipe, event } = input;
  const state = structuredClone(input.state);

  const recipeContext = `Recipe: ${recipe.title}${recipe.servings ? ` (serves ${recipe.servings})` : ""}
Ingredients:
${recipe.ingredients.map((i) => `- ${i}`).join("\n")}${recipe.note ? `\n\n${recipe.note}` : ""}`;

  // Earlier exchanges are replayed as plain text; this request's tool loop below is append-only.
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const turn of input.history.slice(-16)) {
    const role = turn.role === "cook" ? "user" : "assistant";
    if (!messages.length && role === "assistant") continue;
    messages.push({ role, content: turn.text });
  }
  messages.push({ role: "user", content: `${describeState(state)}\n\n${describeEvent(event, state)}` });

  const actions: AssistantAction[] = [];
  const spoken: string[] = [];
  const usage: CallUsage[] = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await getClient().beta.messages.create({
      model,
      max_tokens: 4000,
      ...modelOptions(model),
      cache_control: { type: "ephemeral" },
      system: [
        { type: "text", text: SYSTEM },
        { type: "text", text: recipeContext },
      ],
      tools: round < MAX_TOOL_ROUNDS ? TOOLS : [],
      messages,
    });

    usage.push({
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    });

    if (response.stop_reason === "refusal") {
      return { speech: "Sorry, I can't help with that one. Let's get back to the recipe.", actions, mode: "ai", usage };
    }

    for (const block of response.content) if (block.type === "text" && block.text.trim()) spoken.push(block.text.trim());

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || !toolUses.length) break;

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((use) => {
      const result = toAction(use.name, use.input, state);
      if (typeof result === "string") return { type: "tool_result", tool_use_id: use.id, content: result, is_error: true };
      actions.push(result);
      return { type: "tool_result", tool_use_id: use.id, content: "done" };
    });
    messages.push({ role: "user", content: results });
  }

  return { speech: spoken.join(" ") || "Okay.", actions, mode: "ai", usage };
}

/** The sous-chef on a Claude model. API errors become ChefUnavailableError so cook mode keeps going. */
export function claudeChef(model: string = DEFAULT_MODEL): ChefProvider {
  return {
    name: "claude",
    model,
    configured: aiConfigured,
    async turn(input) {
      try {
        return await claudeTurn(input, model);
      } catch (err) {
        if (err instanceof Anthropic.APIError) throw new ChefUnavailableError(`Claude API error ${err.status ?? "(no connection)"}: ${err.message}`);
        throw err;
      }
    },
  };
}
