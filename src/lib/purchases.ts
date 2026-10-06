"use client";

// In-app purchases for the iOS app (Apple IAP through RevenueCat). On the web we use Stripe instead.

import { Capacitor } from "@capacitor/core";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";

export const isNativeApp = () => typeof window !== "undefined" && Capacitor.isNativePlatform();

let configuredFor: number | null = null;

async function purchases(userId: number) {
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY;
  if (!apiKey) throw new Error("In-app purchases aren't set up yet.");
  if (configuredFor !== userId) {
    // Our user id doubles as RevenueCat's app user id, so the server can look the purchase up.
    if (configuredFor === null) await Purchases.configure({ apiKey, appUserID: String(userId) });
    else await Purchases.logIn({ appUserID: String(userId) });
    configuredFor = userId;
  }
  return Purchases;
}

export interface NativeOffer {
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
}

export async function loadNativeOffer(userId: number): Promise<NativeOffer> {
  const { current } = await (await purchases(userId)).getOfferings();
  return { monthly: current?.monthly ?? null, annual: current?.annual ?? null };
}

/** Returns false if the user cancelled the App Store sheet. */
export async function buyNative(userId: number, pkg: PurchasesPackage): Promise<boolean> {
  try {
    await (await purchases(userId)).purchasePackage({ aPackage: pkg });
    return true;
  } catch (err) {
    if ((err as { userCancelled?: boolean }).userCancelled) return false;
    throw err;
  }
}

export async function restoreNative(userId: number): Promise<void> {
  await (await purchases(userId)).restorePurchases();
}
