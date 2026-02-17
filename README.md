<div align="center">

# profiles.sh

### Professional Persona Cards from GitHub Data

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Astro](https://img.shields.io/badge/Astro-5-BC52EE?logo=astro&logoColor=white)](https://astro.build/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-Runtime-fbf0df?logo=bun&logoColor=000)](https://bun.sh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Generate beautiful, interactive **career persona trading cards** from any GitHub profile — entirely deterministic, no AI/LLM APIs involved.

[Live Demo](#) · [API Docs](#api-reference) · [Self-Host Guide](#deployment)

</div>

---

## What It Does

profiles.sh analyzes a GitHub user's **starred repos**, **owned repos**, and **profile metadata** to automatically generate a set of career persona cards — each representing a facet of their professional identity.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   User visits /:username                                        │
│     → Fetch GitHub data (profile, repos, stars)                 │
│     → Score against 9 domain buckets                            │
│     → Activate matching personas (threshold ≥ 45)               │
│     → Generate persona cards, radar chart, project mappings     │
│     → Render full profiles.sh page                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### The 9 Persona Domains

| Persona | Color | Signal Sources |
|---------|-------|----------------|
| ⚙️ **Systems Engineer** | ![#4A90D9](https://placehold.co/12x12/4A90D9/4A90D9.png) `#4A90D9` | C, C++, Rust, Zig, kernel, systemd, hypervisor, database |
| 🔗 **Platform Engineer** | ![#7C4DFF](https://placehold.co/12x12/7C4DFF/7C4DFF.png) `#7C4DFF` | HCL, Terraform, Kubernetes, Docker, CI/CD, GitOps |
| λ **Software Engineer** | ![#00E676](https://placehold.co/12x12/00E676/00E676.png) `#00E676` | TypeScript, Rust, Go, Python, frameworks, compilers |
| ☁️ **Cloud Architect** | ![#40C4FF](https://placehold.co/12x12/40C4FF/40C4FF.png) `#40C4FF` | AWS, Cloudflare, serverless, multi-cloud, VPN |
| 🐧 **Linux Enthusiast** | ![#FFEB3B](https://placehold.co/12x12/FFEB3B/FFEB3B.png) `#FFEB3B` | Shell, Nushell, Hyprland, systemd, dotfiles |
| 🌉 **Solutions Engineer** | ![#FF9800](https://placehold.co/12x12/FF9800/FF9800.png) `#FF9800` | OpenAPI, architecture, microservices, documentation |
| 📟 **SRE** | ![#FF5252](https://placehold.co/12x12/FF5252/FF5252.png) `#FF5252` | Monitoring, Grafana, Prometheus, security, zero-trust |
| 🔧 **Chronic Tinkerer** | ![#FFD54F](https://placehold.co/12x12/FFD54F/FFD54F.png) `#FFD54F` | IoT, e-ink, AI/ML, side projects, experiments |
| >_ **Old School Hacker** | ![#00FF41](https://placehold.co/12x12/00FF41/00FF41.png) `#00FF41` | Neovim, vim, terminal emulators, RSS, retro |

---

## Screenshots

### Landing Page
```
┌──────────────────────────────────────────────┐
│                                              │
│            PROFILES.SH                     │
│                                              │
│     Professional Persona Cards               │
│                                              │
│  Generate career persona trading cards       │
│  from any GitHub profile                     │
│                                              │
│  ┌────────────────────────────────────┐      │
│  │  Enter GitHub username...          │      │
│  └────────────────────────────────────┘      │
│                                              │
│          Try: danielbodnar                   │
│                                              │
└──────────────────────────────────────────────┘
```

### Profile Page Layout
```
┌──────────────────────────────────────────────────────────────────────┐
│                          PROFILES.SH                               │
│                          Daniel Bodnar                                │
│           Platform · Systems · SRE · Linux Evangelist                │
│                                                                      │
│                     ╱╲   SKILL RADAR   ╱╲                            │
│                   ╱    ╲             ╱    ╲                           │
│                 ╱  92    ╲    96   ╱  95    ╲                         │
│               ╱────────────╲────╱────────────╲                       │
│                 Linux 99  ╱  ╲  Cloud 94                             │
│                         ╱      ╲                                     │
│                                                                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ ⚙️      │ │ 🔗      │ │ λ       │ │ ☁️      │ │ 🐧      │      │
│  │ Systems │ │Platform │ │Software │ │ Cloud   │ │ Linux   │      │
│  │ Engr    │ │ Engr    │ │ Engr    │ │Architect│ │Evanglst │      │
│  │         │ │         │ │         │ │         │ │         │      │
│  │ ████ 98 │ │ ████ 96 │ │ ████ 95 │ │ ████ 97 │ │ ████100 │      │
│  │ ███  95 │ │ ████ 98 │ │ ████ 95 │ │ ███  94 │ │ ████ 97 │      │
│  │ ███  92 │ │ ███  94 │ │ ███  93 │ │ ████ 96 │ │ ████ 99 │      │
│  │ ████ 97 │ │ ███  93 │ │ ████ 99 │ │ ████ 95 │ │ ████100 │      │
│  │         │ │         │ │         │ │         │ │         │      │
│  │[details]│ │[details]│ │[details]│ │[details]│ │[details]│      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
│                                                                      │
│                     ── Featured Projects ──                          │
│                          The Work                                    │
│                                                                      │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐     │
│  │▌ ngfw.sh         │ │▌ BitBuilder      │ │▌ bbctl           │     │
│  │▌ Cloud firewall  │ │▌ Hypervisor      │ │▌ Infra CLI       │     │
│  │▌ admin on Edge   │ │▌ Git-based       │ │▌ in Rust         │     │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘     │
│                                                                      │
│     click cards to open details · Arctic Code Vault Contributor      │
└──────────────────────────────────────────────────────────────────────┘
```

### Persona Card Detail Modal
```
┌────────────────────────────────────────────────┐
│                                                │
│  ┌──────┐  Principal Systems Engineer          │
│  │  ⚙️  │  "I speak fluent syscall."           │
│  └──────┘  25+ years · 1999 - Present          │
│                                                │
│  Stats                                         │
│  Architecture  ██████████████████████████  98   │
│  Debugging     █████████████████████████   95   │
│  Scale         ████████████████████████    92   │
│  Uptime        ██████████████████████████  97   │
│                                                │
│  Stack                                         │
│  [Linux] [systemd] [PostgreSQL] [ZFS]          │
│  [Bare Metal] [Kernel Tuning] [Proxmox]        │
│                                                │
│  Field Notes                                   │
│  ● 3.5TB+ PostgreSQL cluster management        │
│  ● Consolidated 30+ bare-metal servers         │
│  ● 56G InfiniBand FC SAN on Proxmox/ZFS       │
│  ● Kernel-level optimizations                  │
│                                                │
│  Employers                                     │
│  Fidelity • Animal Care Tech • BitBuilder      │
│                                                │
│                   ✕ close                       │
└────────────────────────────────────────────────┘
```

---

## Architecture

```
                    ┌─────────────────────────────────┐
                    │        Cloudflare Workers         │
                    │    ┌─────────────────────────┐   │
                    │    │    Astro SSR (Pages)     │   │
  User Request ────▶│    │    + API Routes          │   │
                    │    └────────┬────────────────┘   │
                    │             │                     │
                    │    ┌────────▼────────────────┐   │
                    │    │    Persona Engine        │   │
                    │    │    (deterministic)       │   │
                    │    │                          │   │
                    │    │  ┌─ Domain Scoring ──┐   │   │
                    │    │  │  9 domain buckets │   │   │
                    │    │  │  lang/topic/desc  │   │   │
                    │    │  └───────────────────┘   │   │
                    │    │  ┌─ Radar Normalize ─┐   │   │
                    │    │  │  Scale to 40-100  │   │   │
                    │    │  └───────────────────┘   │   │
                    │    │  ┌─ Persona Activate ─┐  │   │
                    │    │  │  Threshold ≥ 45    │  │   │
                    │    │  └───────────────────┘   │   │
                    │    └────────┬────────────────┘   │
                    │             │                     │
                    │    ┌────────▼────────┐           │
                    │    │   GitHub API    │──▶ KV     │
                    │    │   (paginated)   │   (cache) │
                    │    └────────┬────────┘           │
                    │             │                     │
                    │    ┌────────▼────────┐           │
                    │    │      D1         │           │
                    │    │   (profiles,    │           │
                    │    │    personas,    │           │
                    │    │    projects)    │           │
                    │    └─────────────────┘           │
                    │                                   │
                    │    ┌──────────┐  ┌────────────┐  │
                    │    │   R2     │  │  Durable   │  │
                    │    │ (images) │  │  Objects   │  │
                    │    └──────────┘  │(rate limit)│  │
                    │                  └────────────┘  │
                    │    ┌──────────┐                   │
                    │    │  Queue   │                   │
                    │    │(bg jobs) │                   │
                    │    └──────────┘                   │
                    └─────────────────────────────────┘
```

### Cloudflare Products

| Product | Binding | Purpose |
|---------|---------|---------|
| **Workers** | — | API endpoints, SSR, persona computation |
| **KV** | `KV` | Cache GitHub API responses (24h TTL) |
| **D1** | `DB` | Persistent storage for profiles, personas, projects |
| **R2** | `R2` | Store generated OG images |
| **Durable Objects** | `RATE_LIMITER` | Rate limiting (1 refresh/hour/user) |
| **Queues** | `PROFILE_QUEUE` | Background processing for large profiles |

### D1 Schema

```sql
profiles        — username PK, GitHub metadata, computed_at timestamp
personas        — persona cards with stats, stack, details (JSON columns)
projects        — owned repos mapped to persona domains
radar_axes      — normalized skill radar values (0-100)
star_interests  — clustered star interest groups
customizations  — user overrides (taglines, hidden personas, themes)
```

---

## Scoring Algorithm

The persona engine uses **deterministic scoring** — no AI, no LLM, no randomness.

```
For each starred repo:
  ├── Language match:           +2 points
  ├── Topic match:              +3 points × matching topics
  ├── Description keyword:      +1.5 points × matching keywords
  └── Repo name keyword:        +1 point × matching keywords

For each owned repo:
  └── Same scoring × 3 (3x multiplier)

Normalization:
  └── Scale to 40-100 range (min 40 if any signal detected)

Persona activation:
  └── Normalized score ≥ 45 → persona is active
```

### Experience Level Detection

```
Account Age + Score Ratio → Title Prefix

  ratio > 0.85 && age > 8 years → "Principal"
  ratio > 0.70 && age > 5 years → "Staff"
  ratio > 0.50 && age > 3 years → "Senior"
  ratio > 0.30                  → (no prefix)
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Cloudflare account](https://dash.cloudflare.com/) with Workers plan
- [GitHub personal access token](https://github.com/settings/tokens) (for API rate limits)

### Installation

```bash
# Clone the repository
git clone https://github.com/danielbodnar/professional-persona-cards.git
cd professional-persona-cards

# Install dependencies
bun install

# Set up Cloudflare resources
wrangler d1 create identity-deck
wrangler kv namespace create KV
wrangler r2 bucket create identity-deck-assets
wrangler queues create profile-computation

# Update wrangler.jsonc with your resource IDs from the commands above

# Apply D1 migrations
wrangler d1 execute identity-deck --local --file=./migrations/0001_init.sql

# Set GitHub token
wrangler secret put GITHUB_TOKEN
# Paste your GitHub personal access token when prompted

# Start development server
bun run dev
```

### Development

```bash
bun run dev       # Start local dev server with Wrangler
bun run build     # Production build
bun run preview   # Preview production build locally
```

---

## API Reference

All endpoints return JSON with appropriate CORS headers.

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/api/:username` | Full computed profile | `200` data / `202` computing / `404` not found |
| `GET` | `/api/:username/personas` | Persona cards only | `200` / `404` |
| `GET` | `/api/:username/projects` | Project cards only | `200` / `404` |
| `GET` | `/api/:username/radar` | Radar chart data | `200` / `404` |
| `GET` | `/api/:username/interests` | Star interest clusters | `200` / `404` |
| `GET` | `/api/:username/og.png` | OG image (PNG) | `200` image / `404` |
| `POST` | `/api/:username/refresh` | Force re-computation | `202` queued / `429` rate limited |

### Response Examples

<details>
<summary><code>GET /api/danielbodnar/radar</code></summary>

```json
[
  { "label": "Rust/Systems", "value": 92, "color": "#4A90D9" },
  { "label": "Platform/IaC", "value": 96, "color": "#7C4DFF" },
  { "label": "TypeScript/JS", "value": 95, "color": "#00E676" },
  { "label": "Cloud/Infra", "value": 94, "color": "#40C4FF" },
  { "label": "Linux/Desktop", "value": 99, "color": "#FFEB3B" },
  { "label": "Security", "value": 85, "color": "#FF5252" },
  { "label": "AI/LLM", "value": 88, "color": "#FFD54F" },
  { "label": "Neovim/Editor", "value": 90, "color": "#00FF41" }
]
```

</details>

<details>
<summary><code>GET /api/danielbodnar/interests</code></summary>

```json
[
  { "label": "Rust Ecosystem", "count": "20+ repos", "examples": "ecdysis, zerobrew, envelope, keyless, monty" },
  { "label": "Nushell Ecosystem", "count": "15+ repos", "examples": "reedline, nu-plugins, sessions.nu, topiary-nushell" },
  { "label": "AI & LLM", "count": "15+ repos", "examples": "Claude Code, OpenCode, agent-skills, clother, beads" },
  { "label": "Neovim & Editor", "count": "12+ repos", "examples": "mini.nvim, lspsaga, neo-tree, dashboard-nvim" }
]
```

</details>

### Frontend Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page with search box |
| `/:username` | Full profiles.sh profile page |
| `/:username/card/:id` | Single persona card (shareable) |
| `/:username/embed` | Embeddable widget (iframe-friendly) |

---

## Deployment

```bash
# Build and deploy to Cloudflare Workers
bun run deploy

# Or manually:
astro build && wrangler deploy
```

The application deploys as a single Cloudflare Worker with static assets. The Astro `@astrojs/cloudflare` adapter handles SSR routing, API endpoints, and static asset serving.

### Environment Variables

| Variable | Type | Description |
|----------|------|-------------|
| `GITHUB_TOKEN` | Secret | GitHub personal access token (5000 req/hour) |

---

## Project Structure

```
├── .claude/agents/          # Specialized Claude agent definitions
│   ├── infrastructure.md    # Cloudflare config, data layer, GitHub client
│   ├── persona-engine.md    # Deterministic scoring algorithms
│   ├── api-layer.md         # API route handlers
│   └── frontend-ui.md       # Pages, components, styles
├── .prompts/                # Design specification & reference prototypes
│   ├── professional-persona-cards.prompt.md  # Full 1115-line spec
│   ├── compact-persona-card.tsx              # Compact card reference
│   └── professional-persona-cards.tsx        # Full page layout reference
├── migrations/
│   └── 0001_init.sql        # D1 schema (6 tables)
├── src/
│   ├── api/[username]/      # API route handlers
│   ├── components/          # Astro UI components
│   ├── layouts/             # Page layouts
│   ├── lib/
│   │   ├── engine/          # Pure persona computation functions
│   │   ├── github/          # GitHub API client + KV caching
│   │   ├── db/              # D1 query helpers
│   │   └── og/              # OG image generation pipeline
│   ├── pages/               # Astro page routes
│   └── styles/              # Global CSS + design tokens
├── astro.config.mjs         # Astro + Cloudflare Workers adapter
├── wrangler.jsonc            # Cloudflare Workers configuration (JSONC format)
└── env.d.ts                 # TypeScript environment declarations
```

---

## Design System

### Color Palette

The dark theme uses a near-black background with accent colors per persona domain:

```
Background:    linear-gradient(180deg, #08080c → #0e0e14 → #08080c)
Card Surface:  linear-gradient(135deg, #0c0c14 → #111119)
Typography:    System monospace stack
```

| Domain | Accent | Background Gradient |
|--------|--------|---------------------|
| Systems | `#4A90D9` | `#0a1628 → #132744` |
| Platform | `#7C4DFF` | `#1a0a2e → #2d1b4e` |
| Software | `#00E676` | `#0a1a0f → #132e1a` |
| Cloud | `#40C4FF` | `#071825 → #0d2b45` |
| Linux | `#FFEB3B` | `#1a1800 → #2e2a05` |
| Solutions | `#FF9800` | `#1a1005 → #2e1f0a` |
| SRE | `#FF5252` | `#1a0505 → #2e0f0f` |
| Tinkerer | `#FFD54F` | `#1a1508 → #2e2510` |
| Hacker | `#00FF41` | `#000000 → #0a0a0a` |

### Component Dimensions

| Component | Size | Details |
|-----------|------|---------|
| Persona Card | 152px wide | Compact with accent bar, stat bars, stack badges |
| Project Card | 340px wide | 6px left stripe gradient, tech badges |
| Radar Chart | 320×320 SVG | 4 concentric grids, colored data points |
| Star Interest Tile | 230px wide | Label, count badge, examples |
| Persona Modal | 460px wide | Full detail view with backdrop blur |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Read the relevant agent definition in `.claude/agents/` for your area
4. Commit your changes (`git commit -m 'Add some feature'`)
5. Push to the branch (`git push origin feature/your-feature`)
6. Open a Pull Request

---

## License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.

---

<div align="center">

**Built with [Astro](https://astro.build/) + [Cloudflare Workers](https://workers.cloudflare.com/)**

*No AI was harmed in the scoring of these personas.*

</div>
