import { DOMAIN_SIGNALS } from "./domain-signals";
import { estimateExperience } from "./experience";
import type { RepoData } from "./scoring";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivePersona {
  persona_id: string;
  confidence: number;
  sort_order: number;
}

export interface PersonaTemplate {
  title: string;
  titlePrefixes: string[];
  taglines: string[];
  icon: string;
  accentColor: string;
  bgGradient: string;
  statLabels: string[];
  stackPool: string[];
}

export interface PersonaCard {
  persona_id: string;
  title: string;
  tagline: string;
  icon: string;
  accent_color: string;
  bg_gradient: string;
  experience_label: string;
  years_active: string;
  confidence: number;
  sort_order: number;
  stats: [string, number][];
  stack: string[];
  details: string[];
  starred_repos: string[];
}

// ---------------------------------------------------------------------------
// Threshold
// ---------------------------------------------------------------------------

export const PERSONA_THRESHOLD = 45;

// ---------------------------------------------------------------------------
// Determine active personas from normalized scores
// ---------------------------------------------------------------------------

/**
 * Filter domains whose normalized score >= PERSONA_THRESHOLD,
 * sort descending, and map to ActivePersona objects.
 */
export function determinePersonas(
  normalizedScores: Record<string, number>,
): ActivePersona[] {
  return Object.entries(normalizedScores)
    .filter(([_, score]) => score >= PERSONA_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([domain, score], index) => ({
      persona_id: domain,
      confidence: score / 100,
      sort_order: index,
    }));
}

// ---------------------------------------------------------------------------
// Persona Templates — exact data from spec lines 510-646
// ---------------------------------------------------------------------------

export const PERSONA_TEMPLATES: Record<string, PersonaTemplate> = {
  systems: {
    title: "Systems Engineer",
    titlePrefixes: ["Principal", "Senior", "Staff", "Lead"],
    taglines: [
      "I speak fluent syscall.",
      "Closer to the metal than your bootloader.",
      "The kernel whisperer.",
    ],
    icon: "\u2699\uFE0F", // gear emoji
    accentColor: "#4A90D9",
    bgGradient: "linear-gradient(135deg, #0a1628 0%, #132744 100%)",
    statLabels: ["Architecture", "Debugging", "Scale", "Uptime"],
    stackPool: [
      "Linux", "systemd", "PostgreSQL", "ZFS", "Bare Metal",
      "Kernel Tuning", "Proxmox", "QEMU", "KVM", "InfiniBand",
      "NVMe", "io_uring", "eBPF", "Zig", "C",
    ],
  },
  platform: {
    title: "Platform Engineer",
    titlePrefixes: ["Staff", "Senior", "Principal", "Lead"],
    taglines: [
      "Your deploy pipeline is my canvas.",
      "Infrastructure as Code, chaos as a service.",
      "I automate the automators.",
    ],
    icon: "\uD83D\uDD17", // link emoji
    accentColor: "#7C4DFF",
    bgGradient: "linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 100%)",
    statLabels: ["Pipelines", "Automation", "Tooling", "DX"],
    stackPool: [
      "Kubernetes", "Helm", "Terraform", "Ansible", "Docker",
      "GitLab CI/CD", "GitHub Actions", "AWS CDK", "Pulumi",
      "ArgoCD", "Nix", "Buildroot",
    ],
  },
  software: {
    title: "Software Engineer",
    titlePrefixes: ["Staff", "Senior", "Principal", "Full Stack"],
    taglines: [
      "Types are a love language.",
      "I write code that writes code.",
      "Compilers fear me, runtimes love me.",
    ],
    icon: "\u03BB", // lambda
    accentColor: "#00E676",
    bgGradient: "linear-gradient(135deg, #0a1a0f 0%, #132e1a 100%)",
    statLabels: ["Backend", "Frontend", "Systems", "Unix Phil."],
    stackPool: [], // Derived from user's actual languages
  },
  cloud: {
    title: "Cloud Architect",
    titlePrefixes: ["Principal", "Senior", "Lead", "Staff"],
    taglines: [
      "The cloud is just someone else's bare metal.",
      "Distributed by design, resilient by nature.",
      "Multi-cloud native, single-cloud fluent.",
    ],
    icon: "\u2601\uFE0F", // cloud emoji
    accentColor: "#40C4FF",
    bgGradient: "linear-gradient(135deg, #071825 0%, #0d2b45 100%)",
    statLabels: ["Design", "Security", "Scale", "Vision"],
    stackPool: [
      "AWS", "Cloudflare", "GCP", "Azure", "EKS", "Lambda",
      "Workers", "Multi-cloud", "VPN", "WireGuard", "E2E Encryption",
      "Serverless", "CDN", "Edge",
    ],
  },
  linux: {
    title: "Linux Enthusiast",
    titlePrefixes: ["Crazy", "Passionate", "Devoted", "Obsessive"],
    taglines: [
      "btw, I use Linux.",
      "I don't use Linux. Linux uses me.",
      "Have you heard about our lord and savior, Tux?",
    ],
    icon: "\uD83D\uDC27", // penguin emoji
    accentColor: "#FFEB3B",
    bgGradient: "linear-gradient(135deg, #1a1800 0%, #2e2a05 100%)",
    statLabels: ["Passion", "Shell", "systemd", "Evangelism"],
    stackPool: [], // Derived from user's actual Linux stars
  },
  solutions: {
    title: "Solutions Engineer",
    titlePrefixes: ["Principal", "Senior", "Lead"],
    taglines: [
      "I translate between humans and machines.",
      "The bridge between what you want and what's possible.",
      "Architecture is a conversation.",
    ],
    icon: "\uD83C\uDF09", // bridge emoji
    accentColor: "#FF9800",
    bgGradient: "linear-gradient(135deg, #1a1005 0%, #2e1f0a 100%)",
    statLabels: ["Communication", "Problem Solving", "Empathy", "Breadth"],
    stackPool: [
      "OpenAPI", "JSON Schema", "REST", "GraphQL", "gRPC",
      "CQRS", "Event-Driven", "Microservices", "Service Mesh",
    ],
  },
  sre: {
    title: "SRE",
    titlePrefixes: ["Principal", "Senior", "Staff", "Lead"],
    taglines: [
      "Sleep is for the well-monitored.",
      "Uptime is a lifestyle, not a metric.",
      "I break things professionally, so production doesn't.",
    ],
    icon: "\uD83D\uDCDF", // pager emoji
    accentColor: "#FF5252",
    bgGradient: "linear-gradient(135deg, #1a0505 0%, #2e0f0f 100%)",
    statLabels: ["Reliability", "Incident Mgmt", "Observability", "Automation"],
    stackPool: [
      "Grafana", "Prometheus", "VictoriaMetrics", "Jaeger",
      "ELK", "Datadog", "PagerDuty", "Chaos Engineering",
    ],
  },
  tinkerer: {
    title: "Chronic Tinkerer",
    titlePrefixes: [""],
    taglines: [
      "What if I just tried one more thing...",
      "My side projects have side projects.",
      "Focus score: 42.",
    ],
    icon: "\uD83D\uDD27", // wrench emoji
    accentColor: "#FFD54F",
    bgGradient: "linear-gradient(135deg, #1a1508 0%, #2e2510 100%)",
    statLabels: ["Curiosity", "Side Projects", "Focus", "Ambition"],
    stackPool: [], // Derived from user's eclectic stars
  },
  hacker: {
    title: "Old School Hacker",
    titlePrefixes: [""],
    taglines: [
      "The terminal is home.",
      "Learned by breaking things. Still does.",
      "Pre-cloud, pre-container, pre-everything.",
    ],
    icon: ">_",
    accentColor: "#00FF41",
    bgGradient: "linear-gradient(135deg, #000000 0%, #0a0a0a 100%)",
    statLabels: ["Grit", "Nostalgia", "Root Access", "Lore"],
    stackPool: [
      "Bare Metal", "The Terminal", "Shell", "Neovim",
      "vim", "Helix", "tmux", "Zellij", "Ghostty",
    ],
  },
  dad: {
    title: "Dad",
    titlePrefixes: [""],
    taglines: [
      "My greatest production deployment.",
      "Works on weekends, deploys on weeknights.",
      "sudo parent --patience=infinite",
    ],
    icon: "\uD83D\uDC68\u200D\uD83D\uDC67", // father & daughter emoji
    accentColor: "#F48FB1",
    bgGradient: "linear-gradient(135deg, #1a0f15 0%, #2e1a28 100%)",
    statLabels: ["Patience", "Dad Jokes", "Snack Logistics", "Bedtime Stories"],
    stackPool: [
      "Diaper Deployment", "Lullaby API", "Snack Queue",
      "Timeout Orchestrator", "Nap Scheduler",
    ],
  },
};

// ---------------------------------------------------------------------------
// Helper: derive stack from user repos/stars for domains with empty stackPool
// ---------------------------------------------------------------------------

function deriveStackFromRepos(
  personaId: string,
  stars: RepoData[],
  ownedRepos: RepoData[],
): string[] {
  const allRepos = [...ownedRepos, ...stars];
  const signals = DOMAIN_SIGNALS[personaId];
  if (!signals) return [];

  const langCounts: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};

  for (const repo of allRepos) {
    const lang = (repo.language || "").toLowerCase();
    const topics = (repo.topics || []).map((t) => t.toLowerCase());

    // Check if this repo matches the domain at all
    let matches = false;
    if (signals.languages.some((l) => l.toLowerCase() === lang)) {
      matches = true;
      const displayLang = repo.language || "";
      if (displayLang) {
        langCounts[displayLang] = (langCounts[displayLang] || 0) + 1;
      }
    }

    for (const t of topics) {
      if (signals.topics.some((st) => t.includes(st) || st.includes(t))) {
        matches = true;
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      }
    }

    if (matches && repo.language) {
      langCounts[repo.language] = (langCounts[repo.language] || 0) + 1;
    }
  }

  // Combine languages and topics, sorted by frequency
  const combined = [
    ...Object.entries(langCounts).map(([name, count]) => ({ name, count })),
    ...Object.entries(topicCounts).map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count,
    })),
  ];
  combined.sort((a, b) => b.count - a.count);

  // Deduplicate by lowercase name
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of combined) {
    const key = item.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item.name);
    }
    if (result.length >= 12) break;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helper: find starred repos relevant to a persona's domain
// ---------------------------------------------------------------------------

function findRelevantStars(
  personaId: string,
  stars: RepoData[],
  maxCount: number = 8,
): string[] {
  const signals = DOMAIN_SIGNALS[personaId];
  if (!signals) return [];

  const scored: { name: string; score: number }[] = [];

  for (const repo of stars) {
    const lang = (repo.language || "").toLowerCase();
    const topics = (repo.topics || []).map((t) => t.toLowerCase());
    const desc = (repo.description || "").toLowerCase();

    let score = 0;
    if (signals.languages.some((l) => l.toLowerCase() === lang)) score += 2;
    const topicHits = topics.filter((t) =>
      signals.topics.some((st) => t.includes(st) || st.includes(t)),
    ).length;
    score += topicHits * 3;
    const descHits = signals.descriptionKeywords.filter((kw) =>
      desc.includes(kw),
    ).length;
    score += descHits * 1.5;

    if (score >= 2) {
      const repoName = repo.full_name.split("/")[1] || repo.full_name;
      scored.push({ name: repoName, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCount).map((s) => s.name);
}

// ---------------------------------------------------------------------------
// Helper: generate detail bullet points from repos
// ---------------------------------------------------------------------------

function generateDetails(
  personaId: string,
  stars: RepoData[],
  ownedRepos: RepoData[],
): string[] {
  const signals = DOMAIN_SIGNALS[personaId];
  if (!signals) return [];

  const details: string[] = [];

  // Count owned repos matching this domain
  let ownedCount = 0;
  for (const repo of ownedRepos) {
    const lang = (repo.language || "").toLowerCase();
    const topics = (repo.topics || []).map((t) => t.toLowerCase());
    const desc = (repo.description || "").toLowerCase();

    let score = 0;
    if (signals.languages.some((l) => l.toLowerCase() === lang)) score += 2;
    score +=
      topics.filter((t) =>
        signals.topics.some((st) => t.includes(st) || st.includes(t)),
      ).length * 3;
    score +=
      signals.descriptionKeywords.filter((kw) => desc.includes(kw)).length *
      1.5;

    if (score >= 2) ownedCount++;
  }

  if (ownedCount > 0) {
    details.push(`${ownedCount} owned ${ownedCount === 1 ? "repo" : "repos"} in this domain`);
  }

  // Count starred repos matching this domain
  let starCount = 0;
  for (const repo of stars) {
    const lang = (repo.language || "").toLowerCase();
    const topics = (repo.topics || []).map((t) => t.toLowerCase());
    const desc = (repo.description || "").toLowerCase();

    let score = 0;
    if (signals.languages.some((l) => l.toLowerCase() === lang)) score += 2;
    score +=
      topics.filter((t) =>
        signals.topics.some((st) => t.includes(st) || st.includes(t)),
      ).length * 3;
    score +=
      signals.descriptionKeywords.filter((kw) => desc.includes(kw)).length *
      1.5;

    if (score >= 2) starCount++;
  }

  if (starCount > 0) {
    details.push(`${starCount} starred ${starCount === 1 ? "repo" : "repos"} tracked in this area`);
  }

  // Top languages in this domain
  const domainLangs: Record<string, number> = {};
  for (const repo of [...ownedRepos, ...stars]) {
    if (!repo.language) continue;
    const lang = repo.language.toLowerCase();
    if (signals.languages.some((l) => l.toLowerCase() === lang)) {
      domainLangs[repo.language] = (domainLangs[repo.language] || 0) + 1;
    }
  }
  const topLangs = Object.entries(domainLangs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([l]) => l);
  if (topLangs.length > 0) {
    details.push(`Primary languages: ${topLangs.join(", ")}`);
  }

  return details;
}

// ---------------------------------------------------------------------------
// Generate stat values for a persona card
// ---------------------------------------------------------------------------

function generateStats(
  statLabels: string[],
  normalizedScore: number,
): [string, number][] {
  // Generate stat values derived from the normalized score with some variation
  // per label. We use deterministic offsets based on label index so results
  // are reproducible.
  return statLabels.map((label, i) => {
    const offsets = [-5, 3, -8, 5];
    const offset = offsets[i % offsets.length];
    const value = Math.max(
      30,
      Math.min(100, Math.round(normalizedScore + offset)),
    );
    return [label, value];
  });
}

// ---------------------------------------------------------------------------
// Main: generate full persona card details
// ---------------------------------------------------------------------------

export interface GithubProfile {
  login: string;
  name: string | null;
  email: string | null;
  location: string | null;
  bio: string | null;
  blog: string | null;
  company: string | null;
  avatar_url: string;
  followers: number;
  following: number;
  public_repos: number;
  created_at: string;
}

/**
 * For each active persona, produce a fully populated PersonaCard ready for
 * storage in D1.
 */
export function generatePersonaDetails(
  activePersonas: ActivePersona[],
  normalizedScores: Record<string, number>,
  stars: RepoData[],
  ownedRepos: RepoData[],
  profile: GithubProfile,
  maxScore: number,
): PersonaCard[] {
  return activePersonas.map((ap) => {
    const template = PERSONA_TEMPLATES[ap.persona_id];
    if (!template) {
      // Fallback for unknown persona ids — should not happen
      return {
        persona_id: ap.persona_id,
        title: ap.persona_id,
        tagline: "",
        icon: "?",
        accent_color: "#888888",
        bg_gradient: "linear-gradient(135deg, #111 0%, #222 100%)",
        experience_label: "",
        years_active: "",
        confidence: ap.confidence,
        sort_order: ap.sort_order,
        stats: [],
        stack: [],
        details: [],
        starred_repos: [],
      };
    }

    // Experience / title prefix
    const experience = estimateExperience(
      profile,
      normalizedScores[ap.persona_id] || 0,
      maxScore,
    );

    // Build full title: prefer estimateExperience prefix if non-empty,
    // otherwise fall back to template titlePrefixes[0]
    const prefix =
      experience.prefix ||
      (template.titlePrefixes[0] !== "" ? template.titlePrefixes[0] : "");
    const fullTitle = prefix ? `${prefix} ${template.title}` : template.title;

    // Select tagline (use sort_order index to pick from available taglines)
    const tagline =
      template.taglines[ap.sort_order % template.taglines.length] ||
      template.taglines[0];

    // Stats
    const stats = generateStats(
      template.statLabels,
      normalizedScores[ap.persona_id] || 0,
    );

    // Stack: use template stackPool if non-empty, otherwise derive from repos
    let stack: string[];
    if (template.stackPool.length > 0) {
      stack = template.stackPool.slice(0, 10);
    } else {
      stack = deriveStackFromRepos(ap.persona_id, stars, ownedRepos);
    }

    // Details
    const details = generateDetails(ap.persona_id, stars, ownedRepos);

    // Relevant starred repos
    const starredRepos = findRelevantStars(ap.persona_id, stars);

    // Years active
    const createdYear = new Date(profile.created_at).getFullYear();
    const yearsActive = `${createdYear} - Present`;

    return {
      persona_id: ap.persona_id,
      title: fullTitle,
      tagline,
      icon: template.icon,
      accent_color: template.accentColor,
      bg_gradient: template.bgGradient,
      experience_label: experience.years,
      years_active: yearsActive,
      confidence: ap.confidence,
      sort_order: ap.sort_order,
      stats,
      stack,
      details,
      starred_repos: starredRepos,
    };
  });
}
