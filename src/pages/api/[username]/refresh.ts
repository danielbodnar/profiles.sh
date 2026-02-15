import type { APIRoute } from 'astro';
import { checkRateLimit, consumeRateLimit } from '../../../lib/rate-limiter';

const USERNAME_RE = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username) && !username.includes('--');
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extraHeaders },
  });
}

/**
 * OPTIONS /api/:username/refresh
 */
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
};

/**
 * POST /api/:username/refresh
 *
 * Force a profile re-computation. Rate-limited to 1 refresh per hour per user
 * via KV-based rate limiter.
 */
export const POST: APIRoute = async ({ params, locals }) => {
  try {
    const env = locals.runtime.env as Env;
    const rawUsername = params.username ?? '';
    const username = rawUsername.toLowerCase();

    if (!isValidUsername(username)) {
      return jsonResponse({ error: 'Invalid username', username }, 400);
    }

    // ---- Rate limiter via KV ----
    const checkResult = await checkRateLimit(env.KV, username);

    if (!checkResult.allowed) {
      const retryAfter = checkResult.retryAfter ?? 3600;
      return jsonResponse(
        { error: 'Rate limited', retryAfter },
        429,
        { 'Retry-After': String(retryAfter) }
      );
    }

    // ---- Consume the rate limit token ----
    await consumeRateLimit(env.KV, username);

    // ---- Enqueue the forced refresh ----
    await env.PROFILE_QUEUE.send({
      username,
      requestedAt: Date.now(),
    });

    return jsonResponse(
      {
        status: 'queued',
        username,
        message: 'Profile refresh queued. Please retry in a few seconds.',
        eta: 15,
      },
      202
    );
  } catch (error) {
    console.error('POST /api/:username/refresh error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
