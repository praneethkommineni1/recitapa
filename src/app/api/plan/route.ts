import { stripeEnabled } from "@/lib/billing/stripe";
import { handler, json, requireUser } from "@/lib/http";
import { planInfo } from "@/lib/plan";

export const GET = handler(async () => {
  const user = await requireUser();
  return json({
    plan: planInfo(user.id),
    billing: {
      stripe: stripeEnabled(),
      devMode: process.env.BILLING_DEV_MODE === "1" && process.env.NODE_ENV !== "production",
    },
  });
});
