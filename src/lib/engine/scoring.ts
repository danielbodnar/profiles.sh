import { DOMAIN_SIGNALS } from "./domain-signals";

export interface RepoData {
  full_name: string;
  language: string | null;
  topics: string[];
  description: string | null;
  stargazers_count?: number;
  forks_count?: number;
  html_url?: string;
}

/**
 * Compute raw domain scores from starred and owned repos.
 *
 * Scoring per repo per domain:
 *   - Language match: +2 points
 *   - Topic match: +3 points per matching topic (fuzzy: `includes` both directions)
 *   - Description keyword match: +1.5 per keyword
 *   - Repo name keyword match: +1 per keyword
 *
 * Owned repos receive a 3x multiplier on their per-repo score.
 */
export function computeDomainScores(
  stars: RepoData[],
  ownedRepos: RepoData[],
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const domain of Object.keys(DOMAIN_SIGNALS)) {
    scores[domain] = 0;
  }

  for (const repo of stars) {
    const lang = (repo.language || "").toLowerCase();
    const topics = (repo.topics || []).map((t) => t.toLowerCase());
    const desc = (repo.description || "").toLowerCase();
    const name = (repo.full_name || "").toLowerCase();

    for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
      let repoScore = 0;

      // Language match: +2 points
      if (signals.languages.some((l) => l.toLowerCase() === lang)) {
        repoScore += 2;
      }

      // Topic match: +3 points per matching topic
      const topicMatches = topics.filter((t) =>
        signals.topics.some((st) => t.includes(st) || st.includes(t)),
      ).length;
      repoScore += topicMatches * 3;

      // Description keyword match: +1.5 per keyword
      const descMatches = signals.descriptionKeywords.filter((kw) =>
        desc.includes(kw),
      ).length;
      repoScore += descMatches * 1.5;

      // Repo name match: +1 per keyword
      const nameMatches = signals.descriptionKeywords.filter((kw) =>
        name.includes(kw),
      ).length;
      repoScore += nameMatches * 1;

      scores[domain] += repoScore;
    }
  }

  // Owned repos get 3x weight
  for (const repo of ownedRepos) {
    const lang = (repo.language || "").toLowerCase();
    const topics = (repo.topics || []).map((t) => t.toLowerCase());
    const desc = (repo.description || "").toLowerCase();
    const name = (repo.full_name || "").toLowerCase();

    for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
      let repoScore = 0;

      if (signals.languages.some((l) => l.toLowerCase() === lang)) {
        repoScore += 2;
      }

      const topicMatches = topics.filter((t) =>
        signals.topics.some((st) => t.includes(st) || st.includes(t)),
      ).length;
      repoScore += topicMatches * 3;

      const descMatches = signals.descriptionKeywords.filter((kw) =>
        desc.includes(kw),
      ).length;
      repoScore += descMatches * 1.5;

      // Repo name match: +1 per keyword
      const nameMatches = signals.descriptionKeywords.filter((kw) =>
        name.includes(kw),
      ).length;
      repoScore += nameMatches * 1;

      scores[domain] += repoScore * 3; // 3x multiplier for owned repos
    }
  }

  return scores;
}

/**
 * Normalize raw domain scores to a 40-100 radar range.
 *
 * - If all scores are 0, return unchanged.
 * - If score > 0: Math.round(40 + (score / max) * 60)
 * - If score === 0: stays 0
 */
export function normalizeToRadar(
  scores: Record<string, number>,
): Record<string, number> {
  const values = Object.values(scores);
  const max = Math.max(...values);
  if (max === 0) return scores;

  const normalized: Record<string, number> = {};
  for (const [domain, score] of Object.entries(scores)) {
    if (score > 0) {
      normalized[domain] = Math.round(40 + (score / max) * 60);
    } else {
      normalized[domain] = 0;
    }
  }
  return normalized;
}
