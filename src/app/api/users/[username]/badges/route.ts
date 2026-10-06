import { syncBadges } from "@/lib/badgeAwards";
import { handler, HttpError, json, requireUser } from "@/lib/http";
import { findUser } from "@/lib/queries";

type Ctx = { params: Promise<{ username: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  await requireUser();
  const user = findUser((await params).username);
  if (!user) throw new HttpError(404, "User not found.");
  return json({ badges: syncBadges(user.id) });
});
