import { getDb } from "@/lib/db";
import { handler, HttpError, idParam, json, requireUser } from "@/lib/http";
import { recipeDetail } from "@/lib/queries";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const recipe = recipeDetail(user.id, idParam((await params).id));
  if (!recipe) throw new HttpError(404, "Recipe not found.");
  return json({ recipe });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { changes } = getDb()
    .prepare("DELETE FROM recipes WHERE id = ? AND user_id = ?")
    .run(idParam((await params).id), user.id);
  if (!changes) throw new HttpError(404, "Recipe not found.");
  return json({ ok: true });
});
