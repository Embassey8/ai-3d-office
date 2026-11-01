/**
 * Fixed-window in-memory rate limiter. Per server instance only: on serverless each instance has its
 * own counters, so this is a best-effort guard against runaway clients, not a hard global quota.
 * (A shared limiter, e.g. Upstash/Redis, is the production upgrade; see docs.)
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    return { ok: true as const, remaining: limit - 1, retryAfterSec: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false as const, remaining: 0, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true as const, remaining: limit - b.count, retryAfterSec: 0 };
}

export const resetRateLimits = () => buckets.clear();
