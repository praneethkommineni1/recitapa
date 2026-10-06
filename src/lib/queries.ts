import { getDb } from "./db";
import { computeStreak } from "./streak";
import type { Dinner, RecipeCard, RecipeDetail, Step, StoryGroup, StreakInfo, UserSummary } from "./types";

type Row = Record<string, unknown>;

const userFrom = (r: Row, prefix = "u_"): UserSummary => ({
  id: r[`${prefix}id`] as number,
  username: r[`${prefix}username`] as string,
  displayName: r[`${prefix}display_name`] as string,
  avatarUrl: (r[`${prefix}avatar_url`] as string | null) ?? null,
});

const RECIPE_SELECT = `
  SELECT r.*, u.id AS u_id, u.username AS u_username, u.display_name AS u_display_name, u.avatar_url AS u_avatar_url,
    (SELECT COUNT(*) FROM likes l WHERE l.recipe_id = r.id) AS like_count,
    (SELECT COUNT(*) FROM comments c WHERE c.recipe_id = r.id) AS comment_count,
    (SELECT COUNT(*) FROM dinners d WHERE d.recipe_id = r.id) AS cooked_count,
    EXISTS (SELECT 1 FROM likes l WHERE l.recipe_id = r.id AND l.user_id = @viewer) AS liked,
    EXISTS (SELECT 1 FROM saves s WHERE s.recipe_id = r.id AND s.user_id = @viewer) AS saved
  FROM recipes r JOIN users u ON u.id = r.user_id`;

function toCard(r: Row): RecipeCard {
  return {
    id: r.id as number,
    title: r.title as string,
    description: r.description as string,
    photoUrl: (r.photo_url as string | null) ?? null,
    servings: (r.servings as number | null) ?? null,
    prepMinutes: (r.prep_minutes as number | null) ?? null,
    cookMinutes: (r.cook_minutes as number | null) ?? null,
    tags: JSON.parse(r.tags as string),
    createdAt: r.created_at as string,
    author: userFrom(r),
    likeCount: r.like_count as number,
    commentCount: r.comment_count as number,
    cookedCount: r.cooked_count as number,
    liked: Boolean(r.liked),
    saved: Boolean(r.saved),
  };
}

export function feed(viewer: number, scope: "following" | "all", limit = 50): RecipeCard[] {
  const where =
    scope === "following"
      ? "WHERE r.user_id = @viewer OR r.user_id IN (SELECT followee_id FROM follows WHERE follower_id = @viewer)"
      : "";
  const rows = getDb()
    .prepare(`${RECIPE_SELECT} ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT @limit`)
    .all({ viewer, limit }) as Row[];
  return rows.map(toCard);
}

export function recipesByUser(viewer: number, userId: number): RecipeCard[] {
  const rows = getDb()
    .prepare(`${RECIPE_SELECT} WHERE r.user_id = @userId ORDER BY r.created_at DESC, r.id DESC`)
    .all({ viewer, userId }) as Row[];
  return rows.map(toCard);
}

export function savedRecipes(viewer: number): RecipeCard[] {
  const rows = getDb()
    .prepare(
      `${RECIPE_SELECT} JOIN saves sv ON sv.recipe_id = r.id AND sv.user_id = @viewer ORDER BY sv.created_at DESC`,
    )
    .all({ viewer }) as Row[];
  return rows.map(toCard);
}

export function searchRecipes(viewer: number, q: string): RecipeCard[] {
  const rows = getDb()
    .prepare(
      `${RECIPE_SELECT} WHERE r.title LIKE @q OR r.description LIKE @q OR r.tags LIKE @q
       ORDER BY r.created_at DESC LIMIT 30`,
    )
    .all({ viewer, q: `%${q}%` }) as Row[];
  return rows.map(toCard);
}

export function recipeDetail(viewer: number, id: number): RecipeDetail | null {
  const db = getDb();
  const r = db.prepare(`${RECIPE_SELECT} WHERE r.id = @id`).get({ viewer, id }) as Row | undefined;
  if (!r) return null;
  const comments = (
    db
      .prepare(
        `SELECT c.id, c.body, c.created_at, u.id AS u_id, u.username AS u_username,
                u.display_name AS u_display_name, u.avatar_url AS u_avatar_url
         FROM comments c JOIN users u ON u.id = c.user_id WHERE c.recipe_id = ? ORDER BY c.created_at, c.id`,
      )
      .all(id) as Row[]
  ).map((c) => ({ id: c.id as number, body: c.body as string, createdAt: c.created_at as string, author: userFrom(c) }));
  return {
    ...toCard(r),
    ingredients: JSON.parse(r.ingredients as string) as string[],
    steps: JSON.parse(r.steps as string) as Step[],
    comments,
  };
}

const DINNER_SELECT = `
  SELECT d.*, rc.title AS recipe_title,
    u.id AS u_id, u.username AS u_username, u.display_name AS u_display_name, u.avatar_url AS u_avatar_url
  FROM dinners d JOIN users u ON u.id = d.user_id LEFT JOIN recipes rc ON rc.id = d.recipe_id`;

function toDinner(r: Row): Dinner {
  return {
    id: r.id as number,
    photoUrl: (r.photo_url as string | null) ?? null,
    caption: r.caption as string,
    localDate: r.local_date as string,
    createdAt: r.created_at as string,
    recipe: r.recipe_id ? { id: r.recipe_id as number, title: r.recipe_title as string } : null,
    author: userFrom(r),
  };
}

export function dinnersByUser(userId: number, limit = 120): Dinner[] {
  return (
    getDb()
      .prepare(`${DINNER_SELECT} WHERE d.user_id = ? ORDER BY d.local_date DESC, d.id DESC LIMIT ?`)
      .all(userId, limit) as Row[]
  ).map(toDinner);
}

/** Dinners posted in the last 24h by the viewer and the people they follow, grouped per person. */
export function storyGroups(viewer: number): StoryGroup[] {
  const db = getDb();
  const rows = db
    .prepare(
      `${DINNER_SELECT}
       WHERE d.created_at >= datetime('now', '-1 day')
         AND (d.user_id = @viewer OR d.user_id IN (SELECT followee_id FROM follows WHERE follower_id = @viewer))
       ORDER BY d.created_at ASC, d.id ASC`,
    )
    .all({ viewer }) as Row[];
  const seen = new Set(
    (
      db
        .prepare(
          `SELECT dinner_id FROM story_views WHERE user_id = ? AND dinner_id IN (
             SELECT id FROM dinners WHERE created_at >= datetime('now', '-1 day'))`,
        )
        .all(viewer) as { dinner_id: number }[]
    ).map((v) => v.dinner_id),
  );

  const groups = new Map<number, StoryGroup>();
  for (const row of rows) {
    const dinner = toDinner(row);
    let g = groups.get(dinner.author.id);
    if (!g) {
      g = { user: dinner.author, stories: [], allSeen: true };
      groups.set(dinner.author.id, g);
    }
    g.stories.push(dinner);
    if (!seen.has(dinner.id) && dinner.author.id !== viewer) g.allSeen = false;
  }
  // Own story first, then unseen, then seen.
  return [...groups.values()].sort((a, b) => {
    if (a.user.id === viewer) return -1;
    if (b.user.id === viewer) return 1;
    return Number(a.allSeen) - Number(b.allSeen);
  });
}

export function streakFor(userId: number, today: string): StreakInfo {
  const db = getDb();
  const dates = (db.prepare("SELECT DISTINCT local_date FROM dinners WHERE user_id = ?").all(userId) as { local_date: string }[]).map(
    (r) => r.local_date,
  );
  const frozen = (db.prepare("SELECT local_date FROM streak_freezes WHERE user_id = ?").all(userId) as { local_date: string }[]).map(
    (r) => r.local_date,
  );
  return computeStreak(dates, today, frozen);
}

export function findUser(username: string) {
  return getDb()
    .prepare("SELECT id, username, display_name, avatar_url, bio, created_at FROM users WHERE username = ?")
    .get(username) as
    | { id: number; username: string; display_name: string; avatar_url: string | null; bio: string; created_at: string }
    | undefined;
}
