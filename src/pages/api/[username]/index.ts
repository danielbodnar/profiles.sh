import type { APIRoute } from 'astro';
import { processUsername } from '../../../lib/queue-consumer';

/** Validate GitHub username: alphanumeric + hyphens, max 39 chars, no leading/trailing hyphens, no consecutive hyphens */
function isValidUsername(username: string): boolean {
  return /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username) && !username.includes('--');
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
 * GET /api/:username
 *
 * Returns the full computed profile for a GitHub user.
 * - If fresh (< 24h): returns full data joined across all tables.
 * - If stale: returns stale data (background refresh not available yet).
 * - If missing: computes inline via GitHub API + engine, stores in D1, then returns.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const env = locals.runtime.env as Env;
    const rawUsername = params.username ?? '';
    const username = rawUsername.toLowerCase();

    if (!isValidUsername(username)) {
      return jsonResponse({ error: 'Invalid username', username }, 400);
    }

    // ---- Check for existing profile ----
    const profile = await env.DB.prepare(
      'SELECT * FROM profiles WHERE username = ?'
    )
      .bind(username)
      .first();

    if (!profile) {
      // No profile at all — compute inline (queue consumer not available)
      try {
        await processUsername(username, env);
      } catch (err: any) {
        console.error(`Inline computation failed for ${username}:`, err);
        if (err?.message?.includes('not found')) {
          return jsonResponse({ error: 'User not found on GitHub', username }, 404);
        }
        if (err?.message?.includes('rate limit')) {
          return jsonResponse({ error: 'GitHub API rate limit exceeded. Try again later.', username }, 503);
        }
        return jsonResponse({ error: 'Failed to compute profile', username, detail: String(err?.message || err) }, 500);
      }

      // Profile now exists in D1 — fall through to the read path below
    }

    // ---- Re-fetch profile (may have just been computed above) ----
    const currentProfile = profile || await env.DB.prepare(
      'SELECT * FROM profiles WHERE username = ?'
    )
      .bind(username)
      .first();

    if (!currentProfile) {
      return jsonResponse({ error: 'Profile computation failed', username }, 500);
    }

    // ---- Determine freshness ----
    const computedAt = currentProfile.computed_at as string | null;
    const isFresh =
      computedAt != null &&
      Date.now() - new Date(computedAt).getTime() < 24 * 60 * 60 * 1000;

    // ---- Fetch related data ----
    const [personasResult, projectsResult, radarResult, interestsResult] =
      await Promise.all([
        env.DB.prepare(
          'SELECT * FROM personas WHERE username = ? ORDER BY sort_order ASC'
        )
          .bind(username)
          .all(),
        env.DB.prepare(
          'SELECT * FROM projects WHERE username = ? ORDER BY sort_order ASC'
        )
          .bind(username)
          .all(),
        env.DB.prepare(
          'SELECT * FROM radar_axes WHERE username = ? ORDER BY sort_order ASC'
        )
          .bind(username)
          .all(),
        env.DB.prepare(
          'SELECT * FROM star_interests WHERE username = ? ORDER BY sort_order ASC'
        )
          .bind(username)
          .all(),
      ]);

    // ---- Parse JSON columns ----
    const personas = personasResult.results.map((p) => ({
      ...p,
      stats: typeof p.stats === 'string' ? JSON.parse(p.stats) : p.stats,
      stack: typeof p.stack === 'string' ? JSON.parse(p.stack) : p.stack,
      details: typeof p.details === 'string' ? JSON.parse(p.details) : p.details,
      starred_repos:
        typeof p.starred_repos === 'string'
          ? JSON.parse(p.starred_repos)
          : p.starred_repos,
      employers:
        typeof p.employers === 'string' ? JSON.parse(p.employers) : p.employers,
      links: typeof p.links === 'string' ? JSON.parse(p.links) : p.links,
    }));

    const projects = projectsResult.results.map((p) => ({
      ...p,
      tech: typeof p.tech === 'string' ? JSON.parse(p.tech) : p.tech,
      persona_map:
        typeof p.persona_map === 'string'
          ? JSON.parse(p.persona_map)
          : p.persona_map,
    }));

    const radarAxes = radarResult.results;
    const starInterests = interestsResult.results;

    // Parse JSON in profile itself
    const rawProfile =
      typeof currentProfile.raw_profile === 'string'
        ? JSON.parse(currentProfile.raw_profile)
        : currentProfile.raw_profile;

    const responseBody: Record<string, unknown> = {
      profile: { ...currentProfile, raw_profile: rawProfile },
      personas,
      projects,
      radar: radarAxes,
      interests: starInterests,
    };

    if (!isFresh && profile) {
      responseBody.stale = true;
    }

    return jsonResponse(responseBody, 200);
  } catch (error) {
    console.error('GET /api/:username error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
};
