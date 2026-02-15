import { DOMAIN_SIGNALS } from "./domain-signals";
import type { RepoData } from "./scoring";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectCard {
  name: string;
  description: string;
  url: string;
  tech: string[];
  persona_map: string[];
  language: string;
  stars: number;
  forks: number;
}

// ---------------------------------------------------------------------------
// Map a single repo to its matching persona domains
// ---------------------------------------------------------------------------

/**
 * Score a repo against all 9 domain signals.
 *   - Language match: +2
 *   - Topic match: +3 per matching topic
 *   - Description keyword match: +1.5 per keyword
 *
 * Include domains with score >= 2. Return sorted by score descending.
 */
export function mapRepoToPersonas(repo: RepoData): string[] {
  const lang = (repo.language || "").toLowerCase();
  const topics = (repo.topics || []).map((t) => t.toLowerCase());
  const desc = (repo.description || "").toLowerCase();

  const mapped: { domain: string; score: number }[] = [];

  for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
    let score = 0;

    if (signals.languages.some((l) => l.toLowerCase() === lang)) {
      score += 2;
    }

    const topicHits = topics.filter((t) =>
      signals.topics.some((st) => t.includes(st) || st.includes(t)),
    ).length;
    score += topicHits * 3;

    const descHits = signals.descriptionKeywords.filter((kw) =>
      desc.includes(kw),
    ).length;
    score += descHits * 1.5;

    if (score >= 2) {
      mapped.push({ domain, score });
    }
  }

  return mapped.sort((a, b) => b.score - a.score).map((m) => m.domain);
}

// ---------------------------------------------------------------------------
// Generate project cards from owned repos
// ---------------------------------------------------------------------------

/**
 * For each owned repo with at least one persona mapping:
 *   - Extract name, description, url, language
 *   - Determine tech stack from language + topics
 *   - Map to personas using mapRepoToPersonas
 *   - Include stars and forks count
 *
 * Sort by stars descending (most popular first).
 */
export function generateProjectCards(ownedRepos: RepoData[]): ProjectCard[] {
  const cards: ProjectCard[] = [];

  for (const repo of ownedRepos) {
    const personaMap = mapRepoToPersonas(repo);
    if (personaMap.length === 0) continue;

    // Build tech stack from language + topics
    const tech: string[] = [];
    if (repo.language) {
      tech.push(repo.language);
    }
    for (const topic of repo.topics || []) {
      // Capitalize topic for display
      const display = topic
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      if (!tech.includes(display) && display.toLowerCase() !== (repo.language || "").toLowerCase()) {
        tech.push(display);
      }
      if (tech.length >= 8) break;
    }

    const name = repo.full_name.split("/")[1] || repo.full_name;

    cards.push({
      name,
      description: repo.description || "",
      url: repo.html_url || `https://github.com/${repo.full_name}`,
      tech,
      persona_map: personaMap,
      language: repo.language || "",
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
    });
  }

  // Sort by stars descending
  cards.sort((a, b) => b.stars - a.stars);

  return cards;
}
