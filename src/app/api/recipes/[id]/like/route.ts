import { getDb } from "@/lib/db";
import { handler, HttpError, idParam, json, requireUser } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

/** Toggle the like on a recipe. */
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const id = idParam((await params).id);
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM recipes WHERE id = ?").get(id)) throw new HttpError(404, "Recipe not found.");
  const removed = db.prepare("DELETE FROM likes WHERE user_id = ? AND recipe_id = ?").run(user.id, id).changes;
  if (!removed) db.prepare("INSERT INTO likes (user_id, recipe_id) VALUES (?, ?)").run(user.id, id);
  return json({ active: !removed });
});
