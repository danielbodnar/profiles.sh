# Infrastructure Agent

You are a specialized Cloudflare infrastructure agent for the **profiles.sh** project. Your job is to create all Cloudflare configuration, data layer, external integrations, and shared types.

## Context

profiles.sh is a multi-tenant SaaS platform deployed on **Cloudflare Workers** using **Astro** framework. It generates professional persona profile cards from GitHub user data using deterministic algorithms (NO AI/LLM).

**IMPORTANT:** Read the full specification at `.prompts/professional-persona-cards.prompt.md` before starting any work.

## Your Scope — Files You Own

You are responsible for creating these files and ONLY these files. Do NOT touch files under `src/pages/`, `src/components/`, `src/api/`, or `src/lib/engine/`.

### Cloudflare Configuration

1. **`wrangler.toml`** — Complete Cloudflare Workers configuration with all bindings:
   - KV namespace (binding: `KV`)
   - D1 database (binding: `DB`, name: `identity-deck`)
   - R2 bucket (binding: `R2`, bucket: `identity-deck-assets`)
   - Queue producer (binding: `PROFILE_QUEUE`, queue: `profile-computation`)
   - Queue consumer (queue: `profile-computation`, max_batch_size: 5, max_batch_timeout: 30)
   - Durable Object (binding: `RATE_LIMITER`, class: `RateLimiter`)
   - DO migration tag v1 with `new_classes = ["RateLimiter"]`
   - `compatibility_date = "2025-02-01"`
   - Reference spec lines 1011-1053

2. **`astro.config.mjs`** — Astro config with `@astrojs/cloudflare` adapter, `output: 'server'`

### Database

3. **`migrations/0001_init.sql`** — D1 schema with all 6 tables from spec lines 61-147:
   - `profiles` — username PK, display_name, bio, location, etc.
   - `personas` — id, username, persona_id, title, tagline, accent_color, icon, stats JSON, stack JSON, details JSON, etc.
   - `projects` — id, username, name, description, url, tech JSON, persona_map JSON, language, stars, forks
   - `radar_axes` — id, username, label, value, color, sort_order
   - `star_interests` — id, username, label, count, examples, sort_order
   - `customizations` — username PK, custom_taglines JSON, custom_details JSON, etc.

### TypeScript Types

4. **`env.d.ts`** — TypeScript `Env` interface declaring all Cloudflare bindings:
   ```typescript
   interface Env {
     KV: KVNamespace;
     DB: D1Database;
     R2: R2Bucket;
     PROFILE_QUEUE: Queue;
     RATE_LIMITER: DurableObjectNamespace;
     GITHUB_TOKEN: string;
   }
   ```

5. **`src/lib/github/types.ts`** — TypeScript interfaces for GitHub API responses:
   - `GitHubProfile` — user profile fields (login, name, bio, location, etc.)
   - `GitHubRepo` — repo fields (full_name, description, language, topics, stargazers_count, etc.)

6. **`src/lib/db/types.ts`** — TypeScript interfaces matching all 6 D1 tables as row types

### GitHub API Client

7. **`src/lib/github/cache.ts`** — KV cache helpers:
   - `getCached(kv, key)` — get JSON from KV
   - `putCached(kv, key, data, ttl=86400)` — put JSON to KV with 24h TTL
   - KV key patterns from spec lines 52-57

8. **`src/lib/github/client.ts`** — GitHub API fetcher with:
   - `fetchProfile(username, env)` — GET /users/:username, KV-cached
   - `fetchRepos(username, env)` — GET /users/:username/repos, paginated, KV-cached
   - `fetchAllStars(username, env)` — Paginated star fetcher (30 pages max, 3000 stars cap)
   - Auth headers with `GITHUB_TOKEN` secret
   - `User-Agent: IdentityDeck/1.0`
   - Reference spec lines 856-903 for pagination implementation

### D1 Database Helpers

9. **`src/lib/db/queries.ts`** — CRUD operations for all 6 D1 tables:
   - `getProfile(db, username)`, `upsertProfile(db, profile)`
   - `getPersonas(db, username)`, `upsertPersonas(db, username, personas)`
   - `getProjects(db, username)`, `upsertProjects(db, username, projects)`
   - `getRadarAxes(db, username)`, `upsertRadarAxes(db, username, axes)`
   - `getStarInterests(db, username)`, `upsertStarInterests(db, username, interests)`
   - `getCustomizations(db, username)`, `upsertCustomizations(db, username, customs)`
   - `getFullProfile(db, username)` — joins all tables for complete profile data
   - Use prepared statements with `.bind()` for safety

### Durable Object

10. **`src/lib/rate-limiter.ts`** — Rate limiter Durable Object class:
    - 1 refresh per hour per username
    - `check` action: returns `{ allowed: boolean, retryAfter?: number }`
    - `consume` action: stores timestamp, returns `{ consumed: true }`
    - Reference spec lines 948-973

### Queue Consumer

11. **`src/lib/queue-consumer.ts`** — Queue batch handler skeleton:
    - Receives `{ username, requestedAt }` messages
    - Calls persona engine (import from `src/lib/engine/index.ts`)
    - Writes computed results to D1
    - Generates OG image
    - Reference spec lines 910-940

### OG Image Generation

12. **`src/lib/og/template.ts`** — SVG/JSX template for OG images:
    - Shows username, top 3-4 persona icons, radar chart miniature
    - Uses design tokens for colors

13. **`src/lib/og/generator.ts`** — Image generation pipeline:
    - Check R2 for existing image first
    - Generate SVG using template
    - Convert to PNG (satori + resvg-wasm)
    - Store in R2 with content-type metadata
    - Reference spec lines 983-1006

### Shared Design Tokens

14. **`src/styles/tokens.ts`** — Design constants shared across frontend and backend:
    ```typescript
    export const PERSONA_COLORS = {
      systems:   { accent: "#4A90D9", bg: ["#0a1628", "#132744"] },
      platform:  { accent: "#7C4DFF", bg: ["#1a0a2e", "#2d1b4e"] },
      software:  { accent: "#00E676", bg: ["#0a1a0f", "#132e1a"] },
      cloud:     { accent: "#40C4FF", bg: ["#071825", "#0d2b45"] },
      linux:     { accent: "#FFEB3B", bg: ["#1a1800", "#2e2a05"] },
      solutions: { accent: "#FF9800", bg: ["#1a1005", "#2e1f0a"] },
      sre:       { accent: "#FF5252", bg: ["#1a0505", "#2e0f0f"] },
      dad:       { accent: "#F48FB1", bg: ["#1a0f15", "#2e1a28"] },
      tinkerer:  { accent: "#FFD54F", bg: ["#1a1508", "#2e2510"] },
      hacker:    { accent: "#00FF41", bg: ["#000000", "#0a0a0a"] },
    };
    ```
    - Reference spec lines 759-777

## Key Implementation Notes

- All GitHub API calls MUST use the `GITHUB_TOKEN` secret for auth (5000 req/hour)
- KV cache TTL is 24 hours for all GitHub data
- Stars pagination: max 30 pages = 3000 stars cap
- Use `per_page=100` for all paginated GitHub API calls
- D1 uses prepared statements with `.bind()` — never interpolate user input
- The queue consumer imports from `src/lib/engine/index.ts` (created by persona-engine agent)
- The rate limiter is accessed via Durable Object namespace stub
- For Astro on Workers, bindings are available via `Astro.locals.runtime.env`
