import type { Usage } from "./types";

/** USD per million tokens: [input, output]. Cache reads cost 0.1x input, cache writes 1.25x. */
const PRICES: Record<string, [number, number]> = {
  "claude-fable-5-1": [10, 50],
  "claude-fable-5": [10, 50],
  "claude-opus-5-5": [4, 20],
  "claude-opus-5": [5, 25],
  "claude-opus-4-8": [5, 25],
  "claude-opus-4-7": [5, 25],
  "claude-opus-4-6": [5, 25],
  "claude-sonnet-5-5": [2, 10],
  "claude-sonnet-5": [2, 10],
  "claude-sonnet-4-6": [3, 15],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-haiku-4-5": [1, 5],
};

/**
 * ESTIMATED cost from published list prices and the usage the API reported. It ignores server-tool
 * fees (e.g. per-search charges), long-prompt surcharges and discounts, so treat it as an estimate.
 * Returns null for models without a known price so callers never invent a number.
 */
export function estimateCostUsd(model: string, u: Usage): number | null {
  const p = PRICES[model];
  if (!p) return null;
  const [inP, outP] = p;
  const usd =
    (u.inputTokens * inP + u.outputTokens * outP + u.cacheReadTokens * inP * 0.1 + u.cacheWriteTokens * inP * 1.25) /
    1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}
