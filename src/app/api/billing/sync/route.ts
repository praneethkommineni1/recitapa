import { revenueCatEnabled, syncFromRevenueCat } from "@/lib/billing/revenuecat";
import { handler, json, requireUser } from "@/lib/http";
import { planInfo } from "@/lib/plan";

/** Called by the iOS app right after a purchase or restore so Plus unlocks immediately. */
export const POST = handler(async () => {
  const user = await requireUser();
  if (revenueCatEnabled()) await syncFromRevenueCat(user.id);
  return json({ plan: planInfo(user.id) });
});
