// AI cost report: what the sous-chef costs per session, per user and per plan.
// Usage: npm run usage [days]   (default: last 30 days)
import { budgetStatus } from "../src/lib/budget.ts";
import { getDb } from "../src/lib/db.ts";

const days = Number(process.argv[2] ?? 30);
const db = getDb();
const since = `-${days} days`;
const usd = (micro: number) => `$${(micro / 1e6).toFixed(2)}`;

const totals = db
  .prepare(
    `SELECT COUNT(DISTINCT session_id) AS sessions, COUNT(*) AS calls, COALESCE(SUM(cost_micro_usd), 0) AS cost,
            COALESCE(SUM(input_tokens), 0) AS input, COALESCE(SUM(output_tokens), 0) AS output,
            COALESCE(SUM(cache_read_tokens), 0) AS cache_read
     FROM ai_usage WHERE created_at >= datetime('now', ?)`,
  )
  .get(since) as { sessions: number; calls: number; cost: number; input: number; output: number; cache_read: number };

const budget = budgetStatus();
console.log(
  `AI budget this month: ${usd(budget.spentMicroUsd)} of ${usd(budget.capMicroUsd)} (${budget.capMicroUsd ? Math.round((budget.spentMicroUsd / budget.capMicroUsd) * 100) : 100}%)${budget.exhausted ? " · USED UP, cook mode is in basic mode" : ""}\n`,
);
console.log(`AI chef usage, last ${days} days`);
console.log(`  sessions: ${totals.sessions}   API calls: ${totals.calls}   total cost: ${usd(totals.cost)}`);
if (totals.sessions) console.log(`  average cost per session: ${usd(totals.cost / totals.sessions)}`);
console.log(`  tokens: ${totals.input} input, ${totals.output} output, ${totals.cache_read} cache reads`);

const byModel = db
  .prepare(
    `SELECT model, COUNT(DISTINCT session_id) AS sessions, SUM(cost_micro_usd) AS cost FROM ai_usage
     WHERE created_at >= datetime('now', ?) GROUP BY model ORDER BY cost DESC`,
  )
  .all(since) as { model: string; sessions: number; cost: number }[];
for (const m of byModel) console.log(`  ${m.model}: ${m.sessions} sessions, ${usd(m.cost)} (${usd(m.cost / Math.max(1, m.sessions))} per session)`);

const byPlan = db
  .prepare(
    `SELECT CASE WHEN u.plus_until > strftime('%Y-%m-%dT%H:%M:%fZ', 'now') THEN 'plus' ELSE 'free' END AS plan,
            COUNT(DISTINCT a.user_id) AS users, SUM(a.cost_micro_usd) AS cost
     FROM ai_usage a JOIN users u ON u.id = a.user_id
     WHERE a.created_at >= datetime('now', ?) GROUP BY plan`,
  )
  .all(since) as { plan: string; users: number; cost: number }[];
for (const p of byPlan) console.log(`  ${p.plan}: ${p.users} users, ${usd(p.cost)} (${usd(p.cost / p.users)} per user)`);

const top = db
  .prepare(
    `SELECT u.username, SUM(a.cost_micro_usd) AS cost, COUNT(DISTINCT a.session_id) AS sessions
     FROM ai_usage a JOIN users u ON u.id = a.user_id
     WHERE a.created_at >= datetime('now', ?) GROUP BY a.user_id ORDER BY cost DESC LIMIT 10`,
  )
  .all(since) as { username: string; cost: number; sessions: number }[];
if (top.length) {
  console.log("  top users:");
  for (const t of top) console.log(`    @${t.username}: ${usd(t.cost)} over ${t.sessions} sessions`);
}
