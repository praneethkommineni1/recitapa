import { track } from "@/lib/analytics";
import { getDb } from "@/lib/db";
import { handler, HttpError, json, requireUser } from "@/lib/http";
import { findUser } from "@/lib/queries";

type Ctx = { params: Promise<{ username: string }> };

/** Toggle following a user. */
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const viewer = await requireUser();
  const user = findUser((await params).username);
  if (!user) throw new HttpError(404, "User not found.");
  if (user.id === viewer.id) throw new HttpError(400, "You can't follow yourself.");
  const db = getDb();
  const removed = db.prepare("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?").run(viewer.id, user.id).changes;
  if (!removed) {
    db.prepare("INSERT INTO follows (follower_id, followee_id) VALUES (?, ?)").run(viewer.id, user.id);
    track(viewer.id, "followed", { userId: user.id });
  }
  return json({ following: !removed });
});
