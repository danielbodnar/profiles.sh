/**
 * OG image generation pipeline: SVG template -> R2 storage.
 *
 * Generates an SVG OG image and stores it in R2 with content-type metadata.
 * PNG conversion via resvg-wasm can be added later if needed.
 */

import { renderOGTemplate } from "./template";
import type { OGPersona } from "./template";
import type { ProfileRow, PersonaRow } from "../db/types";

/**
 * Generate (or retrieve cached) OG image for a profile.
 *
 * @param profile   - Profile row from D1
 * @param personas  - Persona rows from D1
 * @param env       - Worker Env with R2 binding
 * @returns         - SVG string
 */
export async function generateOGImage(
  profile: ProfileRow,
  personas: Array<Omit<PersonaRow, "id"> | PersonaRow>,
  env: { R2: R2Bucket },
): Promise<string> {
  const key = `og/${profile.username}.svg`;

  // Check R2 for existing image
  const existing = await env.R2.get(key);
  if (existing) {
    return await existing.text();
  }

  // Map PersonaRow to OGPersona
  const ogPersonas: OGPersona[] = personas.map((p) => ({
    persona_id: p.persona_id,
    title: p.title,
    icon: p.icon || "",
    accent_color: p.accent_color,
    confidence: p.confidence,
  }));

  // Generate SVG
  const svg = renderOGTemplate(profile, ogPersonas);

  // Store in R2
  await env.R2.put(key, svg, {
    httpMetadata: { contentType: "image/svg+xml" },
    customMetadata: {
      username: profile.username,
      generatedAt: new Date().toISOString(),
    },
  });

  return svg;
}

/**
 * Delete the cached OG image for a user (call on profile refresh).
 */
export async function invalidateOGImage(
  username: string,
  env: { R2: R2Bucket },
): Promise<void> {
  await Promise.all([
    env.R2.delete(`og/${username}.png`),
    env.R2.delete(`og/${username}.svg`),
  ]);
}
