import { getDb } from "./db.ts";

// A hard monthly cap on AI spend, shared by every user. Once it's reached, cook mode runs in basic mode
// until the next calendar month (UTC). Set AI_MONTHLY_BUDGET_USD to change it; 0 turns the AI off.
export const DEFAULT_AI_BUDGET_USD = 80;
/** Alert when monthly spend crosses these percentages of the cap. */
export const ALERT_PERCENTS = [50, 80, 100];

/** Start of the current calendar month (UTC) in SQLite datetime format. */
export function monthStart(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01 00:00:00`;
}

export function budgetCapMicroUsd(): number {
  const raw = process.env.AI_MONTHLY_BUDGET_USD;
  const usd = raw === undefined || raw === "" ? DEFAULT_AI_BUDGET_USD : Number(raw);
  return Math.round((Number.isFinite(usd) && usd >= 0 ? usd : DEFAULT_AI_BUDGET_USD) * 1e6);
}

export function aiSpendThisMonthMicroUsd(): number {
  return (
    getDb().prepare("SELECT COALESCE(SUM(cost_micro_usd), 0) AS c FROM ai_usage WHERE created_at >= ?").get(monthStart()) as { c: number }
  ).c;
}

export interface BudgetStatus {
  spentMicroUsd: number;
  capMicroUsd: number;
  exhausted: boolean;
}

export function budgetStatus(): BudgetStatus {
  const spentMicroUsd = aiSpendThisMonthMicroUsd();
  const capMicroUsd = budgetCapMicroUsd();
  return { spentMicroUsd, capMicroUsd, exhausted: spentMicroUsd >= capMicroUsd };
}

/**
 * Record any alert thresholds crossed this month and notify the founder once per threshold.
 * Returns the percentages that were newly crossed.
 */
export function checkBudgetAlerts(status: BudgetStatus = budgetStatus()): number[] {
  if (!status.capMicroUsd) return [];
  const month = monthStart().slice(0, 7);
  const insert = getDb().prepare("INSERT OR IGNORE INTO budget_alerts (month, percent) VALUES (?, ?)");
  const crossed = ALERT_PERCENTS.filter((p) => status.spentMicroUsd >= (status.capMicroUsd * p) / 100 && insert.run(month, p).changes);
  for (const p of crossed) {
    const usd = (m: number) => `$${(m / 1e6).toFixed(2)}`;
    notifyFounder(
      p >= 100
        ? `Recitapa: the AI budget for ${month} is used up (${usd(status.spentMicroUsd)} of ${usd(status.capMicroUsd)}). Cook mode is in basic mode until next month.`
        : `Recitapa: AI spend for ${month} passed ${p}% of the budget (${usd(status.spentMicroUsd)} of ${usd(status.capMicroUsd)}).`,
    );
  }
  return crossed;
}

/** Log a message and, if ALERT_WEBHOOK_URL is set (Slack or Discord incoming webhook), post it there. */
export function notifyFounder(text: string): void {
  console.warn(text);
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, content: text }) }).catch((err) =>
    console.error(`Alert webhook failed: ${(err as Error).message}`),
  );
}
