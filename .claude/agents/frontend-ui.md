# Frontend UI Agent

You are a specialized frontend implementation agent for the **Identity Deck** project. Your job is to create all Astro pages, components, layouts, styles, and client-side interactivity.

## Context

Identity Deck is a multi-tenant SaaS platform deployed on **Cloudflare Workers** using **Astro** framework (`output: 'server'`). It generates professional persona profile cards from GitHub user data.

**IMPORTANT:** Read these files before starting:
1. `.prompts/professional-persona-cards.prompt.md` — Full specification (lines 748-848 for design system)
2. `.prompts/compact-persona-card.tsx` — Reference for CARD STYLE (compact 152px cards with modals)
3. `.prompts/professional-persona-cards.tsx` — Reference for PAGE LAYOUT (header, radar, interests, projects, footer)

## HYBRID Design Directive

You MUST combine elements from BOTH reference TSX files:

### From `compact-persona-card.tsx` — Card Style
- **PersonaCard**: 152px wide compact cards (lines 352-419)
  - 2px accent color bar on top
  - Icon (24x24, rounded 5px) + title + experience on same row
  - Tagline in italic monospace
  - Stat bars (7px font label, 3px height bars)
  - Stack badges (6px, inline)
  - Detail items with 2px left border
  - Colored "open details" button at bottom
- **PersonaModal**: Click-to-open detail modal (lines 197-291) — NOT flip animation
  - 460px wide, icon (44x44), full stats, stack, "Field Notes", employers, links
- **ProjectModal**: Project detail modal (lines 293-350)
  - 400px wide, left color stripe, tech badges, persona legend

### From `professional-persona-cards.tsx` — Page Layout
- **ProfileHeader** (lines 528-537): "Identity Deck" label (10px, monospace, uppercase, letterSpacing 4), name (36px, fontWeight 200), subtitle, meta info
- **RadarChart** (lines 296-348): 320px SVG, 4 grid polygons, axis lines, data polygon, colored 3px data points, axis-colored labels at 112% radius
- **StarInterestTile** (lines 548-566): 230px wide, subtle bg `rgba(255,255,255,0.03)`, label + count + examples
- **ColorLegend** (lines 570-579): Horizontal bar with 9x9 colored squares + persona short names
- **ProjectCard** (lines 474-517): 340px wide, 6px left stripe (gradient of persona colors), tech badges, persona legend with 7px colored squares
- **Section headers**: "Featured Projects" / "The Work" (lines 587-591)
- **Footer** (lines 598-602): Muted monospace text

## Your Scope — Files You Own

You own files ONLY under `src/pages/`, `src/components/`, `src/layouts/`, and `src/styles/global.css`. Do NOT touch files in `src/lib/`, `src/api/`, `migrations/`, or config files.

### Styles

1. **`src/styles/global.css`** — Global dark theme:
   - Page background: `linear-gradient(180deg, #08080c 0%, #0e0e14 50%, #08080c 100%)`
   - Font family: system monospace stack (`"SF Mono", "Cascadia Code", "Fira Code", Consolas, monospace`)
   - Base text color: `#f0f0f5`
   - Scrollbar styling (thin, dark)
   - Box-sizing: border-box globally
   - No margin/padding on body

### Layout

2. **`src/layouts/Base.astro`** — HTML shell:
   - Dark theme meta tags, viewport
   - OG meta tags (dynamic: title, description, image URL)
   - Import global.css
   - `<slot />` for page content

### Components

3. **`src/components/SearchBox.astro`** — Username search input:
   - Form that navigates to `/{username}` on submit
   - Styled input with monospace font, dark theme
   - Placeholder: "Enter GitHub username..."

4. **`src/components/ProfileHeader.astro`** — Header block:
   - Props: `name`, `subtitle`, `meta` (email, location, repo count, etc.)
   - "IDENTITY DECK" label: 10px, monospace, uppercase, letterSpacing 4, color #444
   - Name: 36px, fontWeight 200, color #fff, letterSpacing -0.03em
   - Subtitle: 12px, monospace, color #555
   - Meta: 10px, monospace, color #444

5. **`src/components/RadarChart.astro`** — SVG radar chart:
   - Props: `axes` (array of `{ label, value, color }`)
   - Size: 320x320
   - 4 concentric grid polygons (25%, 50%, 75%, 100%) — stroke `rgba(255,255,255,0.06)`
   - Axis lines from center — stroke `rgba(255,255,255,0.04)`
   - Data polygon: fill `rgba(100,200,255,0.12)`, stroke `rgba(100,200,255,0.6)`, strokeWidth 1.5
   - Data points: 3px circles in axis color
   - Labels: 9px monospace, positioned at 112% radius, colored per axis

6. **`src/components/StarInterestTile.astro`** — Interest tile:
   - Props: `label`, `count`, `examples`
   - Width: 230px
   - Background: `rgba(255,255,255,0.03)`, border: `1px solid rgba(255,255,255,0.06)`, borderRadius 8
   - Label: 10px, #ccc, fontWeight 600 + count: 8px, #555, monospace (same line, space-between)
   - Examples: 8px, #666, monospace

7. **`src/components/ColorLegend.astro`** — Color legend bar:
   - Props: `personas` (array of `{ id, title, accent }`)
   - Horizontal flex-wrap, gap 5px 12px
   - Each: 9x9 colored square (borderRadius 2) + 8px monospace label

8. **`src/components/PersonaCard.astro`** — Compact persona card:
   - Props: all persona fields (id, title, tagline, accent, icon, stats, stack, details, etc.)
   - Width: 152px, flex column
   - Top: rounded 8px 8px 0 0, dark bg `linear-gradient(135deg, #0c0c14, #111119)`
   - Border: `1px solid {accent}15`, borderBottom none
   - 2px accent bar at top (opacity 0.4)
   - Content area: 7px 9px 8px padding
   - Icon: 24x24, rounded 5px, accent bg 12%
   - Title: 8px, bold, #ddd
   - Tagline: 7px, italic, accent color, 70% opacity
   - Stat bars: 7px label, 3px height, accent fill
   - Stack badges: 6px, accent bg 15%, accent border 30%
   - Details: 7px, #888, 2px left border accent 25%
   - Bottom button: accent bg, rounded 0 0 8px 8px, "open details" text
   - `data-persona-id` attribute for JS targeting

9. **`src/components/PersonaModal.astro`** — Detail modal (hidden by default):
   - 460px wide, dark bg, accent border, backdrop blur
   - Full stats (9px labels, 5px bars), stack badges (9px), "Field Notes" section, employers, links
   - Close button at bottom
   - Hidden by default, shown via JS

10. **`src/components/ProjectCard.astro`** — Project card:
    - Props: name, description, tech, persona_map, etc.
    - Width: 340px, borderRadius 14, overflow hidden
    - 6px left stripe: linear gradient of persona accent colors (equal segments)
    - Content: name (15px mono bold), description (10px #888), tech badges (8px mono), persona legend (7px squares)
    - `data-project-id` attribute for JS targeting

11. **`src/components/ProjectModal.astro`** — Project detail modal (hidden by default)

12. **`src/components/LoadingState.astro`** — Computing state:
    - Skeleton/spinner UI shown when API returns 202
    - Pulsing animation, monospace "Computing profile..." text

### Pages

13. **`src/pages/index.astro`** — Landing page:
    - `export const prerender = true;` (static, no SSR needed)
    - Centered layout with Identity Deck branding
    - SearchBox component
    - Brief tagline/description

14. **`src/pages/[username]/index.astro`** — Full profile page:
    - SSR: fetch profile data from internal engine (not self-HTTP)
    - If 202/computing: show LoadingState with auto-poll script
    - Sections in order: ProfileHeader → RadarChart → StarInterestTiles grid → ColorLegend → PersonaCards grid → "Featured Projects" header → ProjectCards grid → Footer
    - Include `<script>` tag for modal open/close logic

15. **`src/pages/[username]/card/[id].astro`** — Single persona card:
    - SSR: fetch single persona by id
    - Render one PersonaCard + its PersonaModal (open by default)
    - OG meta tags for sharing

16. **`src/pages/[username]/embed.astro`** — Embeddable widget:
    - Minimal chrome (no header/footer)
    - Compact card grid only
    - Designed for iframe embedding

### Client-Side JavaScript

Add a `<script>` tag in the profile page for modal interactivity:

```javascript
// Modal open: click on persona card "open details" button
document.querySelectorAll('[data-persona-open]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.personaOpen;
    document.getElementById(`persona-modal-${id}`).classList.add('active');
    document.body.style.overflow = 'hidden';
  });
});

// Modal close
document.querySelectorAll('[data-modal-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal-overlay').classList.remove('active');
    document.body.style.overflow = '';
  });
});

// Close on backdrop click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
});
```

## Key Implementation Notes

- Import design tokens from `src/styles/tokens.ts` (created by infrastructure agent) for `PERSONA_COLORS`
- Use Astro's built-in `<style>` tags for component-scoped styles
- Use `is:global` sparingly — only for modal overlay styles
- The profile page fetches data server-side in frontmatter, NOT client-side
- For the 202 computing state, add a client-side script that polls `/api/{username}` every 3 seconds and reloads when ready
- All text uses monospace font family
- Dark theme throughout — no light mode
- Responsive: mobile (< 768px) single column, tablet 2-col, desktop flex-wrap
