import { handler, HttpError, json, requireUser } from "@/lib/http";
import { applyStreakFreezes } from "@/lib/freezes";
import { planInfo } from "@/lib/plan";
import { streakFor } from "@/lib/queries";
import { isIsoDate } from "@/lib/streak";

export const GET = handler(async (req: Request) => {
  const user = await requireUser();
  const today = new URL(req.url).searchParams.get("today");
  if (!isIsoDate(today)) throw new HttpError(400, "today must be YYYY-MM-DD.");
  const frozen = applyStreakFreezes(user.id, today);
  return json({ streak: streakFor(user.id, today), frozen, freezesLeft: planInfo(user.id).freezesLeft });
});
