import { chefFor } from "@/lib/assistant/chef";
import { track } from "@/lib/analytics";
import { budgetStatus } from "@/lib/budget";
import { getDb } from "@/lib/db";
import { handler, HttpError, idParam, json, readJson, requireUser } from "@/lib/http";
import { AI_SESSIONS_PER_USER_PER_DAY, type AiOffReason, aiSessionsThisMonth, aiSessionsToday, FREE_AI_SESSIONS_PER_MONTH, isPlus, planInfo } from "@/lib/plan";

/**
 * Start a cook-mode session. The session runs with the AI chef unless no model is configured,
 * this month's AI budget is spent, the cook hit the daily session limit, or (when free users are
 * metered) they used their free sessions. Otherwise it runs in basic mode.
 */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const recipeId = idParam(String((await readJson(req)).recipeId));
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM recipes WHERE id = ?").get(recipeId)) throw new HttpError(404, "Recipe not found.");

  // Check and insert in one transaction so two taps at once can't both slip under a limit.
  const { sessionId, reason } = db.transaction(() => {
    let reason: AiOffReason | null = null;
    if (!chefFor().configured()) reason = "unavailable";
    else if (budgetStatus().exhausted) reason = "budget";
    else if (aiSessionsToday(user.id) >= AI_SESSIONS_PER_USER_PER_DAY) reason = "daily";
    else if (FREE_AI_SESSIONS_PER_MONTH !== null && !isPlus(user.id) && aiSessionsThisMonth(user.id) >= FREE_AI_SESSIONS_PER_MONTH)
      reason = "limit";
    const { lastInsertRowid } = db
      .prepare("INSERT INTO cook_sessions (user_id, recipe_id, ai) VALUES (?, ?, ?)")
      .run(user.id, recipeId, reason === null ? 1 : 0);
    return { sessionId: Number(lastInsertRowid), reason };
  })();

  const ai = reason === null;
  track(user.id, "cook_started", { recipeId, ai, reason });
  return json({ sessionId, ai, reason, plan: planInfo(user.id) }, 201);
});
