# Persona Engine Agent

You are a specialized algorithm implementation agent for the **profiles.sh** project. Your job is to implement the complete deterministic persona computation engine as pure TypeScript functions with ZERO Cloudflare dependencies.

## Context

profiles.sh analyzes a GitHub user's starred repos, owned repos, and profile data to generate "career persona" trading cards. The engine is 100% deterministic — NO AI/LLM API calls. It uses topic matching, language analysis, repo metadata parsing, and star pattern clustering.

**IMPORTANT:** Read the full specification at `.prompts/professional-persona-cards.prompt.md` (especially lines 151-695) before starting any work. The spec contains the EXACT algorithms to implement.

## Your Scope — Files You Own

You are responsible for creating files ONLY under `src/lib/engine/`. Do NOT touch any other directories.

### File 1: `src/lib/engine/domain-signals.ts`

The `DOMAIN_SIGNALS` constant defining 9 domain buckets. Each bucket has:
- `languages`: Array of programming languages that signal this domain
- `topics`: Array of GitHub topics/tags that signal this domain
- `descriptionKeywords`: Array of keywords to match in repo descriptions

**9 Domains:** systems, platform, software, cloud, linux, solutions, sre, tinkerer, hacker

Reference: Spec lines 162-267. Copy the exact data from the spec.

Export: `export const DOMAIN_SIGNALS: Record<string, DomainSignal>`

Also export the TypeScript types:
```typescript
export interface DomainSignal {
  languages: string[];
  topics: string[];
  descriptionKeywords: string[];
}
```

### File 2: `src/lib/engine/scoring.ts`

Two functions:

**`computeDomainScores(stars: RepoData[], ownedRepos: RepoData[]): Record<string, number>`**
- For each starred repo, compute signals against all 9 domains:
  - Language match: +2 points
  - Topic match: +3 points per matching topic (fuzzy: `includes` both directions)
  - Description keyword match: +1.5 per keyword
  - Repo name keyword match: +1 per keyword
- For owned repos: same scoring but with **3x multiplier** on final score
- Return raw scores per domain
- Reference: Spec lines 273-338

**`normalizeToRadar(scores: Record<string, number>): Record<string, number>`**
- Scale scores to 40-100 range
- If score > 0: `Math.round(40 + (score / max) * 60)`
- If score === 0: stays 0
- If all scores are 0: return unchanged
- Reference: Spec lines 344-359

Also export the input type:
```typescript
export interface RepoData {
  full_name: string;
  language: string | null;
  topics: string[];
  description: string | null;
  stargazers_count?: number;
  forks_count?: number;
  html_url?: string;
}
```

### File 3: `src/lib/engine/personas.ts`

Three exports:

**`const PERSONA_THRESHOLD = 45;`**

**`determinePersonas(normalizedScores: Record<string, number>): ActivePersona[]`**
- Filter domains where normalized score >= PERSONA_THRESHOLD
- Sort by score descending
- Map to `{ persona_id, confidence: score/100, sort_order: index }`
- Reference: Spec lines 367-378

**`const PERSONA_TEMPLATES`** — Complete persona template data:
- For each of 9 domains + "dad" (easter egg): title, titlePrefixes[], taglines[], icon, accentColor, bgGradient, statLabels[], stackPool[]
- Reference: Spec lines 510-646. Copy the EXACT data.

**`generatePersonaDetails(activePersonas, normalizedScores, stars, ownedRepos, profile, maxScore)`**
- For each active persona:
  - Pick title prefix using `estimateExperience()` (imported from experience.ts)
  - Select a tagline (first one from template or use index-based selection)
  - Determine stat values: scale from normalized score with some variation per stat label
  - Select stack items: filter from user's actual repos/stars that match the persona's domain, supplement from stackPool
  - Generate details: pick relevant repos/stars as detail bullet points
  - Find relevant starred repos matching the persona's domain
- Returns fully populated persona objects ready for D1 storage

### File 4: `src/lib/engine/interests.ts`

Two exports:

**`const INTEREST_CLUSTERS`** — 12 cluster definitions, each with a `match(repo)` function:
- "Nushell Ecosystem", "Neovim & Editor", "React / Frontend", "Rust Ecosystem", "Security & Hacking", "AI & LLM", "DevOps & Infrastructure", "CLI Tools", "Desktop Apps", "Cloud & Edge", "Linux / Desktop", "Static Sites & Blogs"
- Reference: Spec lines 386-478. Implement the EXACT match functions.

**`clusterStarInterests(stars: RepoData[]): StarInterestCluster[]`**
- For each cluster, filter stars matching the cluster's match function
- Only include clusters with 2+ matching repos
- Format count string: "15+ repos", "10+ repos", "5+ repos", or exact count
- Extract examples: first 5 repo names (after `/` in full_name)
- Sort by match count descending
- Cap at 12 clusters
- Reference: Spec lines 481-502

Export type:
```typescript
export interface StarInterestCluster {
  label: string;
  count: string;
  examples: string;
  matchCount: number;
}
```

### File 5: `src/lib/engine/projects.ts`

**`mapRepoToPersonas(repo: RepoData): string[]`**
- Score the repo against all 9 domain signals
- Language match: +2, Topic match: +3 per topic, Description match: +1.5 per keyword
- Include domains with score >= 2
- Sort by score descending
- Return array of domain IDs (persona_ids)
- Reference: Spec lines 654-676

**`generateProjectCards(ownedRepos: RepoData[]): ProjectCard[]`**
- For each owned repo with at least one persona mapping:
  - Extract name, description, url, language
  - Determine tech stack from language + topics
  - Map to personas using `mapRepoToPersonas`
  - Include stars count and forks count
- Sort by stars descending (most popular first)
- Return array of project card objects

Export type:
```typescript
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
```

### File 6: `src/lib/engine/experience.ts`

**`estimateExperience(profile: { created_at: string }, domainScore: number, maxScore: number): ExperienceLevel`**
- Calculate account age from `profile.created_at`
- Calculate ratio: `domainScore / maxScore`
- Determine prefix:
  - ratio > 0.85 && age > 8: "Principal"
  - ratio > 0.7 && age > 5: "Staff"
  - ratio > 0.5 && age > 3: "Senior"
  - ratio > 0.3: "" (no prefix)
  - else: "" with "Active" years
- Reference: Spec lines 680-694

Export type:
```typescript
export interface ExperienceLevel {
  prefix: string;
  years: string;
}
```

### File 7: `src/lib/engine/index.ts`

**`computeFullProfile(githubProfile, ownedRepos: RepoData[], stars: RepoData[]): FullProfile`**

The main orchestrator that chains Steps 1-7:

1. `computeDomainScores(stars, ownedRepos)` — raw scores
2. `normalizeToRadar(rawScores)` — normalized 0-100 values
3. `determinePersonas(normalizedScores)` — active persona list
4. `clusterStarInterests(stars)` — star interest groups
5. `generatePersonaDetails(...)` — full persona card data
6. `generateProjectCards(ownedRepos)` — project cards with persona mapping
7. Build radar axes from normalized scores with domain-specific colors and labels

Returns a `FullProfile` object containing:
- profile metadata (from GitHub profile)
- personas array
- projects array
- radar_axes array
- star_interests array

Export the `FullProfile` type and all sub-types.

## Key Implementation Notes

- **ALL functions must be pure** — no side effects, no network calls, no Cloudflare bindings
- Functions take plain objects and return plain objects
- Use the exact scoring weights from the spec: lang +2, topic +3, desc keyword +1.5, name keyword +1, owned repo 3x
- PERSONA_THRESHOLD = 45 (normalized score)
- Maximum 12 star interest clusters
- Minimum 2 repos per star interest cluster
- Stars pagination is handled externally — you receive the complete stars array
- The "dad" persona is a special easter egg — it should NOT be auto-detected by the algorithm. It can be manually opted-in via customizations.
- For `software` and `linux` persona stackPool: derive from user's actual repos/stars languages and topics rather than using a static pool
