// Re-export everything for convenient access
export { DOMAIN_SIGNALS } from "./domain-signals";
export type { DomainSignal } from "./domain-signals";
export { computeCategoryScores, computeDomainScores, computeOwnedRepoScores, normalizeToRadar } from "./scoring";
export type { RepoData } from "./scoring";
export {
  PERSONA_THRESHOLD,
  PERSONA_TEMPLATES,
  determinePersonas,
  generatePersonaDetails,
} from "./personas";
export type { ActivePersona, PersonaTemplate, PersonaCard, GithubProfile } from "./personas";
export { INTEREST_CLUSTERS, clusterStarInterests } from "./interests";
export type { StarInterestCluster } from "./interests";
export { mapRepoToPersonas, generateProjectCards } from "./projects";
export type { ProjectCard } from "./projects";
export { estimateExperience } from "./experience";
export type { ExperienceLevel } from "./experience";
export { CATEGORY_SEEDS, getCategoryById, getCategoriesByGroup } from "./category-seeds";
export type { Category } from "./category-seeds";
export { computeAggregates } from "./aggregates";
export type { Aggregate } from "./aggregates";

// ---------------------------------------------------------------------------
// Imports for the orchestrator
// ---------------------------------------------------------------------------

import { computeCategoryScores, computeOwnedRepoScores, normalizeToRadar } from "./scoring";
import type { RepoData } from "./scoring";
import { determinePersonas, generatePersonaDetails } from "./personas";
import type { PersonaCard, GithubProfile } from "./personas";
import { clusterStarInterests } from "./interests";
import type { StarInterestCluster } from "./interests";
import { generateProjectCards } from "./projects";
import type { ProjectCard } from "./projects";
import { computeAggregates } from "./aggregates";
import type { Aggregate } from "./aggregates";
import type { Category } from "./category-seeds";
import { CATEGORY_SEEDS } from "./category-seeds";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RadarAxis {
  label: string;
  value: number;
  color: string;
  domain: string;
  sort_order: number;
}

export interface FullProfile {
  profile: {
    username: string;
    display_name: string;
    bio: string;
    location: string;
    email: string;
    blog: string;
    company: string;
    avatar_url: string;
    followers: number;
    following: number;
    public_repos: number;
    created_at: string;
  };
  personas: PersonaCard[];
  projects: ProjectCard[];
  radar_axes: RadarAxis[];
  star_interests: StarInterestCluster[];
  aggregates: Aggregate[];
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Compute the full profiles.sh profile from raw GitHub data.
 *
 * Chains all steps:
 *   1a. computeOwnedRepoScores — scores from owned repos only (for persona identity)
 *   1b. computeCategoryScores  — combined scores from stars + owned (for radar footprint)
 *   2.  normalizeToRadar       — scale to 40-100 range
 *   3.  determinePersonas      — active persona list from OWNED scores (>= threshold)
 *   4.  clusterStarInterests   — star interest groups (category-driven)
 *   5.  generatePersonaDetails — full persona card data (uses owned scores)
 *   6.  generateProjectCards   — project cards with category mapping
 *   7.  computeAggregates      — top-10 charts (languages, frameworks, topics, tooling)
 *   8.  Build radar axes       — from activated personas with COMBINED scores
 *
 * Personas represent what you BUILD (owned repos only).
 * Radar and interests represent your full footprint (stars + owned).
 *
 * ALL functions are pure — no side effects, no network calls.
 */
export function computeFullProfile(
  githubProfile: GithubProfile,
  ownedRepos: RepoData[],
  stars: RepoData[],
  categories: Category[] = CATEGORY_SEEDS,
  featuredTopics?: string[],
): FullProfile {
  // Step 1a: Owned-only scores — drives persona identity (what you build)
  const ownedRawScores = computeOwnedRepoScores(ownedRepos, categories, featuredTopics);
  const ownedNormalized = normalizeToRadar(ownedRawScores);

  // Step 1b: Combined scores — drives radar chart (full footprint)
  const combinedRawScores = computeCategoryScores(stars, ownedRepos, categories, featuredTopics);
  const combinedNormalized = normalizeToRadar(combinedRawScores);

  // Step 3: Determine active personas from OWNED scores only
  const activePersonas = determinePersonas(ownedNormalized);

  // Step 4: Cluster star interests using categories
  const starInterests = clusterStarInterests(stars, categories);

  // Find the maximum owned normalized score for experience estimation
  const ownedValues = Object.values(ownedNormalized);
  const maxOwnedScore = Math.max(...ownedValues, 1);

  // Step 5: Generate full persona card details (owned scores for experience/stats)
  const personas = generatePersonaDetails(
    activePersonas,
    ownedNormalized,
    stars,
    ownedRepos,
    githubProfile,
    maxOwnedScore,
  );

  // Step 6: Generate project cards
  const projects = generateProjectCards(ownedRepos, categories);

  // Step 7: Compute top-10 aggregates
  const aggregates = computeAggregates(ownedRepos, stars);

  // Step 8: Build radar axes — use COMBINED scores for the visual footprint
  const radarAxes: RadarAxis[] = activePersonas
    .slice(0, 9)
    .map((ap, index) => {
      const cat = categories.find((c) => c.id === ap.persona_id);
      return {
        label: cat?.title || ap.persona_id,
        value: combinedNormalized[ap.persona_id] || 0,
        color: cat?.accentColor || "#888888",
        domain: ap.persona_id,
        sort_order: index,
      };
    });

  return {
    profile: {
      username: githubProfile.login,
      display_name: githubProfile.name || githubProfile.login,
      bio: githubProfile.bio || "",
      location: githubProfile.location || "",
      email: githubProfile.email || "",
      blog: githubProfile.blog || "",
      company: githubProfile.company || "",
      avatar_url: githubProfile.avatar_url,
      followers: githubProfile.followers,
      following: githubProfile.following,
      public_repos: githubProfile.public_repos,
      created_at: githubProfile.created_at,
    },
    personas,
    projects,
    radar_axes: radarAxes,
    star_interests: starInterests,
    aggregates,
  };
}
