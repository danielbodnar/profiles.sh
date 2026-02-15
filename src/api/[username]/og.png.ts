import type { APIRoute } from 'astro';

const USERNAME_RE = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username) && !username.includes('--');
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST',
  'Cache-Control': 'public, max-age=3600',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/**
 * GET /api/:username/og.png
 *
 * Returns the Open Graph image for a GitHub user's profile.
 * - Checks R2 for a cached image first.
 * - If not cached, generates one from the profile data, stores it in R2, and returns it.
 * - Returns 404 / 202 if the profile does not exist or is still computing.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const env = locals.runtime.env as Env;
    const rawUsername = params.username ?? '';
    const username = rawUsername.toLowerCase();

    if (!isValidUsername(username)) {
      return jsonResponse({ error: 'Invalid username', username }, 400);
    }

    const r2Key = `og/${username}.png`;

    // ---- Check R2 for existing OG image ----
    const existing = await env.R2.get(r2Key);
    if (existing) {
      const imageData = await existing.arrayBuffer();
      return new Response(imageData, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // ---- No cached image — check if profile exists ----
    const profile = await env.DB.prepare(
      'SELECT * FROM profiles WHERE username = ?'
    )
      .bind(username)
      .first();

    if (!profile) {
      return jsonResponse({ error: 'User not found', username }, 404);
    }

    // ---- Profile exists — fetch personas for the OG card ----
    const { results: personas } = await env.DB.prepare(
      'SELECT title, tagline, accent_color, icon FROM personas WHERE username = ? ORDER BY sort_order ASC'
    )
      .bind(username)
      .all();

    // Dynamically import the OG generator (it may not exist yet — this is
    // the contract the API layer expects from the OG module).
    const { generateOGImage } = await import('../../lib/og/generator');

    const result = await generateOGImage(profile as any, personas as any[], { R2: env.R2 });

    // generateOGImage returns Uint8Array (PNG) or string (SVG fallback)
    if (typeof result === 'string') {
      // SVG fallback — store and return as SVG
      await env.R2.put(r2Key.replace('.png', '.svg'), result, {
        httpMetadata: { contentType: 'image/svg+xml' },
      });

      return new Response(result, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // PNG result — store in R2 for future requests
    await env.R2.put(r2Key, result, {
      httpMetadata: { contentType: 'image/png' },
    });

    return new Response(result, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('GET /api/:username/og.png error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};
