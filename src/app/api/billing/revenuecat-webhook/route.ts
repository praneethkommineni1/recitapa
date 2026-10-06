import crypto from "node:crypto";
import { revenueCatEnabled, syncFromRevenueCat } from "@/lib/billing/revenuecat";

/**
 * RevenueCat calls this on purchases, renewals, cancellations and expirations.
 * Rather than trusting the payload, re-read the subscriber from RevenueCat's API.
 */
export async function POST(req: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || !revenueCatEnabled() || auth.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected)))
    return new Response("Unauthorized", { status: 401 });

  const body = (await req.json().catch(() => null)) as { event?: { app_user_id?: string; transferred_to?: string[] } } | null;
  const ids = new Set([body?.event?.app_user_id, ...(body?.event?.transferred_to ?? [])].filter(Boolean));
  for (const id of ids) {
    const userId = Number(id);
    if (Number.isInteger(userId) && userId > 0) await syncFromRevenueCat(userId);
  }
  return Response.json({ received: true });
}
