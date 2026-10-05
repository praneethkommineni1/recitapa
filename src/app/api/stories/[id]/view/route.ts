import { getDb } from "@/lib/db";
import { handler, idParam, json, requireUser } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const id = idParam((await params).id);
  getDb()
    .prepare("INSERT OR IGNORE INTO story_views (dinner_id, user_id) SELECT id, ? FROM dinners WHERE id = ?")
    .run(user.id, id);
  return json({ ok: true });
});
