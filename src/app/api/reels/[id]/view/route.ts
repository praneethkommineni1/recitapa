import { handler, idParam, json, requireUser } from "@/lib/http";
import { markReelSeen } from "@/lib/queries";

type Ctx = { params: Promise<{ id: string }> };

/** Record that the viewer watched this recipe in the Reels feed. */
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  markReelSeen(user.id, idParam((await params).id));
  return json({ ok: true });
});
