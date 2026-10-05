import { getDb } from "@/lib/db";
import { handler, HttpError, json, requireUser } from "@/lib/http";
import { dinnersByUser, findUser, recipesByUser, streakFor } from "@/lib/queries";
import { isIsoDate } from "@/lib/streak";

type Ctx = { params: Promise<{ username: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const viewer = await requireUser();
  const user = findUser((await params).username);
  if (!user) throw new HttpError(404, "User not found.");
  const todayParam = new URL(req.url).searchParams.get("today");
  const today = isIsoDate(todayParam) ? todayParam : new Date().toISOString().slice(0, 10);
  const db = getDb();
  const count = (sql: string) => (db.prepare(sql).get(user.id) as { n: number }).n;
  return json({
    profile: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      joinedAt: user.created_at,
      isMe: user.id === viewer.id,
      following: Boolean(
        db.prepare("SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?").get(viewer.id, user.id),
      ),
      stats: {
        recipes: count("SELECT COUNT(*) AS n FROM recipes WHERE user_id = ?"),
        dinners: count("SELECT COUNT(*) AS n FROM dinners WHERE user_id = ?"),
        followers: count("SELECT COUNT(*) AS n FROM follows WHERE followee_id = ?"),
        following: count("SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?"),
      },
      streak: streakFor(user.id, today),
    },
    recipes: recipesByUser(viewer.id, user.id),
    dinners: dinnersByUser(user.id),
  });
});
