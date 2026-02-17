/**
 * OG image SVG template.
 *
 * Renders a 1200x630 Open Graph image showing:
 *   - Username and display name
 *   - Top 3-4 persona icons with titles
 *   - A miniature radar chart
 *   - "profiles.sh" branding
 *
 * Uses design tokens from src/styles/tokens.ts for persona colors.
 */

import { PERSONA_COLORS } from "../../styles/tokens";
import type { ProfileRow } from "../db/types";

/** Persona data needed for the OG template (subset of PersonaRow). */
export interface OGPersona {
  persona_id: string;
  title: string;
  icon: string;
  accent_color: string | null;
  confidence: number | null;
}

/** Radar axis data for the miniature chart. */
export interface OGRadarAxis {
  label: string;
  value: number;
  color: string | null;
}

/**
 * Generate the complete SVG string for an OG image.
 */
export function renderOGTemplate(
  profile: ProfileRow,
  personas: OGPersona[],
  radarAxes?: OGRadarAxis[],
): string {
  const displayName = profile.display_name || profile.username;
  const topPersonas = personas.slice(0, 4);

  // Build persona badges
  const personaBadges = topPersonas
    .map((p, i) => {
      const accent =
        p.accent_color ||
        PERSONA_COLORS[p.persona_id]?.accent ||
        "#888888";
      const x = 80 + i * 260;
      const y = 310;
      return `
        <g transform="translate(${x}, ${y})">
          <rect x="0" y="0" width="230" height="80" rx="12"
                fill="${accent}18" stroke="${accent}44" stroke-width="1.5"/>
          <text x="16" y="32" fill="${accent}" font-size="22"
                font-family="monospace">${escapeXml(p.icon || "")}</text>
          <text x="50" y="32" fill="#ffffff" font-size="15"
                font-weight="600" font-family="monospace">${escapeXml(p.title)}</text>
          <text x="50" y="56" fill="${accent}" font-size="11"
                font-family="monospace" opacity="0.8">${p.confidence != null ? `${Math.round(p.confidence * 100)}% confidence` : ""}</text>
        </g>`;
    })
    .join("\n");

  // Build miniature radar chart (if axes provided)
  const radarSvg = radarAxes && radarAxes.length > 0
    ? renderMiniRadar(radarAxes)
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#08080c"/>
      <stop offset="50%" stop-color="#0e0e14"/>
      <stop offset="100%" stop-color="#08080c"/>
    </linearGradient>
    <linearGradient id="accent-line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4A90D9" stop-opacity="0"/>
      <stop offset="20%" stop-color="#4A90D9"/>
      <stop offset="50%" stop-color="#7C4DFF"/>
      <stop offset="80%" stop-color="#00E676"/>
      <stop offset="100%" stop-color="#00E676" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Top accent line -->
  <rect x="80" y="60" width="1040" height="2" fill="url(#accent-line)" opacity="0.6"/>

  <!-- Branding -->
  <text x="80" y="110" fill="#ffffff" font-size="14" font-family="monospace"
        letter-spacing="4" opacity="0.5" text-transform="uppercase">PROFILES.SH</text>

  <!-- Avatar placeholder (circle) -->
  <circle cx="120" cy="200" r="45" fill="#ffffff10" stroke="#ffffff20" stroke-width="1.5"/>
  <text x="120" y="208" text-anchor="middle" fill="#ffffff60" font-size="28"
        font-family="monospace">${escapeXml((profile.username || "?")[0].toUpperCase())}</text>

  <!-- Display name -->
  <text x="185" y="188" fill="#ffffff" font-size="32" font-weight="200"
        font-family="monospace" letter-spacing="-0.03em">${escapeXml(displayName)}</text>

  <!-- Username -->
  <text x="185" y="220" fill="#ffffff" font-size="16" font-family="monospace"
        opacity="0.5">@${escapeXml(profile.username)}</text>

  <!-- Bio -->
  <text x="185" y="252" fill="#ffffff" font-size="13" font-family="monospace"
        opacity="0.4">${escapeXml(truncate(profile.bio || "", 80))}</text>

  <!-- Divider -->
  <rect x="80" y="280" width="1040" height="1" fill="#ffffff10"/>

  <!-- Persona badges -->
  ${personaBadges}

  <!-- Mini radar chart (right side) -->
  ${radarSvg}

  <!-- Bottom accent line -->
  <rect x="80" y="560" width="1040" height="2" fill="url(#accent-line)" opacity="0.4"/>

  <!-- Footer -->
  <text x="80" y="595" fill="#ffffff" font-size="11" font-family="monospace"
        opacity="0.3">profiles.sh</text>
  <text x="1120" y="595" text-anchor="end" fill="#ffffff" font-size="11"
        font-family="monospace" opacity="0.3">${topPersonas.length} persona${topPersonas.length !== 1 ? "s" : ""} detected</text>
</svg>`;
}

/**
 * Render a miniature radar chart as an SVG group.
 * Positioned at the right side of the OG image.
 */
function renderMiniRadar(axes: OGRadarAxis[]): string {
  const cx = 1000;
  const cy = 180;
  const radius = 70;
  const n = axes.length;

  if (n < 3) return "";

  // Grid polygons at 25%, 50%, 75%, 100%
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPolygons = gridLevels
    .map((level) => {
      const r = radius * level;
      const points = Array.from({ length: n }, (_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      }).join(" ");
      return `<polygon points="${points}" fill="none" stroke="#ffffff10" stroke-width="0.5"/>`;
    })
    .join("\n    ");

  // Axis lines
  const axisLines = Array.from({ length: n }, (_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const x2 = cx + radius * Math.cos(angle);
    const y2 = cy + radius * Math.sin(angle);
    return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#ffffff08" stroke-width="0.5"/>`;
  }).join("\n    ");

  // Data polygon
  const dataPoints = axes.map((axis, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (axis.value / 100) * radius;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  });
  const dataPolygon = `<polygon points="${dataPoints.join(" ")}"
      fill="rgba(100,200,255,0.12)" stroke="rgba(100,200,255,0.6)" stroke-width="1"/>`;

  // Data point circles
  const dataCircles = axes
    .map((axis, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = (axis.value / 100) * radius;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      const color = axis.color || "#64c8ff";
      return `<circle cx="${x}" cy="${y}" r="2.5" fill="${color}"/>`;
    })
    .join("\n    ");

  return `
  <g>
    ${gridPolygons}
    ${axisLines}
    ${dataPolygon}
    ${dataCircles}
  </g>`;
}

/** Escape special XML characters. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Truncate a string with ellipsis. */
function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "\u2026";
}
