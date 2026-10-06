import { handler, HttpError, json, requireUser } from "@/lib/http";
import { isPlus, planInfo, setPlus } from "@/lib/plan";

/** Local testing only: toggle Plus without a payment provider. Requires BILLING_DEV_MODE=1. */
export const POST = handler(async () => {
  if (process.env.BILLING_DEV_MODE !== "1" || process.env.NODE_ENV === "production") throw new HttpError(404, "Not found.");
  const user = await requireUser();
  setPlus(user.id, isPlus(user.id) ? null : new Date(Date.now() + 30 * 86_400_000), "dev");
  return json({ plan: planInfo(user.id) });
});
