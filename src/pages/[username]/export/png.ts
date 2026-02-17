import type { APIRoute } from "astro";
import { renderOGTemplate } from "../../../lib/og/template";
import { PERSONA_COLORS } from "../../../styles/tokens";
import type { ProfileRow } from "../../../lib/db/types";

export const GET: APIRoute = async ({ params, locals }) => {
  const username = params.username?.toLowerCase();
  if (!username) return new Response("Missing username", { status: 400 });

  const env = (locals as any).runtime.env as Env;

  // Check R2 for cached image first
  const cached = await env.R2.get(`og/${username}.png`);
  if (cached) {
    return new Response(cached.body, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${username}-profiles.png"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Fall back to SVG (browsers render these natively)
  const profile = await env.DB.prepare("SELECT * FROM profiles WHERE username = ?")
    .bind(username).first();
  if (!profile) return new Response("Not found", { status: 404 });

  const [personas, radar] = await Promise.all([
    env.DB.prepare("SELECT * FROM personas WHERE username = ? ORDER BY sort_order ASC").bind(username).all(),
    env.DB.prepare("SELECT * FROM radar_axes WHERE username = ? ORDER BY sort_order ASC").bind(username).all(),
  ]);

  const ogPersonas = personas.results.map((p: any) => ({
    persona_id: p.persona_id,
    title: p.title,
    icon: p.icon || "",
    accent_color: p.accent_color || PERSONA_COLORS[p.persona_id]?.accent || null,
    confidence: p.confidence,
  }));

  const ogRadar = radar.results.map((r: any) => ({
    label: r.label,
    value: r.value,
    color: r.color,
  }));

  const svg = renderOGTemplate(profile as unknown as ProfileRow, ogPersonas, ogRadar);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="${username}-profiles.svg"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
};
