import type { RepoData } from "./scoring";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StarInterestCluster {
  label: string;
  count: string;
  examples: string;
  matchCount: number;
}

interface ClusterDefinition {
  match: (repo: RepoData) => boolean;
}

// ---------------------------------------------------------------------------
// Interest Clusters — 12 matchers from spec lines 386-478
// ---------------------------------------------------------------------------

export const INTEREST_CLUSTERS: Record<string, ClusterDefinition> = {
  "Nushell Ecosystem": {
    match: (repo: RepoData): boolean => {
      const name = (repo.full_name || "").toLowerCase();
      const topics = (repo.topics || []).map((t) => t.toLowerCase());
      const lang = (repo.language || "").toLowerCase();
      return (
        name.includes("nushell") ||
        name.includes(".nu") ||
        topics.includes("nushell") ||
        lang === "nushell"
      );
    },
  },
  "Neovim & Editor": {
    match: (repo: RepoData): boolean => {
      const n = (repo.full_name || "").toLowerCase();
      const t = (repo.topics || []).map((x) => x.toLowerCase());
      return (
        t.some((x) =>
          ["neovim", "nvim", "vim", "helix", "editor", "kakoune"].includes(x),
        ) ||
        n.includes("nvim") ||
        n.includes("neovim") ||
        n.includes("helix")
      );
    },
  },
  "React / Frontend": {
    match: (repo: RepoData): boolean => {
      const t = (repo.topics || []).map((x) => x.toLowerCase());
      return t.some((x) =>
        [
          "react", "vue", "svelte", "solid", "frontend",
          "nextjs", "nuxt", "astro",
        ].includes(x),
      );
    },
  },
  "Rust Ecosystem": {
    match: (repo: RepoData): boolean =>
      (repo.language || "").toLowerCase() === "rust",
  },
  "Security & Hacking": {
    match: (repo: RepoData): boolean => {
      const t = (repo.topics || []).map((x) => x.toLowerCase());
      const d = (repo.description || "").toLowerCase();
      return (
        t.some((x) =>
          [
            "security", "cve", "vulnerability", "penetration-testing",
            "hacking", "exploit", "ctf", "cybersecurity",
          ].includes(x),
        ) ||
        d.includes("security") ||
        d.includes("vulnerability") ||
        d.includes("exploit")
      );
    },
  },
  "AI & LLM": {
    match: (repo: RepoData): boolean => {
      const t = (repo.topics || []).map((x) => x.toLowerCase());
      const d = (repo.description || "").toLowerCase();
      return (
        t.some((x) =>
          [
            "ai", "llm", "machine-learning", "gpt", "embeddings",
            "ai-agent", "openai", "anthropic",
          ].includes(x),
        ) ||
        d.includes("ai ") ||
        d.includes("llm") ||
        d.includes("machine learning")
      );
    },
  },
  "DevOps & Infrastructure": {
    match: (repo: RepoData): boolean => {
      const t = (repo.topics || []).map((x) => x.toLowerCase());
      return t.some((x) =>
        [
          "kubernetes", "docker", "terraform", "ansible", "devops",
          "ci-cd", "infrastructure", "helm", "gitops",
        ].includes(x),
      );
    },
  },
  "CLI Tools": {
    match: (repo: RepoData): boolean => {
      const t = (repo.topics || []).map((x) => x.toLowerCase());
      const d = (repo.description || "").toLowerCase();
      return (
        t.some((x) =>
          ["cli", "command-line", "terminal", "tui"].includes(x),
        ) ||
        d.includes("cli") ||
        d.includes("command-line") ||
        d.includes("terminal tool")
      );
    },
  },
  "Desktop Apps": {
    match: (repo: RepoData): boolean => {
      const t = (repo.topics || []).map((x) => x.toLowerCase());
      return t.some((x) =>
        [
          "tauri", "electron", "desktop", "gtk", "qt",
          "cross-platform", "native-app",
        ].includes(x),
      );
    },
  },
  "Cloud & Edge": {
    match: (repo: RepoData): boolean => {
      const t = (repo.topics || []).map((x) => x.toLowerCase());
      const d = (repo.description || "").toLowerCase();
      return (
        t.some((x) =>
          [
            "cloudflare", "aws", "serverless", "edge", "workers",
            "lambda", "vercel", "cloud",
          ].includes(x),
        ) ||
        d.includes("cloudflare") ||
        d.includes("serverless") ||
        d.includes("edge function")
      );
    },
  },
  "Linux / Desktop": {
    match: (repo: RepoData): boolean => {
      const t = (repo.topics || []).map((x) => x.toLowerCase());
      return t.some((x) =>
        [
          "linux", "wayland", "hyprland", "sway", "i3",
          "window-manager", "desktop-environment", "systemd",
          "dotfiles", "rice",
        ].includes(x),
      );
    },
  },
  "Static Sites & Blogs": {
    match: (repo: RepoData): boolean => {
      const t = (repo.topics || []).map((x) => x.toLowerCase());
      const d = (repo.description || "").toLowerCase();
      return (
        t.some((x) =>
          [
            "zola", "hugo", "jekyll", "static-site", "blog",
            "astro", "ssg", "11ty",
          ].includes(x),
        ) ||
        d.includes("static site") ||
        d.includes("blog theme")
      );
    },
  },
};

// ---------------------------------------------------------------------------
// Cluster starred repos into interest groups
// ---------------------------------------------------------------------------

/**
 * For each cluster, filter stars matching the cluster's match function.
 * Only include clusters with 2+ matching repos.
 * Sort by match count descending, cap at 12 clusters.
 */
export function clusterStarInterests(stars: RepoData[]): StarInterestCluster[] {
  const results: {
    label: string;
    count: string;
    examples: string;
    matchCount: number;
  }[] = [];

  for (const [label, config] of Object.entries(INTEREST_CLUSTERS)) {
    const matching = stars.filter(config.match);
    if (matching.length >= 2) {
      // Format count string
      const countStr =
        matching.length >= 15
          ? "15+ repos"
          : matching.length >= 10
            ? "10+ repos"
            : matching.length >= 5
              ? "5+ repos"
              : matching.length + " repos";

      // Extract examples: first 5 repo names (after `/` in full_name)
      const examples = matching
        .slice(0, 5)
        .map((r) => r.full_name.split("/")[1])
        .join(", ");

      results.push({
        label,
        count: countStr,
        examples,
        matchCount: matching.length,
      });
    }
  }

  // Sort by match count descending, cap at 12
  results.sort((a, b) => b.matchCount - a.matchCount);
  return results.slice(0, 12);
}
