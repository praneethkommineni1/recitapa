import { aiConfigured } from "@/lib/assistant/claude";
import { getDb } from "@/lib/db";
import { handler, HttpError, idParam, json, readJson, requireUser } from "@/lib/http";
import { FREE_AI_SESSIONS_PER_MONTH, isPlus, planInfo } from "@/lib/plan";

/**
 * Start a cook-mode session. Free users get a few AI sessions a month; after that
 * (or when no API key is configured) the session runs in basic mode.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const recipeId = idParam(String((await readJson(req)).recipeId));
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM recipes WHERE id = ?").get(recipeId)) throw new HttpError(404, "Recipe not found.");

  const plan = planInfo(user.id);
  let reason: "limit" | "unavailable" | null = null;
  if (!aiConfigured()) reason = "unavailable";
  else if (!isPlus(user.id) && plan.aiSessionsUsed >= FREE_AI_SESSIONS_PER_MONTH) reason = "limit";
  const ai = reason === null;

  const { lastInsertRowid } = db
    .prepare("INSERT INTO cook_sessions (user_id, recipe_id, ai) VALUES (?, ?, ?)")
    .run(user.id, recipeId, ai ? 1 : 0);
  return json({ sessionId: Number(lastInsertRowid), ai, reason, plan: planInfo(user.id) }, 201);
});
