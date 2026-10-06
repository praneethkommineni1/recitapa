import { getDb } from "@/lib/db";
import { getStripe, stripeEnabled } from "@/lib/billing/stripe";
import { handler, HttpError, json, requireUser } from "@/lib/http";

/** Stripe's hosted page for changing or cancelling a web subscription. */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const { stripe_customer_id } = getDb().prepare("SELECT stripe_customer_id FROM users WHERE id = ?").get(user.id) as {
    stripe_customer_id: string | null;
  };
  if (!stripeEnabled() || !stripe_customer_id) throw new HttpError(404, "No web subscription to manage.");
  const session = await getStripe().billingPortal.sessions.create({
    customer: stripe_customer_id,
    return_url: `${new URL(req.url).origin}/plus`,
  });
  return json({ url: session.url });
});
