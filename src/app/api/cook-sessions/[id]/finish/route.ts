import { track } from "@/lib/analytics";
import { getDb } from "@/lib/db";
import { handler, HttpError, idParam, json, requireUser } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Mark a cook session finished (the cook reached "Dinner is served"). */
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const id = idParam((await params).id);
  const db = getDb();
  const session = db
    .prepare(
      `SELECT id, recipe_id, ai, turns, mishaps, finished_at, CAST((julianday('now') - julianday(created_at)) * 1440 AS INTEGER) AS minutes
       FROM cook_sessions WHERE id = ? AND user_id = ?`,
    )
    .get(id, user.id) as
    | { id: number; recipe_id: number | null; ai: number; turns: number; mishaps: number; finished_at: string | null; minutes: number }
    | undefined;
  if (!session) throw new HttpError(404, "Cook session not found.");
  if (!session.finished_at) {
    db.prepare("UPDATE cook_sessions SET finished_at = datetime('now') WHERE id = ?").run(id);
    track(user.id, "cook_finished", {
      recipeId: session.recipe_id,
      ai: Boolean(session.ai),
      turns: session.turns,
      mishaps: session.mishaps,
      minutes: session.minutes,
    });
  }
  return json({ ok: true });
});
