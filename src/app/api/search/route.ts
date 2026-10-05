import { getDb } from "@/lib/db";
import { handler, json, requireUser } from "@/lib/http";
import { searchRecipes } from "@/lib/queries";

export const GET = handler(async (req: Request) => {
  const viewer = await requireUser();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (!q) return json({ users: [], recipes: [] });
  const users = (
    getDb()
      .prepare(
        `SELECT id, username, display_name, avatar_url FROM users
         WHERE username LIKE @q OR display_name LIKE @q ORDER BY username LIMIT 20`,
      )
      .all({ q: `%${q}%` }) as { id: number; username: string; display_name: string; avatar_url: string | null }[]
  ).map((u) => ({ id: u.id, username: u.username, displayName: u.display_name, avatarUrl: u.avatar_url }));
  return json({ users, recipes: searchRecipes(viewer.id, q) });
});
