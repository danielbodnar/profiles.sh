/**
 * Template for the `generate.mjs` script pushed to the persona-cards repo.
 *
 * This is a standalone Node.js script (no dependencies) that reads the raw
 * GitHub API JSON files produced by the workflow and applies the persona engine
 * scoring algorithm to produce `profile.json` and `index.html`.
 *
 * The script embeds a minimal re-implementation of the scoring logic so that
 * the self-hosted repo is fully self-contained.
 */

/**
 * Returns the generate.mjs script content for a given username.
 */
export function generateScriptContent(username: string): string {
  return `#!/usr/bin/env node
// profiles.sh — Self-hosted profile generator
// This script reads GitHub API data from /tmp and produces profile.json + index.html
// https://profiles.sh

import { readFileSync, writeFileSync } from "node:fs";

const USERNAME = process.env.GITHUB_USERNAME || "${username}";

// ---------------------------------------------------------------------------
// 1. Read raw GitHub data produced by the workflow
// ---------------------------------------------------------------------------

const profile = JSON.parse(readFileSync("/tmp/profile.json", "utf-8"));
const repos = JSON.parse(readFileSync("/tmp/repos.json", "utf-8"));
const stars = JSON.parse(readFileSync("/tmp/stars.json", "utf-8"));

// Filter out forks from owned repos
const ownedRepos = repos.filter((r) => !r.fork);

// ---------------------------------------------------------------------------
// 2. Minimal persona engine (deterministic scoring)
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: "systems", title: "Systems Engineer", icon: "⚙️", color: "#ef4444",
    languages: ["c", "c++", "rust", "zig", "assembly"],
    topics: ["kernel", "os", "embedded", "firmware", "driver", "rtos", "systems"],
    keywords: ["kernel", "driver", "embedded", "firmware", "operating system", "low-level"] },
  { id: "platform", title: "Platform Engineer", icon: "🔗", color: "#f97316",
    languages: ["go", "python", "hcl", "typescript"],
    topics: ["kubernetes", "docker", "terraform", "infrastructure", "platform", "helm", "ci-cd"],
    keywords: ["platform", "infrastructure", "kubernetes", "docker", "terraform", "ci/cd"] },
  { id: "software", title: "Software Engineer", icon: "λ", color: "#eab308",
    languages: ["typescript", "javascript", "java", "python", "c#", "kotlin", "swift", "ruby"],
    topics: ["api", "backend", "frontend", "fullstack", "web", "react", "vue", "angular"],
    keywords: ["api", "backend", "frontend", "fullstack", "web", "framework", "library"] },
  { id: "cloud", title: "Cloud Architect", icon: "☁️", color: "#22c55e",
    languages: ["hcl", "python", "go", "yaml"],
    topics: ["aws", "azure", "gcp", "cloud", "serverless", "lambda", "cloudformation"],
    keywords: ["cloud", "aws", "azure", "gcp", "serverless", "lambda", "s3"] },
  { id: "linux", title: "Linux Enthusiast", icon: "🐧", color: "#06b6d4",
    languages: ["c", "shell", "bash", "python", "perl"],
    topics: ["linux", "unix", "dotfiles", "terminal", "cli", "shell", "bash"],
    keywords: ["linux", "unix", "dotfiles", "terminal", "command-line", "shell"] },
  { id: "solutions", title: "Solutions Engineer", icon: "🌉", color: "#3b82f6",
    languages: ["python", "javascript", "typescript", "ruby"],
    topics: ["sdk", "integration", "demo", "tutorial", "example", "docs"],
    keywords: ["sdk", "integration", "demo", "tutorial", "documentation", "example"] },
  { id: "sre", title: "SRE", icon: "📟", color: "#8b5cf6",
    languages: ["go", "python", "shell"],
    topics: ["monitoring", "observability", "alerting", "sre", "reliability", "incident"],
    keywords: ["monitoring", "observability", "alerting", "sre", "reliability", "uptime"] },
  { id: "tinkerer", title: "Chronic Tinkerer", icon: "🔧", color: "#ec4899",
    languages: ["python", "javascript", "arduino", "lua"],
    topics: ["iot", "raspberry-pi", "arduino", "hardware", "maker", "3d-printing", "home-automation"],
    keywords: ["iot", "raspberry", "arduino", "maker", "hack", "experiment", "tinker"] },
  { id: "hacker", title: "Old School Hacker", icon: ">_", color: "#64748b",
    languages: ["c", "python", "perl", "lisp", "scheme", "haskell", "erlang", "forth"],
    topics: ["security", "ctf", "exploit", "reverse-engineering", "crypto", "hacking"],
    keywords: ["security", "exploit", "reverse", "crypto", "hacker", "ctf"] },
];

function scoreRepo(repo, cat) {
  let score = 0;
  const lang = (repo.language || "").toLowerCase();
  const topics = (repo.topics || []).map((t) => t.toLowerCase());
  const desc = (repo.description || "").toLowerCase();
  const name = (repo.name || "").toLowerCase();

  if (cat.languages.some((l) => l.toLowerCase() === lang)) score += 2;
  score += topics.filter((t) => cat.topics.some((ct) =>
    t.includes(ct) || ct.includes(t))).length * 3;
  score += cat.keywords.filter((k) => desc.includes(k)).length * 1.5;
  score += cat.keywords.filter((k) => name.includes(k)).length * 1;
  return score;
}

function computeScores(stars, ownedRepos) {
  const scores = {};
  for (const cat of CATEGORIES) {
    let total = 0;
    for (const repo of stars) total += scoreRepo(repo, cat);
    for (const repo of ownedRepos) total += scoreRepo(repo, cat) * 3;
    scores[cat.id] = total;
  }
  return scores;
}

function normalizeScores(raw) {
  const values = Object.values(raw).filter((v) => v > 0);
  if (values.length === 0) return raw;
  const max = Math.max(...values);
  const result = {};
  for (const [k, v] of Object.entries(raw)) {
    result[k] = v > 0 ? Math.round(40 + (v / max) * 60) : 0;
  }
  return result;
}

const PERSONA_THRESHOLD = 45;

function determinePersonas(normalized) {
  return Object.entries(normalized)
    .filter(([, v]) => v >= PERSONA_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([id, confidence], i) => ({ persona_id: id, confidence, sort_order: i }));
}

function estimateExperience(createdAt, maxScore) {
  const years = Math.max(1, Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
  const ratio = maxScore / 100;
  let prefix = "";
  if (years >= 10 && ratio >= 0.85) prefix = "Principal";
  else if (years >= 7 && ratio >= 0.7) prefix = "Staff";
  else if (years >= 4 && ratio >= 0.5) prefix = "Senior";
  return { prefix, years };
}

// ---------------------------------------------------------------------------
// 3. Generate profile
// ---------------------------------------------------------------------------

const rawScores = computeScores(stars, ownedRepos);
const normalized = normalizeScores(rawScores);
const activePersonas = determinePersonas(normalized);
const maxScore = Math.max(...Object.values(normalized), 1);
const exp = estimateExperience(profile.created_at, maxScore);

const personas = activePersonas.map((ap) => {
  const cat = CATEGORIES.find((c) => c.id === ap.persona_id);
  return {
    persona_id: ap.persona_id,
    title: cat ? (exp.prefix ? exp.prefix + " " + cat.title : cat.title) : ap.persona_id,
    tagline: "",
    icon: cat?.icon || "?",
    accent_color: cat?.color || "#888",
    bg_gradient: "",
    experience_label: exp.prefix || "",
    years_active: exp.years + (exp.years === 1 ? " year" : " years"),
    confidence: ap.confidence,
    sort_order: ap.sort_order,
    stats: [],
    stack: [],
    details: [],
    starred_repos: [],
  };
});

const radarAxes = activePersonas.slice(0, 9).map((ap, i) => {
  const cat = CATEGORIES.find((c) => c.id === ap.persona_id);
  return {
    label: cat?.title || ap.persona_id,
    value: normalized[ap.persona_id] || 0,
    color: cat?.color || "#888",
    domain: ap.persona_id,
    sort_order: i,
  };
});

const output = {
  schema_version: "1.0.0",
  generated_at: new Date().toISOString(),
  username: USERNAME,
  data: {
    profile: {
      username: profile.login,
      display_name: profile.name || profile.login,
      bio: profile.bio || "",
      location: profile.location || "",
      email: profile.email || "",
      blog: profile.blog || "",
      company: profile.company || "",
      avatar_url: profile.avatar_url,
      followers: profile.followers,
      following: profile.following,
      public_repos: profile.public_repos,
      created_at: profile.created_at,
    },
    personas,
    projects: [],
    radar_axes: radarAxes,
    star_interests: [],
    aggregates: [],
  },
};

writeFileSync("profile.json", JSON.stringify(output, null, 2));
console.log("Wrote profile.json with", personas.length, "personas");

// ---------------------------------------------------------------------------
// 4. Generate static HTML for GitHub Pages
// ---------------------------------------------------------------------------

const html = \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>\${output.data.profile.display_name} — profiles.sh</title>
  <meta name="description" content="Professional persona cards for \${output.data.profile.display_name}" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0a; color: #e5e5e5; min-height: 100vh; padding: 2rem; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 2rem; }
    .avatar { width: 96px; height: 96px; border-radius: 50%; border: 2px solid #333; }
    .name { font-size: 1.5rem; font-weight: 700; margin-top: 0.75rem; }
    .bio { color: #a3a3a3; margin-top: 0.25rem; }
    .meta { color: #737373; font-size: 0.875rem; margin-top: 0.5rem; }
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
    .card { border: 1px solid #262626; border-radius: 12px; padding: 1.25rem;
      background: #141414; transition: border-color 0.2s; }
    .card:hover { border-color: #404040; }
    .card-icon { font-size: 1.5rem; }
    .card-title { font-size: 1rem; font-weight: 600; margin-top: 0.5rem; }
    .card-score { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.75rem; }
    .bar-bg { flex: 1; height: 6px; background: #262626; border-radius: 3px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 3px; }
    .score-label { font-size: 0.75rem; color: #a3a3a3; min-width: 2rem; text-align: right; }
    .footer { text-align: center; margin-top: 3rem; color: #525252; font-size: 0.75rem; }
    .footer a { color: #737373; }
    .radar { margin: 2rem 0; text-align: center; }
    .radar-title { font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img class="avatar" src="\${output.data.profile.avatar_url}" alt="\${output.data.profile.display_name}" />
      <div class="name">\${output.data.profile.display_name}</div>
      <div class="bio">\${output.data.profile.bio}</div>
      <div class="meta">
        \${output.data.profile.location ? output.data.profile.location + " · " : ""}
        \${output.data.profile.followers} followers · \${output.data.profile.public_repos} repos
      </div>
    </div>

    <div class="radar">
      <div class="radar-title">Skill Radar</div>
    </div>

    <div class="cards">
      \${personas
        .map(
          (p) => \\\`<div class="card">
        <div class="card-icon">\\\${p.icon}</div>
        <div class="card-title">\\\${p.title}</div>
        <div class="card-score">
          <div class="bar-bg">
            <div class="bar-fill" style="width:\\\${p.confidence}%;background:\\\${p.accent_color}"></div>
          </div>
          <span class="score-label">\\\${p.confidence}</span>
        </div>
      </div>\\\`
        )
        .join("\\n      ")}
    </div>

    <div class="footer">
      Generated by <a href="https://profiles.sh">profiles.sh</a> ·
      Last updated \${output.generated_at.split("T")[0]}
    </div>
  </div>
</body>
</html>\`;

writeFileSync("index.html", html);
console.log("Wrote index.html for GitHub Pages");
`;
}
