import { test } from "node:test";
import assert from "node:assert/strict";
import { cohorts, funnel, gate, weekOf, type UserActivity } from "../src/lib/retention.ts";

const user = (id: number, signupDate: string, ageDays: number, extra: Partial<UserActivity> = {}): UserActivity => ({
  userId: id,
  signupDate,
  ageDays,
  activeDays: [],
  dinnerDays: [],
  followDays: [],
  cookDays: [],
  ...extra,
});

test("weekOf returns the Monday of the week", () => {
  assert.equal(weekOf("2026-10-07"), "2026-10-05"); // Wednesday
  assert.equal(weekOf("2026-10-05"), "2026-10-05"); // Monday
  assert.equal(weekOf("2026-10-11"), "2026-10-05"); // Sunday
});

test("gate counts only users at least 28 days old who logged dinner in days 21-27", () => {
  const users = [
    user(1, "2026-08-01", 60, { dinnerDays: [22.5] }),
    user(2, "2026-08-01", 60, { dinnerDays: [3, 28.2] }), // day 28 is week 5, not week 4
    user(3, "2026-08-01", 30, { dinnerDays: [21] }),
    user(4, "2026-09-30", 7, { dinnerDays: [1] }), // too new
  ];
  assert.deepEqual(gate(users), { eligible: 3, stillCooking: 2, share: 2 / 3 });
  assert.equal(gate([user(5, "2026-10-01", 6)]).share, null);
});

test("cohorts group by signup week, newest first, and hide metrics a cohort is too young for", () => {
  const rows = cohorts([
    user(1, "2026-09-01", 36, { activeDays: [1.2, 7.5, 30.1], dinnerDays: [23] }),
    user(2, "2026-09-02", 35, { activeDays: [0.1] }),
    user(3, "2026-10-06", 1),
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].week, "2026-10-05");
  assert.deepEqual([rows[0].d1, rows[0].d7, rows[0].week4Dinner], [null, null, null]);
  assert.equal(rows[1].week, "2026-08-31");
  assert.deepEqual([rows[1].users, rows[1].d1, rows[1].d7, rows[1].d30, rows[1].week4Dinner], [2, 0.5, 0.5, 0.5, 0.5]);
});

test("funnel measures the first days for users at least a week old", () => {
  const f = funnel([
    user(1, "2026-09-01", 30, { dinnerDays: [1.5], followDays: [0.1, 0.2, 1.9], cookDays: [3] }),
    user(2, "2026-09-01", 30, { dinnerDays: [2.5], followDays: [0.1, 0.2, 2.1] }),
    user(3, "2026-10-05", 2, { dinnerDays: [0.5] }),
  ]);
  assert.deepEqual(f, { signups: 2, dinnerIn48h: 1, follow3In48h: 1, cookedIn7d: 1 });
});
