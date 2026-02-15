/**
 * KV-based rate limiter: 1 refresh per hour per username.
 *
 * Uses KV with expiration TTL instead of Durable Objects for
 * compatibility with the Astro Cloudflare adapter.
 *
 * Reference: spec lines 948-973.
 */

const ONE_HOUR_SECONDS = 3600;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

/**
 * Check if a refresh is allowed for the given username.
 */
export async function checkRateLimit(
  kv: KVNamespace,
  username: string,
): Promise<RateLimitResult> {
  const key = `ratelimit:${username}`;
  const existing = await kv.get(key);

  if (existing) {
    const lastRefresh = parseInt(existing, 10);
    const elapsedSeconds = Math.floor((Date.now() - lastRefresh) / 1000);

    if (elapsedSeconds < ONE_HOUR_SECONDS) {
      return { allowed: false, retryAfter: ONE_HOUR_SECONDS - elapsedSeconds };
    }
  }

  return { allowed: true };
}

/**
 * Consume a rate limit token for the given username.
 * Sets a KV key with a 1-hour expiration TTL.
 */
export async function consumeRateLimit(
  kv: KVNamespace,
  username: string,
): Promise<void> {
  const key = `ratelimit:${username}`;
  await kv.put(key, String(Date.now()), { expirationTtl: ONE_HOUR_SECONDS });
}
