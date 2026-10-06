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
export function computeStreak(dates: string[], today: string, frozenDates: string[] = []): StreakInfo {
  // Frozen days keep a streak going but don't count as cooking.
  const days = [...new Set([...dates, ...frozenDates].filter(isIsoDate).map(dayNumber))].sort((a, b) => a - b);
  const cookedDays = new Set(dates.filter(isIsoDate).map(dayNumber));
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

  const cookedToday = cookedDays.has(todayN);
  const alive = prev !== null && (prev === todayN || prev === todayN - 1);
  const current = alive ? run : 0;
  return { current, longest, cookedToday, atRisk: current > 0 && !cookedToday };
}

export function fromDayNumber(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Which missed days to cover with streak freezes so the streak survives.
 * Only fills a gap that ends yesterday, is at most `maxGap` days long, follows a streak of at
 * least two nights, and can be covered entirely with the freezes available.
 */
export function daysToFreeze(activeDates: string[], today: string, available: number, maxGap: number): string[] {
  const todayN = dayNumber(today);
  const active = new Set(activeDates.filter(isIsoDate).map(dayNumber));
  if (active.has(todayN)) return [];
  let last = todayN - 1;
  while (last > todayN - 1 - maxGap - 1 && !active.has(last)) last--;
  const gap = todayN - 1 - last;
  if (!active.has(last) || gap === 0 || gap > maxGap || gap > available) return [];
  if (!active.has(last - 1)) return []; // don't spend freezes on a one-night streak
  return Array.from({ length: gap }, (_, i) => fromDayNumber(last + 1 + i));
}
