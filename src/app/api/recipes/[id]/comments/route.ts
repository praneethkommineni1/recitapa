import { getDb } from "@/lib/db";
import { handler, HttpError, idParam, json, readJson, requireUser, str } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const id = idParam((await params).id);
  const body = str((await readJson(req)).body, "Comment", { max: 1000 });
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM recipes WHERE id = ?").get(id)) throw new HttpError(404, "Recipe not found.");
  db.prepare("INSERT INTO comments (recipe_id, user_id, body) VALUES (?, ?, ?)").run(id, user.id, body);
  return json({ ok: true }, 201);
});
