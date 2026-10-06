import { setPlus } from "../plan";

// iOS subscriptions go through Apple's In-App Purchase, managed by RevenueCat.
// The app passes our user id as RevenueCat's app user id.

export const RC_ENTITLEMENT = process.env.REVENUECAT_ENTITLEMENT || "plus";

export function revenueCatEnabled(): boolean {
  return Boolean(process.env.REVENUECAT_SECRET_KEY);
}

/** Ask RevenueCat for the user's current entitlement and store it. */
export async function syncFromRevenueCat(userId: number): Promise<void> {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(String(userId))}`, {
    headers: { Authorization: `Bearer ${process.env.REVENUECAT_SECRET_KEY}` },
  });
  if (!res.ok) throw new Error(`RevenueCat responded ${res.status}`);
  const data = (await res.json()) as {
    subscriber?: { entitlements?: Record<string, { expires_date: string | null }> };
  };
  const entitlement = data.subscriber?.entitlements?.[RC_ENTITLEMENT];
  if (!entitlement) return setPlus(userId, null, "apple");
  // A null expiry means a non-expiring (lifetime) purchase.
  const until = entitlement.expires_date ? new Date(entitlement.expires_date) : new Date("2999-01-01T00:00:00Z");
  setPlus(userId, until > new Date() ? until : null, "apple");
}
