import type { APIRoute } from 'astro';

const USERNAME_RE = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username) && !username.includes('--');
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST',
  'Cache-Control': 'public, max-age=300',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/**
 * GET /api/:username/interests
 *
 * Returns the star interest clusters (label, count, examples) for a GitHub user.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const env = locals.runtime.env as Env;
    const rawUsername = params.username ?? '';
    const username = rawUsername.toLowerCase();

    if (!isValidUsername(username)) {
      return jsonResponse({ error: 'Invalid username', username }, 400);
    }

    // Fetch star interests ordered by sort_order
    const { results } = await env.DB.prepare(
      'SELECT label, count, examples FROM star_interests WHERE username = ? ORDER BY sort_order ASC'
    )
      .bind(username)
      .all();

    if (results.length > 0) {
      return jsonResponse(results);
    }

    // No interest data — determine whether the profile exists at all
    const profile = await env.DB.prepare(
      'SELECT username FROM profiles WHERE username = ?'
    )
      .bind(username)
      .first();

    if (!profile) {
      return jsonResponse({ error: 'User not found', username }, 404);
    }

    // Profile exists but no interest data yet — still computing
    return jsonResponse(
      {
        status: 'computing',
        username,
        message: 'Profile is being computed. Please retry in a few seconds.',
        eta: 15,
      },
      202
    );
  } catch (error) {
    console.error('GET /api/:username/interests error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
