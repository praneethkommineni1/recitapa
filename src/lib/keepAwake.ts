"use client";

// Keep the screen on while cooking. The iOS app uses the native KeepAwake plugin; browsers use the
// Screen Wake Lock API, which drops the lock whenever the page is hidden, so we take it again on return.

import { Capacitor } from "@capacitor/core";

type WakeLock = { release(): Promise<void> };
type WakeLockNavigator = Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLock> } };

/** Keep the screen awake until the returned function is called. */
export function keepAwake(): () => void {
  if (typeof window === "undefined") return () => {};

  if (Capacitor.isNativePlatform()) {
    const plugin = import("@capacitor-community/keep-awake").then(({ KeepAwake }) => KeepAwake);
    plugin.then((k) => k.keepAwake()).catch(() => {});
    return () => {
      plugin.then((k) => k.allowSleep()).catch(() => {});
    };
  }

  const nav = navigator as WakeLockNavigator;
  if (!nav.wakeLock) return () => {};
  let lock: WakeLock | null = null;
  let active = true;
  const acquire = () => {
    if (!active || document.visibilityState !== "visible") return;
    nav.wakeLock!
      .request("screen")
      .then((l) => {
        if (active) lock = l;
        else l.release().catch(() => {});
      })
      .catch(() => {});
  };
  acquire();
  document.addEventListener("visibilitychange", acquire);
  return () => {
    active = false;
    document.removeEventListener("visibilitychange", acquire);
    lock?.release().catch(() => {});
  };
}
