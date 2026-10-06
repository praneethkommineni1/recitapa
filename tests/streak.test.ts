import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreak } from "../src/lib/streak.ts";

test("empty history has no streak", () => {
  assert.deepEqual(computeStreak([], "2026-10-05"), { current: 0, longest: 0, cookedToday: false, atRisk: false });
});

test("consecutive days ending today", () => {
  const s = computeStreak(["2026-10-03", "2026-10-04", "2026-10-05"], "2026-10-05");
  assert.equal(s.current, 3);
  assert.equal(s.cookedToday, true);
  assert.equal(s.atRisk, false);
});

test("streak ending yesterday is alive but at risk", () => {
  const s = computeStreak(["2026-10-03", "2026-10-04"], "2026-10-05");
  assert.equal(s.current, 2);
  assert.equal(s.atRisk, true);
});

test("a missed day breaks the streak but keeps the longest", () => {
  const s = computeStreak(["2026-09-01", "2026-09-02", "2026-09-03", "2026-10-03"], "2026-10-05");
  assert.equal(s.current, 0);
  assert.equal(s.longest, 3);
});

test("duplicates, month boundaries and future dates", () => {
  const s = computeStreak(["2026-09-30", "2026-10-01", "2026-10-01", "2026-10-02", "2026-10-09"], "2026-10-02");
  assert.equal(s.current, 3);
  assert.equal(s.longest, 3);
});

import { daysToFreeze } from "../src/lib/streak.ts";

test("frozen days bridge a streak but don't count as cooked today", () => {
  const s = computeStreak(["2026-10-01", "2026-10-02"], "2026-10-04", ["2026-10-03"]);
  assert.equal(s.current, 3);
  assert.equal(s.atRisk, true);
});

test("daysToFreeze covers a missed yesterday", () => {
  assert.deepEqual(daysToFreeze(["2026-10-02", "2026-10-03"], "2026-10-05", 2, 2), ["2026-10-04"]);
});

test("daysToFreeze covers a two-day gap only with two freezes", () => {
  const dates = ["2026-10-01", "2026-10-02"];
  assert.deepEqual(daysToFreeze(dates, "2026-10-05", 2, 2), ["2026-10-03", "2026-10-04"]);
  assert.deepEqual(daysToFreeze(dates, "2026-10-05", 1, 2), []);
});

test("daysToFreeze does nothing when not needed or not worth it", () => {
  assert.deepEqual(daysToFreeze(["2026-10-03", "2026-10-04"], "2026-10-05", 2, 2), []); // cooked yesterday
  assert.deepEqual(daysToFreeze(["2026-10-01"], "2026-10-05", 5, 5), []); // one-night streak
  assert.deepEqual(daysToFreeze(["2026-09-20", "2026-09-21"], "2026-10-05", 2, 2), []); // gap too long
  assert.deepEqual(daysToFreeze([], "2026-10-05", 2, 2), []);
});
