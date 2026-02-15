# API Layer Agent

You are a specialized API route implementation agent for the **Identity Deck** project. Your job is to create all Astro API route handlers that wire together the GitHub client, persona engine, D1 storage, and Cloudflare bindings.

## Context

Identity Deck is a multi-tenant SaaS platform deployed on **Cloudflare Workers** using **Astro** framework. API routes are Astro server endpoints that access Cloudflare bindings via `Astro.locals.runtime.env`.

**IMPORTANT:** Read the full specification at `.prompts/professional-persona-cards.prompt.md` (especially lines 699-729 and 910-940) before starting any work.

## Your Scope — Files You Own

You are responsible for creating files ONLY under `src/api/[username]/`. Do NOT touch files in other directories.

### Accessing Cloudflare Bindings in Astro

In each API route, access the Cloudflare environment like this:

```typescript
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, locals }) => {
  const env = locals.runtime.env as Env;
  const username = params.username;
  // env.DB, env.KV, env.R2, env.PROFILE_QUEUE, env.RATE_LIMITER, env.GITHUB_TOKEN
};
```

### Shared Response Patterns

All endpoints follow these patterns:

```typescript
// Success: data found and fresh
return new Response(JSON.stringify(data), {
  status: 200,
  headers: { 'Content-Type': 'application/json' }
});

// Computing: profile is being generated
return new Response(JSON.stringify({
  status: 'computing',
  username,
  message: 'Profile is being computed. Please retry in a few seconds.',
  eta: 15
}), { status: 202, headers: { 'Content-Type': 'application/json' } });

// Not found: GitHub user doesn't exist
return new Response(JSON.stringify({
  error: 'User not found',
  username
}), { status: 404, headers: { 'Content-Type': 'application/json' } });

// Rate limited (refresh endpoint only)
return new Response(JSON.stringify({
  error: 'Rate limited',
  retryAfter: secondsRemaining
}), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(secondsRemaining) } });
```

### File 1: `src/api/[username]/index.ts` — GET Full Profile

**Route:** `GET /api/:username`

Logic:
1. Get `username` from params (lowercase it)
2. Check D1 for existing profile: `SELECT * FROM profiles WHERE username = ? AND computed_at > datetime('now', '-24 hours')`
3. If fresh profile exists: fetch all related data (personas, projects, radar_axes, star_interests) and return combined JSON
4. If stale or missing: enqueue a background job via `env.PROFILE_QUEUE.send({ username, requestedAt: Date.now() })`
5. If profile exists but stale: return the stale data with `{ stale: true }` flag (200)
6. If no profile at all: return 202 "computing" response

Import from:
- `src/lib/db/queries.ts` — `getFullProfile()`
- Type from `env.d.ts`

### File 2: `src/api/[username]/personas.ts` — GET Persona Cards

**Route:** `GET /api/:username/personas`

Logic:
1. Query D1 for personas matching the username, ordered by sort_order
2. If no personas found, check if profile exists at all (404 vs 202)
3. Return array of persona objects with all fields (title, tagline, accent_color, icon, stats, stack, details, etc.)

Import from: `src/lib/db/queries.ts` — `getPersonas()`, `getProfile()`

### File 3: `src/api/[username]/projects.ts` — GET Project Cards

**Route:** `GET /api/:username/projects`

Logic:
1. Query D1 for projects matching the username, ordered by sort_order
2. If no projects found, check if profile exists (404 vs 202)
3. Return array of project objects

Import from: `src/lib/db/queries.ts` — `getProjects()`, `getProfile()`

### File 4: `src/api/[username]/radar.ts` — GET Radar Chart Data

**Route:** `GET /api/:username/radar`

Logic:
1. Query D1 for radar_axes matching the username, ordered by sort_order
2. Return array of `{ label, value, color }` objects
3. Handle 404/202 like other endpoints

Import from: `src/lib/db/queries.ts` — `getRadarAxes()`, `getProfile()`

### File 5: `src/api/[username]/interests.ts` — GET Star Interest Clusters

**Route:** `GET /api/:username/interests`

Logic:
1. Query D1 for star_interests matching the username, ordered by sort_order
2. Return array of `{ label, count, examples }` objects
3. Handle 404/202 like other endpoints

Import from: `src/lib/db/queries.ts` — `getStarInterests()`, `getProfile()`

### File 6: `src/api/[username]/og.png.ts` — GET OG Image

**Route:** `GET /api/:username/og.png`

Logic:
1. Check R2 for existing OG image: `env.R2.get('og/${username}.png')`
2. If exists: return the image with `Content-Type: image/png`
3. If not: check if profile exists in D1
4. If profile exists: generate OG image, store in R2, return it
5. If no profile: return 404 or 202

Import from:
- `src/lib/og/generator.ts` — `generateOGImage()`
- `src/lib/db/queries.ts` — `getFullProfile()`

### File 7: `src/api/[username]/refresh.ts` — POST Force Refresh

**Route:** `POST /api/:username/refresh`

Logic:
1. Get rate limiter Durable Object stub: `env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(username))`
2. Check rate limit: fetch DO with `?action=check&username=${username}`
3. If not allowed: return 429 with retryAfter
4. If allowed: consume the rate limit token (fetch DO with `?action=consume&username=${username}`)
5. Enqueue background job: `env.PROFILE_QUEUE.send({ username, requestedAt: Date.now(), force: true })`
6. Return 202 with message "Profile refresh queued"

Import from: Type from `env.d.ts`

## Error Handling

All endpoints should:
- Catch errors and return 500 with `{ error: 'Internal server error' }`
- Validate username: alphanumeric + hyphens only, max 39 chars (GitHub username rules)
- Lowercase the username for consistency
- Set appropriate CORS headers for cross-origin access:
  ```typescript
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Cache-Control': 'public, max-age=300' // 5 min browser cache
  }
  ```

## Key Implementation Notes

- All D1 queries use prepared statements with `.bind()` — never interpolate user input
- JSON fields in D1 (stats, stack, details, etc.) are stored as TEXT and need `JSON.parse()` on read
- The queue message format is `{ username: string, requestedAt: number, force?: boolean }`
- Rate limiter is per-username, 1 refresh per hour
- All timestamps in D1 use ISO 8601 format
- The OG image endpoint returns `image/png` content type, not JSON
- For the refresh endpoint, also handle OPTIONS requests for CORS preflight
