import { BADGES, dishKinds, evaluateBadges, type BadgeProgress, type BadgeStats, type DishKind } from "./badges";
import { getDb } from "./db";
import { streakFor } from "./queries";

/** Gather every metric the badge catalog uses for one user. */
export function badgeStats(userId: number): BadgeStats {
  const db = getDb();
  const n = (sql: string, ...params: unknown[]) => (db.prepare(sql).get(...params) as { n: number | null }).n ?? 0;

  const stats: BadgeStats = {
    dinners: n("SELECT COUNT(*) AS n FROM dinners WHERE user_id = ?", userId),
    photoDinners: n("SELECT COUNT(*) AS n FROM dinners WHERE user_id = ? AND photo_url IS NOT NULL", userId),
    // Server date plus a day, so a cook ahead of UTC still gets tonight counted.
    longestStreak: streakFor(userId, new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)).longest,
    freezesUsed: n("SELECT COUNT(*) AS n FROM streak_freezes WHERE user_id = ?", userId),
    recipesPosted: n("SELECT COUNT(*) AS n FROM recipes WHERE user_id = ?", userId),
    likesReceived: n(
      "SELECT COUNT(*) AS n FROM likes l JOIN recipes r ON r.id = l.recipe_id WHERE r.user_id = ? AND l.user_id != r.user_id",
      userId,
    ),
    commentsWritten: n("SELECT COUNT(*) AS n FROM comments WHERE user_id = ?", userId),
    following: n("SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?", userId),
    followers: n("SELECT COUNT(*) AS n FROM follows WHERE followee_id = ?", userId),
    othersRecipesCooked: n(
      "SELECT COUNT(DISTINCT d.recipe_id) AS n FROM dinners d JOIN recipes r ON r.id = d.recipe_id WHERE d.user_id = ? AND r.user_id != d.user_id",
      userId,
    ),
    yourRecipesCookedByOthers: n(
      "SELECT COUNT(*) AS n FROM dinners d JOIN recipes r ON r.id = d.recipe_id WHERE r.user_id = ? AND d.user_id != r.user_id",
      userId,
    ),
    aiSessions: n("SELECT COUNT(*) AS n FROM cook_sessions WHERE user_id = ? AND ai = 1 AND turns > 0", userId),
    mishapsRescued: n("SELECT SUM(mishaps) AS n FROM cook_sessions WHERE user_id = ?", userId),
  };

  // Specialty badges: classify each dinner by its caption and linked recipe.
  const dinners = db
    .prepare(
      `SELECT d.caption, COALESCE(r.title, '') AS title, COALESCE(r.tags, '') AS tags
       FROM dinners d LEFT JOIN recipes r ON r.id = d.recipe_id WHERE d.user_id = ?`,
    )
    .all(userId) as { caption: string; title: string; tags: string }[];
  for (const d of dinners) {
    for (const kind of dishKinds(`${d.caption} ${d.title} ${d.tags}`)) {
      const key = `dish:${kind}` as `dish:${DishKind}`;
      stats[key] = (stats[key] ?? 0) + 1;
    }
  }
  return stats;
}

export interface UserBadge extends BadgeProgress {
  earnedAt: string | null;
}

/** Award any newly earned badges and return the full catalog with progress. */
export function syncBadges(userId: number): UserBadge[] {
  const db = getDb();
  const progress = evaluateBadges(badgeStats(userId));
  const award = db.prepare("INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)");
  db.transaction(() => progress.filter((b) => b.earned).forEach((b) => award.run(userId, b.id)))();

  const earned = new Map(
    (db.prepare("SELECT badge_id, earned_at FROM user_badges WHERE user_id = ?").all(userId) as { badge_id: string; earned_at: string }[]).map(
      (r) => [r.badge_id, r.earned_at],
    ),
  );
  // Once earned, a badge stays earned even if the numbers later drop (e.g. a deleted recipe).
  return progress.map((b) => {
    const earnedAt = earned.get(b.id) ?? null;
    return { ...b, earned: earnedAt !== null, value: earnedAt ? b.target : b.value, earnedAt };
  });
}

/** Badges earned but not yet announced to the user; marks them as seen. */
export function takeUnseenBadges(userId: number) {
  const db = getDb();
  syncBadges(userId);
  const ids = (db.prepare("SELECT badge_id FROM user_badges WHERE user_id = ? AND seen = 0 ORDER BY earned_at").all(userId) as { badge_id: string }[]).map(
    (r) => r.badge_id,
  );
  if (ids.length) db.prepare("UPDATE user_badges SET seen = 1 WHERE user_id = ? AND seen = 0").run(userId);
  return ids.map((id) => BADGES.find((b) => b.id === id)).filter((b) => b !== undefined);
}
