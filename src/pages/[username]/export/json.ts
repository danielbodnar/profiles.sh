import type { APIRoute } from "astro";

function parseJson(val: unknown): unknown {
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

export const GET: APIRoute = async ({ params, locals }) => {
  const username = params.username?.toLowerCase();
  if (!username) return new Response("Missing username", { status: 400 });

  const env = (locals as any).runtime.env as Env;

  const profile = await env.DB.prepare("SELECT * FROM profiles WHERE username = ?")
    .bind(username).first();
  if (!profile) return new Response("Not found", { status: 404 });

  const [personas, projects, radar, interests] = await Promise.all([
    env.DB.prepare("SELECT * FROM personas WHERE username = ? ORDER BY sort_order ASC").bind(username).all(),
    env.DB.prepare("SELECT * FROM projects WHERE username = ? ORDER BY sort_order ASC").bind(username).all(),
    env.DB.prepare("SELECT * FROM radar_axes WHERE username = ? ORDER BY sort_order ASC").bind(username).all(),
    env.DB.prepare("SELECT * FROM star_interests WHERE username = ? ORDER BY sort_order ASC").bind(username).all(),
  ]);

  const data = {
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      bio: profile.bio,
      location: profile.location,
      avatar_url: profile.avatar_url,
      public_repos: profile.public_repos,
      followers: profile.followers,
      created_at: profile.created_at,
      computed_at: profile.computed_at,
    },
    personas: personas.results.map((p: any) => ({
      persona_id: p.persona_id,
      title: p.title,
      tagline: p.tagline,
      icon: p.icon,
      experience: p.experience_label,
      years_active: p.years_active,
      accent_color: p.accent_color,
      stats: parseJson(p.stats),
      stack: parseJson(p.stack),
      details: parseJson(p.details),
      employers: parseJson(p.employers),
    })),
    projects: projects.results.map((p: any) => ({
      name: p.name,
      description: p.description,
      url: p.url,
      language: p.language,
      stars: p.stars,
      forks: p.forks,
      tech: parseJson(p.tech),
      persona_map: parseJson(p.persona_map),
    })),
    radar: radar.results.map((r: any) => ({
      label: r.label,
      value: r.value,
      color: r.color,
    })),
    interests: interests.results.map((i: any) => ({
      label: i.label,
      count: i.count,
      examples: i.examples,
    })),
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${username}-profiles.json"`,
    },
  });
};
