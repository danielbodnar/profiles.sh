import type { APIRoute } from 'astro';

const USERNAME_RE = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username) && !username.includes('--');
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * GET /api/:username/og.png
 *
 * Returns the Open Graph image (SVG) for a GitHub user's profile.
 * Checks R2 for a cached image first, otherwise generates from profile data.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const env = locals.runtime.env as Env;
    const rawUsername = params.username ?? '';
    const username = rawUsername.toLowerCase();

    if (!isValidUsername(username)) {
      return jsonResponse({ error: 'Invalid username', username }, 400);
    }

    // ---- Check if profile exists ----
    const profile = await env.DB.prepare(
      'SELECT * FROM profiles WHERE username = ?'
    )
      .bind(username)
      .first();

    if (!profile) {
      return jsonResponse({ error: 'User not found', username }, 404);
    }

    // ---- Fetch personas for the OG card ----
    const { results: personas } = await env.DB.prepare(
      'SELECT persona_id, title, tagline, accent_color, icon, confidence FROM personas WHERE username = ? ORDER BY sort_order ASC'
    )
      .bind(username)
      .all();

    const { generateOGImage } = await import('../../../lib/og/generator');
    const svg = await generateOGImage(profile as any, personas as any[], { R2: env.R2 });

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('GET /api/:username/og.png error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
