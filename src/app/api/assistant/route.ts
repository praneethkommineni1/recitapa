import Anthropic from "@anthropic-ai/sdk";
import { aiConfigured, claudeTurn } from "@/lib/assistant/claude";
import { offlineTurn } from "@/lib/assistant/offline";
import type { AssistantEvent, AssistantTurn, KitchenState } from "@/lib/assistant/types";
import { costMicroUsd } from "@/lib/assistant/pricing";
import { getDb } from "@/lib/db";
import { handler, HttpError, idParam, json, readJson, requireUser } from "@/lib/http";
import { MAX_TURNS_PER_SESSION } from "@/lib/plan";
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

  // The session decides whether this cook gets the AI chef (see /api/cook-sessions).
  const db = getDb();
  const session = db
    .prepare("SELECT id, ai, turns FROM cook_sessions WHERE id = ? AND user_id = ?")
    .get(idParam(String(body.sessionId)), user.id) as { id: number; ai: number; turns: number } | undefined;
  if (!session) throw new HttpError(404, "Cook session not found.");
  db.prepare("UPDATE cook_sessions SET turns = turns + 1 WHERE id = ?").run(session.id);

  const countMishaps = (actions: { type: string }[]) => {
    const mishaps = actions.filter((a) => a.type === "log_mishap").length;
    if (mishaps) db.prepare("UPDATE cook_sessions SET mishaps = mishaps + ? WHERE id = ?").run(mishaps, session.id);
  };

  if (!session.ai || !aiConfigured()) {
    const reply = offlineTurn(state, event);
    countMishaps(reply.actions);
    return json(reply);
  }
  if (session.turns >= MAX_TURNS_PER_SESSION)
    return json({ ...offlineTurn(state, event), notice: "This session hit its AI limit, so I've switched to basic mode." });
  try {
    const { usage, ...reply } = await claudeTurn({ recipe, state, history, event });
    const record = db.prepare(
      `INSERT INTO ai_usage (user_id, session_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_micro_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const u of usage)
      record.run(user.id, session.id, u.model, u.inputTokens, u.outputTokens, u.cacheReadTokens, u.cacheWriteTokens, costMicroUsd(u));
    countMishaps(reply.actions);
    return json(reply);
  } catch (err) {
    // Keep the cook moving even if the API is unreachable or misconfigured.
    if (err instanceof Anthropic.APIError) {
      console.error(`Assistant API error ${err.status}: ${err.message}`);
      return json({ ...offlineTurn(state, event), notice: "The AI chef is unavailable right now, using basic mode." });
    }
    throw err;
  }
});
