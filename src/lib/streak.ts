import type { StreakInfo } from "./types.ts";

/** Days since the Unix epoch for a YYYY-MM-DD string (calendar math, no timezones). */
export function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dayNumber(value));
}

/**
 * Compute the dinner streak from the local dates on which dinners were logged.
 * A streak survives until the end of the day after the last dinner, so a
 * streak whose last dinner was yesterday is still "current" but at risk.
 */
export function computeStreak(dates: string[], today: string): StreakInfo {
  const days = [...new Set(dates.filter(isIsoDate).map(dayNumber))].sort((a, b) => a - b);
  const todayN = dayNumber(today);

  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    if (d > todayN) continue; // ignore dates in the future
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  const cookedToday = days.includes(todayN);
  const alive = prev !== null && (prev === todayN || prev === todayN - 1);
  const current = alive ? run : 0;
  return { current, longest, cookedToday, atRisk: current > 0 && !cookedToday };
}
