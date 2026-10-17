import { monthStart } from "./budget";
import { getDb } from "./db";

// Free vs Plus. While we learn (roadmap Phase 0) the AI sous-chef is free for everyone: set this to a
// number to meter free users again. The shared monthly budget cap (budget.ts) still applies to everyone.
export const FREE_AI_SESSIONS_PER_MONTH: number | null = null;
/** AI sessions one person can start per rolling 24 hours, so no single user can drain the shared budget. */
export const AI_SESSIONS_PER_USER_PER_DAY = Number(process.env.AI_SESSIONS_PER_USER_PER_DAY) || 10;
/** A cook session's AI stops working this long after it starts; the cook starts cook mode again. */
export const SESSION_MAX_HOURS = 4;

/** Why a cook session runs in basic mode instead of with the AI chef. */
export type AiOffReason = "unavailable" | "budget" | "daily" | "limit";
export const PLUS_FREEZES_PER_MONTH = 2;
/** Hard cap on assistant turns per session, for both plans, so one session can't run up the bill. */
export const MAX_TURNS_PER_SESSION = 80;
/** Streak freezes only ever cover a short gap. */
export const MAX_FROZEN_GAP_DAYS = 2;

export interface PlanInfo {
  plan: "free" | "plus";
  plusUntil: string | null;
  source: string | null;
  aiSessionsUsed: number;
  aiSessionsLimit: number | null; // null = unlimited
  freezesLeft: number;
}

export function isPlus(userId: number): boolean {
  const row = getDb().prepare("SELECT plus_until FROM users WHERE id = ?").get(userId) as { plus_until: string | null } | undefined;
  return !!row?.plus_until && new Date(row.plus_until) > new Date();
}

export function aiSessionsThisMonth(userId: number): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM cook_sessions WHERE user_id = ? AND ai = 1 AND created_at >= ?")
      .get(userId, monthStart()) as { n: number }
  ).n;
}

export function aiSessionsToday(userId: number): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM cook_sessions WHERE user_id = ? AND ai = 1 AND created_at >= datetime('now', '-1 day')")
      .get(userId) as { n: number }
  ).n;
}

/** Freezes available right now: the Plus monthly allowance plus any purchased ones. */
export function freezesLeft(userId: number): number {
  const db = getDb();
  const bonus = (db.prepare("SELECT bonus_freezes FROM users WHERE id = ?").get(userId) as { bonus_freezes: number }).bonus_freezes;
  if (!isPlus(userId)) return bonus;
  const usedFromAllowance = (
    db
      .prepare("SELECT COUNT(*) AS n FROM streak_freezes WHERE user_id = ? AND source = 'plus' AND created_at >= ?")
      .get(userId, monthStart()) as { n: number }
  ).n;
  return Math.max(0, PLUS_FREEZES_PER_MONTH - usedFromAllowance) + bonus;
}

export function planInfo(userId: number): PlanInfo {
  const row = getDb().prepare("SELECT plus_until, plus_source FROM users WHERE id = ?").get(userId) as {
    plus_until: string | null;
    plus_source: string | null;
  };
  const plus = isPlus(userId);
  return {
    plan: plus ? "plus" : "free",
    plusUntil: plus ? row.plus_until : null,
    source: plus ? row.plus_source : null,
    aiSessionsUsed: aiSessionsThisMonth(userId),
    aiSessionsLimit: plus ? null : FREE_AI_SESSIONS_PER_MONTH,
    freezesLeft: freezesLeft(userId),
  };
}

/**
 * Record an entitlement from a billing provider (Stripe on the web, Apple via RevenueCat on iOS).
 * Pass null when that provider's subscription has ended. A user subscribed through both keeps
 * whichever entitlement lasts longer, and one provider ending never cancels the other.
 */
export function setPlus(userId: number, until: Date | null, source: string): void {
  const db = getDb();
  const row = db.prepare("SELECT plus_until, plus_source FROM users WHERE id = ?").get(userId) as
    | { plus_until: string | null; plus_source: string | null }
    | undefined;
  if (!row) return;
  const current = row.plus_until ? new Date(row.plus_until) : null;
  const otherActive = row.plus_source && row.plus_source !== source && current && current > new Date();
  if (!until) {
    if (!otherActive) db.prepare("UPDATE users SET plus_until = NULL, plus_source = NULL WHERE id = ?").run(userId);
    return;
  }
  if (otherActive && current! > until) return;
  db.prepare("UPDATE users SET plus_until = ?, plus_source = ? WHERE id = ?").run(until.toISOString(), source, userId);
}
