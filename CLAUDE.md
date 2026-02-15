# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Identity Deck** is a multi-tenant SaaS platform that generates professional persona profile cards from any GitHub user's data. It uses deterministic algorithms (topic matching, language analysis, repo metadata parsing, star pattern clustering) to assign "career personas" — **NO AI/LLM API calls**.

Deployed on **Cloudflare Workers** using **Astro** (SSR mode) with D1, KV, R2, Queues, and Durable Objects.

## Scaffolding

The project is scaffolded with:
```bash
bun create cloudflare@latest identity-deck --framework=astro
```

## Build & Dev Commands

```bash
bun run dev          # Local dev server (Astro + Wrangler)
bun run build        # Production build (astro build)
bun run deploy       # Build + deploy to Cloudflare Workers (astro build && wrangler deploy)
```

### Cloudflare Resource Management

```bash
wrangler d1 execute identity-deck --local --file=./migrations/0001_init.sql   # Apply D1 migrations locally
wrangler d1 execute identity-deck --file=./migrations/0001_init.sql           # Apply D1 migrations remotely
wrangler secret put GITHUB_TOKEN                                              # Set GitHub API token
```

## Architecture

### Specification & Design References

- `.prompts/professional-persona-cards.prompt.md` — Complete 1115-line specification with all algorithms, schemas, API definitions, and design system
- `.prompts/compact-persona-card.tsx` — Reference for **card style** (152px compact cards with modal detail view)
- `.prompts/professional-persona-cards.tsx` — Reference for **page layout** (header, 320px radar chart, star interest tiles, project section, footer)

The frontend uses a **hybrid design**: compact card style from the compact TSX + overall page layout from the professional TSX.

### Agent-Based Implementation

Implementation is split across 4 specialized agents under `.claude/agents/`:

| Agent | Scope | Directory |
|-------|-------|-----------|
| `infrastructure` | Cloudflare config, D1/KV/R2/Queue/DO, GitHub client, OG images, design tokens | `wrangler.jsonc`, `migrations/`, `src/lib/github/`, `src/lib/db/`, `src/lib/og/`, `src/lib/rate-limiter.ts`, `src/lib/queue-consumer.ts`, `src/styles/tokens.ts` |
| `persona-engine` | Deterministic scoring algorithms — pure functions, zero CF deps | `src/lib/engine/` |
| `api-layer` | Astro API route handlers | `src/api/[username]/` |
| `frontend-ui` | Astro pages, components, layouts, styles | `src/pages/`, `src/components/`, `src/layouts/`, `src/styles/global.css` |

Each agent owns distinct files. Read the agent's `.md` file before working in its domain.

### Persona Engine (Core Algorithm)

The engine in `src/lib/engine/` is the heart of the system. Key flow:

1. **Domain scoring** — Score each starred/owned repo against 9 domain buckets (systems, platform, software, cloud, linux, solutions, sre, tinkerer, hacker) using language (+2), topic (+3), description keyword (+1.5), name keyword (+1). Owned repos get 3x multiplier.
2. **Radar normalization** — Scale to 40-100 range (min 40 if any signal)
3. **Persona activation** — Threshold >= 45 normalized score
4. **Star interest clustering** — 12 matchers, min 2 repos per cluster
5. **Project mapping** — Map owned repos to persona domains (score >= 2)
6. **Experience estimation** — Account age + score ratio determines title prefix (Principal/Staff/Senior)

All engine functions are **pure** — no side effects, no network calls, no Cloudflare bindings.

### Cloudflare Bindings

Access in Astro routes via `Astro.locals.runtime.env`:

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KVNamespace | GitHub API response cache (24h TTL) |
| `DB` | D1Database | Profiles, personas, projects, radar, interests, customizations |
| `R2` | R2Bucket | OG images (`og/{username}.png`) |
| `PROFILE_QUEUE` | Queue | Background profile computation |
| `RATE_LIMITER` | DurableObjectNamespace | 1 refresh/hour/user |
| `GITHUB_TOKEN` | string (secret) | GitHub API auth (5000 req/hour) |

### D1 Schema (6 tables)

`profiles`, `personas`, `projects`, `radar_axes`, `star_interests`, `customizations` — defined in `migrations/0001_init.sql`. JSON columns stored as TEXT, parsed on read.

### API Response Patterns

- `200` — Data found and fresh
- `202` — Profile being computed (client should poll)
- `404` — GitHub user not found
- `429` — Rate limited (refresh endpoint)

## Key Constraints

- Stars pagination: max 30 pages (3000 stars cap), `per_page=100`
- D1 queries use prepared statements with `.bind()` — never interpolate user input
- The "dad" persona is an easter egg — not auto-detected, manually opted-in only
- Frontend modals use vanilla JS `<script>` tags — no framework islands
- Cloudflare **Workers** only (NOT Pages, which is deprecated)
