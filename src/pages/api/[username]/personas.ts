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

/** JSON columns stored as TEXT in the personas table */
const JSON_COLUMNS = [
  'stats',
  'stack',
  'details',
  'starred_repos',
  'employers',
  'links',
] as const;

function parseJsonColumns(row: Record<string, unknown>): Record<string, unknown> {
  const parsed = { ...row };
  for (const col of JSON_COLUMNS) {
    if (typeof parsed[col] === 'string') {
      parsed[col] = JSON.parse(parsed[col] as string);
    }
  }
  return parsed;
}

/**
 * GET /api/:username/personas
 *
 * Returns the array of persona cards for a GitHub user.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const env = locals.runtime.env as Env;
    const rawUsername = params.username ?? '';
    const username = rawUsername.toLowerCase();

    if (!isValidUsername(username)) {
      return jsonResponse({ error: 'Invalid username', username }, 400);
    }

    // Fetch personas ordered by sort_order
    const { results } = await env.DB.prepare(
      'SELECT * FROM personas WHERE username = ? ORDER BY sort_order ASC'
    )
      .bind(username)
      .all();

    if (results.length > 0) {
      return jsonResponse(results.map(parseJsonColumns));
    }

    // No personas — determine whether the profile exists at all
    const profile = await env.DB.prepare(
      'SELECT username FROM profiles WHERE username = ?'
    )
      .bind(username)
      .first();

    if (!profile) {
      return jsonResponse({ error: 'User not found', username }, 404);
    }

    // Profile exists but no personas yet — still computing
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
    console.error('GET /api/:username/personas error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
