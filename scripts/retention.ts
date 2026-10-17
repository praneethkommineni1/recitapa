// Retention report for the Phase 0 test: weekly signup cohorts, the week-4 gate and the first-days funnel.
// Usage: npm run retention
import { getDb } from "../src/lib/db.ts";
import { cohorts, funnel, gate, type UserActivity } from "../src/lib/retention.ts";

const db = getDb();
const users = db
  .prepare(
    `SELECT id, date(created_at) AS signup_date, CAST(julianday('now') - julianday(created_at) AS INTEGER) AS age_days, created_at
     FROM users ORDER BY created_at`,
  )
  .all() as { id: number; signup_date: string; age_days: number; created_at: string }[];

const daysAfter = db.prepare(
  `SELECT name, julianday(e.created_at) - julianday(?) AS day FROM events e WHERE e.user_id = ? AND e.name != 'signup'`,
);

const activity: UserActivity[] = users.map((u) => {
  const rows = daysAfter.all(u.created_at, u.id) as { name: string; day: number }[];
  const of = (name: string) => rows.filter((r) => r.name === name).map((r) => r.day);
  return {
    userId: u.id,
    signupDate: u.signup_date,
    ageDays: u.age_days,
    activeDays: rows.map((r) => r.day),
    dinnerDays: of("dinner_logged"),
    followDays: of("followed"),
    cookDays: of("cook_started"),
  };
});

const pct = (v: number | null) => (v === null ? "   —" : `${Math.round(v * 100)}%`.padStart(4));
const of = (n: number, d: number) => (d ? `${n} of ${d} (${Math.round((n / d) * 100)}%)` : "no one yet");

console.log(`Recitapa retention · ${users.length} users\n`);

const g = gate(activity);
console.log("Phase 0 gate (G1): still logging dinner in week 4 (days 21-27)");
if (g.share === null) console.log("  Nobody has been signed up for 28 days yet.");
else {
  const verdict = g.share >= 0.2 ? "PASS: move on to Phase 1" : g.share < 0.1 ? "BELOW 10%: rethink the core" : "BETWEEN 10% AND 20%: keep testing";
  console.log(`  ${of(g.stillCooking, g.eligible)} · target 20%+ · ${verdict}`);
}

console.log("\nWeekly cohorts (share active on that day after signup; — = too new to measure)");
console.log("  signup week   users    D1    D7   D30   week-4 dinner");
for (const c of cohorts(activity))
  console.log(`  ${c.week}  ${String(c.users).padStart(5)}  ${pct(c.d1)}  ${pct(c.d7)}  ${pct(c.d30)}   ${pct(c.week4Dinner)}`);

const f = funnel(activity);
console.log(`\nFirst days (users signed up 7+ days ago: ${f.signups})`);
console.log(`  logged a dinner within 48 hours:   ${of(f.dinnerIn48h, f.signups)}`);
console.log(`  followed 3+ people within 48 hours: ${of(f.follow3In48h, f.signups)}`);
console.log(`  started cook mode within 7 days:    ${of(f.cookedIn7d, f.signups)}`);

const finished = db
  .prepare(
    `SELECT COUNT(*) AS started, SUM(finished_at IS NOT NULL) AS finished, SUM(ai) AS ai FROM cook_sessions WHERE created_at >= datetime('now', '-30 days')`,
  )
  .get() as { started: number; finished: number | null; ai: number | null };
console.log(`\nCook mode, last 30 days: ${finished.started} started, ${finished.finished ?? 0} finished, ${finished.ai ?? 0} with the AI chef`);
