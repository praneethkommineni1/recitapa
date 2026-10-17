import { getDb } from "./db";
import { rankReels, tagAffinity, type ReelCandidate } from "./reels";
import { computeStreak } from "./streak";
import type { Dinner, RecipeCard, RecipeDetail, Reel, Step, StoryGroup, StreakInfo, UserSummary } from "./types";

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
    (SELECT COUNT(*) FROM saves s WHERE s.recipe_id = r.id) AS save_count,
    -- Cover for recipes posted without a photo: the latest dinner photo from someone who cooked it.
    (SELECT d.photo_url FROM dinners d WHERE d.recipe_id = r.id AND d.photo_url IS NOT NULL ORDER BY d.created_at DESC, d.id DESC LIMIT 1) AS cook_photo_url,
    EXISTS (SELECT 1 FROM likes l WHERE l.recipe_id = r.id AND l.user_id = @viewer) AS liked,
    EXISTS (SELECT 1 FROM saves s WHERE s.recipe_id = r.id AND s.user_id = @viewer) AS saved
  FROM recipes r JOIN users u ON u.id = r.user_id`;

function toCard(r: Row): RecipeCard {
  return {
    id: r.id as number,
    title: r.title as string,
    description: r.description as string,
    photoUrl: (r.photo_url as string | null) ?? (r.cook_photo_url as string | null) ?? null,
    photoFromCook: !r.photo_url && Boolean(r.cook_photo_url),
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

/** Most recent recipes considered for the Reels feed. */
const REEL_POOL = 500;

/**
 * The next page of the Reels feed for a viewer: other cooks' recipes, ranked by rankReels.
 * `exclude` holds the ids already shown in this browsing session.
 */
export function reels(viewer: number, exclude: number[], limit = 8): Reel[] {
  const db = getDb();
  const skip = new Set(exclude);
  const rows = db
    .prepare(
      `SELECT r.id, r.user_id, r.created_at, r.tags, (r.photo_url IS NOT NULL OR EXISTS (SELECT 1 FROM dinners d WHERE d.recipe_id = r.id AND d.photo_url IS NOT NULL)) AS has_photo,
         (SELECT COUNT(*) FROM likes l WHERE l.recipe_id = r.id) AS likes,
         (SELECT COUNT(*) FROM saves s WHERE s.recipe_id = r.id) AS saves,
         (SELECT COUNT(*) FROM comments c WHERE c.recipe_id = r.id) AS comments,
         (SELECT COUNT(*) FROM dinners d WHERE d.recipe_id = r.id) AS cooked,
         (SELECT v.seen_at FROM reel_views v WHERE v.recipe_id = r.id AND v.user_id = @viewer) AS seen_at,
         EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = @viewer AND f.followee_id = r.user_id) AS follows_author
       FROM recipes r WHERE r.user_id != @viewer
       ORDER BY r.created_at DESC, r.id DESC LIMIT @pool`,
    )
    .all({ viewer, pool: REEL_POOL }) as Row[];
  const ms = (sqliteUtc: string) => Date.parse(`${sqliteUtc.replace(" ", "T")}Z`);
  const candidates: ReelCandidate[] = rows
    .filter((r) => !skip.has(r.id as number))
    .map((r) => ({
      id: r.id as number,
      authorId: r.user_id as number,
      createdAt: ms(r.created_at as string),
      likes: r.likes as number,
      saves: r.saves as number,
      comments: r.comments as number,
      cooked: r.cooked as number,
      tags: JSON.parse(r.tags as string),
      hasPhoto: Boolean(r.has_photo),
      seenAt: r.seen_at ? ms(r.seen_at as string) : null,
      followsAuthor: Boolean(r.follows_author),
    }));

  // The viewer's taste: tags of other cooks' recipes they liked, saved or cooked.
  const signals = (
    db
      .prepare(
        `SELECT r.tags, 1 AS weight FROM likes l JOIN recipes r ON r.id = l.recipe_id WHERE l.user_id = @viewer AND r.user_id != @viewer
         UNION ALL
         SELECT r.tags, 2 FROM saves s JOIN recipes r ON r.id = s.recipe_id WHERE s.user_id = @viewer AND r.user_id != @viewer
         UNION ALL
         SELECT r.tags, 3 FROM dinners d JOIN recipes r ON r.id = d.recipe_id WHERE d.user_id = @viewer AND r.user_id != @viewer`,
      )
      .all({ viewer }) as { tags: string; weight: number }[]
  ).map((s) => ({ tags: JSON.parse(s.tags) as string[], weight: s.weight }));

  const ids = rankReels(candidates, tagAffinity(signals), Date.now(), limit);
  if (!ids.length) return [];
  const byId = new Map(
    (db.prepare(`${RECIPE_SELECT} WHERE r.id IN (SELECT value FROM json_each(@ids))`).all({ viewer, ids: JSON.stringify(ids) }) as Row[]).map(
      (r) => [r.id as number, r],
    ),
  );
  const followed = new Set(candidates.filter((c) => c.followsAuthor).map((c) => c.authorId));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    if (!r) return [];
    const card = toCard(r);
    return [
      {
        ...card,
        ingredients: JSON.parse(r.ingredients as string) as string[],
        stepCount: (JSON.parse(r.steps as string) as Step[]).length,
        following: followed.has(card.author.id),
      },
    ];
  });
}

/** Mark a recipe as watched in the Reels feed. */
export function markReelSeen(viewer: number, recipeId: number): void {
  getDb()
    .prepare(
      `INSERT INTO reel_views (user_id, recipe_id) SELECT ?, id FROM recipes WHERE id = ?
       ON CONFLICT (user_id, recipe_id) DO UPDATE SET seen_at = datetime('now')`,
    )
    .run(viewer, recipeId);
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

export interface RecipeFilters {
  /** Free text matched against title, description and tags. */
  q?: string;
  /** Exact tag. */
  tag?: string;
  /** Total prep + cook time at most this many minutes. */
  maxMinutes?: number;
}

export function searchRecipes(viewer: number, { q, tag, maxMinutes }: RecipeFilters): RecipeCard[] {
  const where: string[] = [];
  if (q) where.push("(r.title LIKE @q OR r.description LIKE @q OR r.tags LIKE @q)");
  if (tag) where.push("EXISTS (SELECT 1 FROM json_each(r.tags) t WHERE lower(t.value) = lower(@tag))");
  if (maxMinutes) where.push("COALESCE(r.prep_minutes, 0) + COALESCE(r.cook_minutes, 0) BETWEEN 1 AND @maxMinutes");
  if (!where.length) return [];
  const rows = getDb()
    .prepare(`${RECIPE_SELECT} WHERE ${where.join(" AND ")} ORDER BY r.created_at DESC, r.id DESC LIMIT 60`)
    .all({ viewer, q: `%${q ?? ""}%`, tag: tag ?? "", maxMinutes: maxMinutes ?? 0 }) as Row[];
  return rows.map(toCard);
}

export interface ExplorePage {
  forYou: RecipeCard[];
  quick: RecipeCard[];
  popular: RecipeCard[];
  fresh: RecipeCard[];
  tags: { tag: string; count: number; photoUrl: string | null }[];
  cooks: (UserSummary & { recipeCount: number })[];
}

/** A section on Explore shows at least this many recipes when there are enough, even if some repeat. */
const EXPLORE_MIN_ROW = 4;

/**
 * What Explore shows before the viewer searches. Sections prefer recipes no earlier section showed,
 * and only repeat one to reach EXPLORE_MIN_ROW (which happens while the catalog is small).
 */
export function explorePage(viewer: number): ExplorePage {
  const db = getDb();
  const used = new Set<number>();
  const take = (cards: RecipeCard[], n = 10) => {
    const unseen = cards.filter((c) => !used.has(c.id));
    const repeats = cards.filter((c) => used.has(c.id)).slice(0, Math.max(0, EXPLORE_MIN_ROW - unseen.length));
    const row = [...unseen, ...repeats].slice(0, n);
    row.forEach((c) => used.add(c.id));
    return row;
  };
  const others = (order: string, extra = "") =>
    (db.prepare(`${RECIPE_SELECT} WHERE r.user_id != @viewer ${extra} ORDER BY ${order} LIMIT 40`).all({ viewer }) as Row[]).map(toCard);

  const forYou = take(reels(viewer, [], 6), 6);
  const quick = take(
    others("cooked_count + like_count DESC, r.created_at DESC", "AND COALESCE(r.prep_minutes, 0) + COALESCE(r.cook_minutes, 0) BETWEEN 1 AND 30"),
  );
  const popular = take(others("3 * cooked_count + 2 * save_count + like_count DESC, r.created_at DESC"));
  const fresh = take(others("r.created_at DESC, r.id DESC"));

  // Most used tags, each with a photo from one of its recipes.
  const tagRows = (
    db
      .prepare(
        `SELECT lower(t.value) AS tag, COUNT(*) AS n,
           MAX(COALESCE(r.photo_url, (SELECT d.photo_url FROM dinners d WHERE d.recipe_id = r.id AND d.photo_url IS NOT NULL LIMIT 1))) AS photo
         FROM recipes r, json_each(r.tags) t GROUP BY lower(t.value) ORDER BY n DESC, tag LIMIT 12`,
      )
      .all() as { tag: string; n: number; photo: string | null }[]
  ).map((t) => ({ tag: t.tag, count: t.n, photoUrl: t.photo }));

  const cooks = (
    db
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.avatar_url,
           (SELECT COUNT(*) FROM recipes r WHERE r.user_id = u.id) AS recipes,
           (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) AS followers
         FROM users u
         WHERE u.id != @viewer AND u.id NOT IN (SELECT followee_id FROM follows WHERE follower_id = @viewer)
           AND EXISTS (SELECT 1 FROM recipes r WHERE r.user_id = u.id)
         ORDER BY recipes + followers DESC, u.id LIMIT 10`,
      )
      .all({ viewer }) as Row[]
  ).map((u) => ({ ...userFrom(u, ""), recipeCount: u.recipes as number }));

  return { forYou, quick, popular, fresh, tags: tagRows, cooks };
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
  const cookPhotos = (
    db
      .prepare(
        `SELECT d.id, d.photo_url, u.id AS u_id, u.username AS u_username, u.display_name AS u_display_name, u.avatar_url AS u_avatar_url
         FROM dinners d JOIN users u ON u.id = d.user_id
         WHERE d.recipe_id = ? AND d.photo_url IS NOT NULL ORDER BY d.created_at DESC, d.id DESC LIMIT 12`,
      )
      .all(id) as Row[]
  ).map((d) => ({ id: d.id as number, photoUrl: d.photo_url as string, author: userFrom(d) }));
  return {
    ...toCard(r),
    ingredients: JSON.parse(r.ingredients as string) as string[],
    steps: JSON.parse(r.steps as string) as Step[],
    comments,
    cookPhotos,
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
