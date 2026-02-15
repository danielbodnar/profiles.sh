/**
 * KV cache helpers for GitHub API responses.
 *
 * KV key patterns (from spec lines 52-57):
 *   github:profile:{username}       -> GitHub user profile JSON
 *   github:repos:{username}         -> Array of owned repos
 *   github:stars:{username}:{page}  -> Paginated star pages
 *   github:stars:{username}:meta    -> { totalPages, fetchedAt, complete }
 *
 * Default TTL: 24 hours (86400 seconds).
 */

const DEFAULT_TTL = 86400; // 24 hours in seconds

/**
 * Retrieve a JSON value from KV by key.
 * Returns `null` if the key does not exist or has expired.
 */
export async function getCached<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key, "json");
  return raw as T | null;
}

/**
 * Store a JSON value in KV with a TTL (default 24 hours).
 */
export async function putCached<T>(
  kv: KVNamespace,
  key: string,
  data: T,
  ttl: number = DEFAULT_TTL,
): Promise<void> {
  await kv.put(key, JSON.stringify(data), { expirationTtl: ttl });
}
