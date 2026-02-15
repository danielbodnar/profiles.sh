// Re-export everything for convenient access
export { DOMAIN_SIGNALS } from "./domain-signals";
export type { DomainSignal } from "./domain-signals";
export { computeDomainScores, normalizeToRadar } from "./scoring";
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

// ---------------------------------------------------------------------------
// Imports for the orchestrator
// ---------------------------------------------------------------------------

import { computeDomainScores, normalizeToRadar } from "./scoring";
import type { RepoData } from "./scoring";
import { determinePersonas, generatePersonaDetails } from "./personas";
import type { PersonaCard, GithubProfile } from "./personas";
import { clusterStarInterests } from "./interests";
import type { StarInterestCluster } from "./interests";
import { generateProjectCards } from "./projects";
import type { ProjectCard } from "./projects";

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
}

// ---------------------------------------------------------------------------
// Radar axis metadata (label + color per domain)
// ---------------------------------------------------------------------------

const RADAR_AXIS_META: Record<string, { label: string; color: string }> = {
  systems: { label: "Rust/Systems", color: "#4A90D9" },
  platform: { label: "Platform/IaC", color: "#7C4DFF" },
  software: { label: "TypeScript/JS", color: "#00E676" },
  cloud: { label: "Cloud/Infra", color: "#40C4FF" },
  linux: { label: "Linux/Desktop", color: "#FFEB3B" },
  solutions: { label: "Solutions", color: "#FF9800" },
  sre: { label: "Security", color: "#FF5252" },
  tinkerer: { label: "AI/LLM", color: "#FFD54F" },
  hacker: { label: "Neovim/Editor", color: "#00FF41" },
};

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Compute the full Identity Deck profile from raw GitHub data.
 *
 * Chains all 7 steps:
 *   1. computeDomainScores  — raw scores from stars + owned repos
 *   2. normalizeToRadar     — scale to 40-100 range
 *   3. determinePersonas    — active persona list (>= threshold)
 *   4. clusterStarInterests — star interest groups
 *   5. generatePersonaDetails — full persona card data
 *   6. generateProjectCards — project cards with persona mapping
 *   7. Build radar axes     — from normalized scores with colors/labels
 *
 * ALL functions are pure — no side effects, no network calls.
 */
export function computeFullProfile(
  githubProfile: GithubProfile,
  ownedRepos: RepoData[],
  stars: RepoData[],
): FullProfile {
  // Step 1: Compute raw domain scores
  const rawScores = computeDomainScores(stars, ownedRepos);

  // Step 2: Normalize to 0-100 radar values
  const normalizedScores = normalizeToRadar(rawScores);

  // Step 3: Determine active personas
  const activePersonas = determinePersonas(normalizedScores);

  // Step 4: Cluster star interests
  const starInterests = clusterStarInterests(stars);

  // Find the maximum normalized score for experience estimation
  const normalizedValues = Object.values(normalizedScores);
  const maxScore = Math.max(...normalizedValues, 1); // avoid division by zero

  // Step 5: Generate full persona card details
  const personas = generatePersonaDetails(
    activePersonas,
    normalizedScores,
    stars,
    ownedRepos,
    githubProfile,
    maxScore,
  );

  // Step 6: Generate project cards
  const projects = generateProjectCards(ownedRepos);

  // Step 7: Build radar axes from normalized scores
  const radarAxes: RadarAxis[] = Object.entries(normalizedScores)
    .filter(([domain]) => RADAR_AXIS_META[domain] !== undefined)
    .map(([domain, value], index) => {
      const meta = RADAR_AXIS_META[domain];
      return {
        label: meta.label,
        value,
        color: meta.color,
        domain,
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
  };
}
