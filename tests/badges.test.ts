import { test } from "node:test";
import assert from "node:assert/strict";
import { BADGES, dishKinds, evaluateBadges } from "../src/lib/badges.ts";

test("catalog has 30 badges with unique ids and names", () => {
  assert.equal(BADGES.length, 30);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, 30);
  assert.equal(new Set(BADGES.map((b) => b.name)).size, 30);
  for (const b of BADGES) assert.ok(b.target >= 1, b.id);
});

test("dish matching uses word starts", () => {
  assert.deepEqual(dishKinds("Homemade sourdough, finally!"), ["bread"]);
  assert.deepEqual(dishKinds("Cacio e pepe pasta italian"), ["pasta"]);
  assert.deepEqual(dishKinds("Weeknight jollof rice"), ["rice"]);
  assert.deepEqual(dishKinds("Garlic chili oil noodles spicy"), ["noodles", "spicy"]);
  assert.deepEqual(dishKinds("A piece of the price"), []); // not pie, not rice
  assert.deepEqual(dishKinds("apple pie"), ["dessert"]);
});

test("evaluateBadges reports progress and earned state", () => {
  const progress = evaluateBadges({ longestStreak: 8, "dish:pasta": 2, dinners: 1 });
  const get = (id: string) => progress.find((b) => b.id === id)!;
  assert.equal(get("on-a-roll").earned, true);
  assert.equal(get("hot-streak").earned, true);
  assert.deepEqual([get("well-seasoned").earned, get("well-seasoned").value], [false, 8]);
  assert.deepEqual([get("pasta-la-vista").earned, get("pasta-la-vista").value], [false, 2]);
  assert.equal(get("first-course").earned, true);
  assert.equal(get("chefs-kiss").earned, false);
});
