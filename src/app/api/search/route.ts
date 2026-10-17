import { getDb } from "@/lib/db";
import { handler, json, requireUser } from "@/lib/http";
import { searchRecipes } from "@/lib/queries";

/** Search recipes and cooks. Filters: `q` (free text, or "#tag"), `tag` (exact) and `max` (total minutes). */
export const GET = handler(async (req: Request) => {
  const viewer = await requireUser();
  const params = new URL(req.url).searchParams;
  let q = (params.get("q") ?? "").trim().slice(0, 60);
  let tag = (params.get("tag") ?? "").trim().slice(0, 40);
  if (!tag && /^#[^\s#]+$/.test(q)) [tag, q] = [q.slice(1), ""];
  const max = Number(params.get("max"));
  const maxMinutes = Number.isInteger(max) && max > 0 && max <= 600 ? max : undefined;
  if (!q && !tag && !maxMinutes) return json({ users: [], recipes: [] });
  const users = q
    ? (
        getDb()
          .prepare(
            `SELECT id, username, display_name, avatar_url FROM users
             WHERE username LIKE @q OR display_name LIKE @q ORDER BY username LIMIT 20`,
          )
          .all({ q: `%${q}%` }) as { id: number; username: string; display_name: string; avatar_url: string | null }[]
      ).map((u) => ({ id: u.id, username: u.username, displayName: u.display_name, avatarUrl: u.avatar_url }))
    : [];
  return json({ users, recipes: searchRecipes(viewer.id, { q, tag, maxMinutes }) });
});
