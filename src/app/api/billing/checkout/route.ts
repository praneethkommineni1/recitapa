import { getDb } from "@/lib/db";
import { getStripe, stripeEnabled } from "@/lib/billing/stripe";
import { handler, HttpError, json, readJson, requireUser } from "@/lib/http";
import { isPlus } from "@/lib/plan";

const TRIAL_DAYS = 7;

/** Start a Stripe Checkout for Plus (web). */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  if (!stripeEnabled()) throw new HttpError(503, "Payments aren't set up yet.");
  if (isPlus(user.id)) throw new HttpError(409, "You already have Plus.");
  const interval = (await readJson(req)).interval === "year" ? "year" : "month";
  const price = interval === "year" ? process.env.STRIPE_PRICE_YEARLY! : process.env.STRIPE_PRICE_MONTHLY!;
  const origin = new URL(req.url).origin;
  const { stripe_customer_id } = getDb().prepare("SELECT stripe_customer_id FROM users WHERE id = ?").get(user.id) as {
    stripe_customer_id: string | null;
  };

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: String(user.id),
    ...(stripe_customer_id ? { customer: stripe_customer_id } : {}),
    subscription_data: {
      metadata: { userId: String(user.id) },
      // One free trial per customer.
      ...(stripe_customer_id ? {} : { trial_period_days: TRIAL_DAYS }),
    },
    allow_promotion_codes: true,
    success_url: `${origin}/plus?welcome=1`,
    cancel_url: `${origin}/plus`,
  });
  if (!session.url) throw new HttpError(502, "Couldn't start checkout.");
  return json({ url: session.url });
});
