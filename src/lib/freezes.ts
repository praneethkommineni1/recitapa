import { getDb } from "./db";
import { freezesLeft, isPlus, MAX_FROZEN_GAP_DAYS } from "./plan";
import { dayNumber, daysToFreeze } from "./streak";

/**
 * Spend streak freezes on missed days so the user's streak survives, if they have any.
 * Called when the user looks at their own streak; returns the days that were frozen.
 */
export function applyStreakFreezes(userId: number, today: string): string[] {
  // `today` comes from the client; ignore values far from the server clock.
  if (Math.abs(dayNumber(today) - Math.floor(Date.now() / 86_400_000)) > 1) return [];
  const db = getDb();
  return db.transaction(() => {
    const available = freezesLeft(userId);
    if (!available) return [];
    const active = (
      db
        .prepare("SELECT local_date FROM dinners WHERE user_id = ? UNION SELECT local_date FROM streak_freezes WHERE user_id = ?")
        .all(userId, userId) as { local_date: string }[]
    ).map((r) => r.local_date);
    const days = daysToFreeze(active, today, available, MAX_FROZEN_GAP_DAYS);
    if (!days.length) return [];

    // Use the monthly Plus allowance first, then purchased freezes.
    const fromAllowance = isPlus(userId) ? Math.min(days.length, available - bonusFreezes(userId)) : 0;
    const insert = db.prepare("INSERT OR IGNORE INTO streak_freezes (user_id, local_date, source) VALUES (?, ?, ?)");
    days.forEach((day, i) => insert.run(userId, day, i < fromAllowance ? "plus" : "bonus"));
    const fromBonus = days.length - fromAllowance;
    if (fromBonus) db.prepare("UPDATE users SET bonus_freezes = bonus_freezes - ? WHERE id = ?").run(fromBonus, userId);
    return days;
  })();
}

function bonusFreezes(userId: number): number {
  return (getDb().prepare("SELECT bonus_freezes FROM users WHERE id = ?").get(userId) as { bonus_freezes: number }).bonus_freezes;
}
