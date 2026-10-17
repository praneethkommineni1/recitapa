import type { CallUsage } from "./types.ts";

export type { CallUsage };

// USD per million tokens. Keep in sync with Anthropic's pricing page.
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

/** The API may report a longer, dated id; match the longest known prefix. Unknown models are priced as Opus 5.5. */
function priceFor(model: string) {
  const key = Object.keys(PRICES)
    .filter((k) => model === k || model.startsWith(`${k}-`))
    .sort((a, b) => b.length - a.length)[0];
  return PRICES[key ?? "claude-opus-5-5"];
}

/** Cost of one API call in millionths of a dollar. */
export function costMicroUsd(u: CallUsage): number {
  const p = priceFor(u.model);
  return Math.round(
    u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite,
  );
}
