/**
 * Fixed-window in-memory rate limiter for sensitive endpoints (login, uploads,
 * exports, AI review). Per-process only: for multi-instance deployments put a
 * shared limiter (e.g. at the edge / API gateway or Redis) in front as well.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterMs: number } {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfterMs: b.resetAt - now };
  b.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}

export function resetRateLimits() {
  buckets.clear();
}
