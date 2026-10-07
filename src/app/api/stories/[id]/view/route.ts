import { track } from "@/lib/analytics";
import { getDb } from "@/lib/db";
import { handler, idParam, json, requireUser } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const id = idParam((await params).id);
  const { changes } = getDb()
    .prepare("INSERT OR IGNORE INTO story_views (dinner_id, user_id) SELECT id, ? FROM dinners WHERE id = ?")
    .run(user.id, id);
  if (changes) track(user.id, "story_viewed", { dinnerId: id });
  return json({ ok: true });
});
