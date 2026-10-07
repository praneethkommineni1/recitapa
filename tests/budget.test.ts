import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Use a throwaway database for this test file.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "recitapa-budget-"));
process.env.AI_MONTHLY_BUDGET_USD = "10";
delete process.env.ALERT_WEBHOOK_URL;
const { getDb } = await import("../src/lib/db.ts");
const { budgetStatus, checkBudgetAlerts, monthStart } = await import("../src/lib/budget.ts");

const db = getDb();
const userId = Number(db.prepare("INSERT INTO users (username, display_name, password_hash) VALUES ('cook', 'Cook', 'x')").run().lastInsertRowid);
const spend = (usd: number, when = "+0 days") =>
  db
    .prepare(
      "INSERT INTO ai_usage (user_id, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_micro_usd, created_at) VALUES (?, 'claude-haiku-4-5', 0, 0, 0, 0, ?, datetime('now', ?))",
    )
    .run(userId, Math.round(usd * 1e6), when);

test("monthStart is the first of the month in UTC", () => {
  assert.equal(monthStart(new Date("2026-10-07T12:00:00Z")), "2026-10-01 00:00:00");
});

test("spend from earlier months doesn't count against this month's cap", () => {
  spend(500, "-40 days");
  assert.deepEqual(budgetStatus(), { spentMicroUsd: 0, capMicroUsd: 10_000_000, exhausted: false });
});

test("alerts fire once per threshold, and the cap switches the AI off at 100%", () => {
  spend(4);
  assert.deepEqual(checkBudgetAlerts(), []);
  spend(4.5); // $8.50 of $10
  assert.deepEqual(checkBudgetAlerts(), [50, 80]);
  assert.deepEqual(checkBudgetAlerts(), []);
  assert.equal(budgetStatus().exhausted, false);
  spend(1.5);
  assert.deepEqual(checkBudgetAlerts(), [100]);
  assert.equal(budgetStatus().exhausted, true);
});
