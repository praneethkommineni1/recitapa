import type Stripe from "stripe";
import { getDb } from "@/lib/db";
import { getStripe, syncSubscription } from "@/lib/billing/stripe";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook not configured", { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = Number(session.client_reference_id);
      const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (userId && customer) getDb().prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?").run(customer, userId);
      if (typeof session.subscription === "string")
        syncSubscription(await getStripe().subscriptions.retrieve(session.subscription));
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      syncSubscription(event.data.object);
      break;
  }
  return Response.json({ received: true });
}
