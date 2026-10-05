import Anthropic from "@anthropic-ai/sdk";
import { aiConfigured, claudeTurn } from "@/lib/assistant/claude";
import { offlineTurn } from "@/lib/assistant/offline";
import type { AssistantEvent, AssistantTurn, KitchenState } from "@/lib/assistant/types";
import { handler, HttpError, idParam, json, readJson, requireUser } from "@/lib/http";
import { recipeDetail } from "@/lib/queries";

function parseState(raw: unknown): KitchenState {
  const s = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const steps = Array.isArray(s.steps)
    ? s.steps.slice(0, 80).map((x) => {
        const step = (x ?? {}) as Record<string, unknown>;
        return {
          text: String(step.text ?? "").slice(0, 1000),
          minutes: typeof step.minutes === "number" && step.minutes > 0 ? Math.min(Math.round(step.minutes), 1440) : null,
        };
      })
    : [];
  if (!steps.length) throw new HttpError(400, "state.steps is required.");
  return {
    steps,
    currentStep: Math.min(Math.floor(num(s.currentStep)), steps.length - 1),
    elapsedSeconds: num(s.elapsedSeconds),
    secondsOnStep: num(s.secondsOnStep),
    timers: Array.isArray(s.timers)
      ? s.timers.slice(0, 10).map((t) => ({
          label: String((t as Record<string, unknown>)?.label ?? "").slice(0, 40),
          secondsLeft: num((t as Record<string, unknown>)?.secondsLeft),
        }))
      : [],
    mishaps: Array.isArray(s.mishaps) ? s.mishaps.slice(-20).map((m) => String(m).slice(0, 200)) : [],
  };
}

function parseEvent(raw: unknown): AssistantEvent {
  const e = (raw ?? {}) as Record<string, unknown>;
  switch (e.type) {
    case "start":
    case "check_in":
      return { type: e.type };
    case "timer_done":
      return { type: "timer_done", label: String(e.label ?? "timer").slice(0, 40) };
    case "utterance": {
      const text = String(e.text ?? "").trim().slice(0, 500);
      if (!text) throw new HttpError(400, "Empty message.");
      return { type: "utterance", text };
    }
    default:
      throw new HttpError(400, "Unknown event.");
  }
}

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const recipe = recipeDetail(user.id, idParam(String(body.recipeId)));
  if (!recipe) throw new HttpError(404, "Recipe not found.");
  const state = parseState(body.state);
  const event = parseEvent(body.event);
  const history: AssistantTurn[] = Array.isArray(body.history)
    ? body.history
        .filter((t): t is AssistantTurn => !!t && (t.role === "cook" || t.role === "chef") && typeof t.text === "string")
        .map((t) => ({ role: t.role, text: t.text.slice(0, 1000) }))
    : [];

  if (!aiConfigured()) return json(offlineTurn(state, event));
  try {
    return json(await claudeTurn({ recipe, state, history, event }));
  } catch (err) {
    // Keep the cook moving even if the API is unreachable or misconfigured.
    if (err instanceof Anthropic.APIError) {
      console.error(`Assistant API error ${err.status}: ${err.message}`);
      return json({ ...offlineTurn(state, event), notice: "The AI chef is unavailable right now, using basic mode." });
    }
    throw err;
  }
});
