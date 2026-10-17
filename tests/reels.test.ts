import { test } from "node:test";
import assert from "node:assert/strict";
import { rankReels, reelScore, tagAffinity, type ReelCandidate } from "../src/lib/reels.ts";

const NOW = Date.parse("2026-10-06T12:00:00Z");
const DAY = 86_400_000;
const reel = (id: number, over: Partial<ReelCandidate> = {}): ReelCandidate => ({
  id,
  authorId: id,
  createdAt: NOW - DAY,
  likes: 0,
  saves: 0,
  comments: 0,
  cooked: 0,
  tags: [],
  hasPhoto: true,
  seenAt: null,
  followsAuthor: false,
  ...over,
});

test("unseen reels come before seen ones, and seen ones loop oldest-first", () => {
  const ids = rankReels(
    [reel(1, { seenAt: NOW - 1000, likes: 50 }), reel(2), reel(3, { seenAt: NOW - 5 * DAY }), reel(4)],
    new Map(),
    NOW,
    10,
  );
  assert.deepEqual(ids.slice(0, 2).sort(), [2, 4]);
  assert.deepEqual(ids.slice(2), [3, 1]);
});

test("engagement, freshness and taste raise the score", () => {
  const none = new Map<string, number>();
  assert.ok(reelScore(reel(1, { cooked: 5 }), none, NOW) > reelScore(reel(2), none, NOW));
  assert.ok(reelScore(reel(1), none, NOW) > reelScore(reel(2, { createdAt: NOW - 30 * DAY }), none, NOW));
  const taste = tagAffinity([{ tags: ["Pasta"], weight: 2 }, { tags: ["pasta", "quick"], weight: 1 }]);
  assert.equal(taste.get("pasta"), 3);
  assert.ok(reelScore(reel(1, { tags: ["pasta"] }), taste, NOW) > reelScore(reel(2, { tags: ["salad"] }), taste, NOW));
  // Followed cooks already show up in Following, so Reels leans toward new ones.
  assert.ok(reelScore(reel(1), none, NOW) > reelScore(reel(2, { followsAuthor: true }), none, NOW));
});

test("the same cook doesn't appear twice in a row when someone else is available", () => {
  const ids = rankReels(
    [reel(1, { authorId: 7, likes: 30 }), reel(2, { authorId: 7, likes: 20 }), reel(3, { authorId: 8 })],
    new Map(),
    NOW,
    3,
  );
  assert.deepEqual(ids, [1, 3, 2]);
});

test("limit is respected and an empty pool gives an empty page", () => {
  assert.equal(rankReels([reel(1), reel(2), reel(3)], new Map(), NOW, 2).length, 2);
  assert.deepEqual(rankReels([], new Map(), NOW, 8), []);
});
