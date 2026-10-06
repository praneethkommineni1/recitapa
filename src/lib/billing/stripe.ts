import Stripe from "stripe";
import { getDb } from "../db";
import { setPlus } from "../plan";

let client: Stripe | null = null;

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTHLY && process.env.STRIPE_PRICE_YEARLY);
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  return (client ??= new Stripe(process.env.STRIPE_SECRET_KEY));
}

const ACTIVE: Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];

/** Mirror a Stripe subscription onto the user's Plus entitlement. */
export function syncSubscription(sub: Stripe.Subscription): void {
  const db = getDb();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const byMetadata = Number(sub.metadata?.userId);
  const user = (
    Number.isInteger(byMetadata) && byMetadata > 0
      ? db.prepare("SELECT id FROM users WHERE id = ?").get(byMetadata)
      : db.prepare("SELECT id FROM users WHERE stripe_customer_id = ?").get(customerId)
  ) as { id: number } | undefined;
  if (!user) return;
  db.prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(customerId, user.id);

  const periodEnd = Math.max(0, ...sub.items.data.map((item) => item.current_period_end));
  const active = ACTIVE.includes(sub.status) && periodEnd > 0;
  setPlus(user.id, active ? new Date(periodEnd * 1000) : null, "stripe");
}
