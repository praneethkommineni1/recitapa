// Ranking for the Reels feed: a full-screen, swipe-through stream of recipes to discover.
// Pure functions so the ranking can be unit tested; the database side lives in queries.ts.

export interface ReelCandidate {
  id: number;
  authorId: number;
  /** Milliseconds since the epoch. */
  createdAt: number;
  likes: number;
  saves: number;
  comments: number;
  cooked: number;
  tags: string[];
  hasPhoto: boolean;
  /** When the viewer last watched this reel (ms), or null if never. */
  seenAt: number | null;
  /** The viewer already follows the author, so they see these recipes in their Following feed. */
  followsAuthor: boolean;
}

const DAY_MS = 86_400_000;
/** Freshness halves every week. */
const FRESH_HALF_LIFE_DAYS = 7;

/** How strongly a viewer leans toward each tag, from what they liked (1), saved (2) and cooked (3). */
export function tagAffinity(signals: { tags: string[]; weight: number }[]): Map<string, number> {
  const affinity = new Map<string, number>();
  for (const { tags, weight } of signals) {
    for (const tag of tags.map((t) => t.toLowerCase())) affinity.set(tag, (affinity.get(tag) ?? 0) + weight);
  }
  return affinity;
}

export function reelScore(c: ReelCandidate, affinity: Map<string, number>, now: number): number {
  const engagement = Math.log1p(c.likes + 2 * c.saves + 1.5 * c.comments + 3 * c.cooked);
  const ageDays = Math.max(0, (now - c.createdAt) / DAY_MS);
  const freshness = 2 * 0.5 ** (ageDays / FRESH_HALF_LIFE_DAYS);
  const taste = Math.min(1.5, Math.log1p(c.tags.reduce((sum, t) => sum + (affinity.get(t.toLowerCase()) ?? 0), 0)) * 0.6);
  return engagement + freshness + taste + (c.hasPhoto ? 0.4 : 0) - (c.followsAuthor ? 0.3 : 0);
}

/**
 * Order candidates for the feed. Reels the viewer hasn't seen come first, best score first;
 * already-seen reels follow, the longest-ago first, so the feed never runs dry. The same cook
 * never appears twice in a row when someone else is available.
 */
export function rankReels(candidates: ReelCandidate[], affinity: Map<string, number>, now: number, limit: number): number[] {
  const score = new Map(candidates.map((c) => [c.id, reelScore(c, affinity, now)]));
  const unseen = candidates.filter((c) => c.seenAt === null).sort((a, b) => score.get(b.id)! - score.get(a.id)! || b.id - a.id);
  const seen = candidates.filter((c) => c.seenAt !== null).sort((a, b) => a.seenAt! - b.seenAt! || b.id - a.id);
  const queue = [...unseen, ...seen];

  const picked: ReelCandidate[] = [];
  while (picked.length < limit && queue.length) {
    const last = picked.at(-1)?.authorId;
    // Look a few places ahead for a different cook before repeating one.
    const lookahead = queue.slice(0, 5).findIndex((c) => c.authorId !== last);
    picked.push(queue.splice(Math.max(0, lookahead), 1)[0]);
  }
  return picked.map((c) => c.id);
}
