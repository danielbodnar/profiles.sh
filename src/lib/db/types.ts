/**
 * TypeScript row types matching all 6 D1 tables.
 * Mirrors the schema in migrations/0001_init.sql exactly.
 *
 * JSON columns are stored as TEXT in D1 and parsed at the application layer.
 */

/** Row from the `profiles` table */
export interface ProfileRow {
  username: string;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  email: string | null;
  blog: string | null;
  company: string | null;
  avatar_url: string | null;
  followers: number | null;
  following: number | null;
  public_repos: number | null;
  created_at: string | null;
  computed_at: string | null;
  github_data_hash: string | null;
  raw_profile: string | null; // JSON string
}

/** Row from the `personas` table */
export interface PersonaRow {
  id: number;
  username: string;
  persona_id: string;
  title: string;
  tagline: string | null;
  accent_color: string | null;
  icon: string | null;
  experience_label: string | null;
  years_active: string | null;
  confidence: number | null;
  stats: string | null;       // JSON string: [[label, value], ...]
  stack: string | null;       // JSON string: [tech1, tech2, ...]
  details: string | null;     // JSON string: [detail1, detail2, ...]
  starred_repos: string | null; // JSON string: [repo1, repo2, ...]
  employers: string | null;   // JSON string: [employer1, ...]
  links: string | null;       // JSON string: [{label, url}, ...]
  sort_order: number | null;
}

/** Row from the `projects` table */
export interface ProjectRow {
  id: number;
  username: string;
  name: string;
  description: string | null;
  url: string | null;
  tech: string | null;        // JSON string: [tech1, tech2, ...]
  persona_map: string | null;  // JSON string: [persona_id1, persona_id2, ...]
  language: string | null;
  stars: number | null;
  forks: number | null;
  sort_order: number | null;
  readme_excerpt: string | null;
}

/** Row from the `radar_axes` table */
export interface RadarAxisRow {
  id: number;
  username: string;
  label: string;
  value: number;
  color: string | null;
  sort_order: number | null;
}

/** Row from the `star_interests` table */
export interface StarInterestRow {
  id: number;
  username: string;
  label: string;
  count: string | null;
  examples: string | null;
  sort_order: number | null;
}

/** Row from the `user_aggregates` table */
export interface AggregateRow {
  username: string;
  agg_type: string;
  item: string;
  count: number;
  from_owned: number;
  from_starred: number;
  sort_order: number;
}

/** Row from the `customizations` table */
export interface CustomizationRow {
  username: string;
  custom_taglines: string | null;   // JSON string: {persona_id: "tagline"}
  custom_details: string | null;    // JSON string: {persona_id: ["detail1", ...]}
  custom_employers: string | null;  // JSON string: {persona_id: ["employer1", ...]}
  hidden_personas: string | null;   // JSON string: ["persona_id1", ...]
  theme_overrides: string | null;   // JSON string: {darkMode: true, ...}
  featured_repos: string | null;    // JSON string: ["repo-a", "repo-b"]
  featured_topics: string | null;   // JSON string: ["rust", "nushell"]
}

/**
 * Full profile aggregate — all tables joined for a complete profile response.
 * Used by getFullProfile().
 */
export interface FullProfile {
  profile: ProfileRow;
  personas: PersonaRow[];
  projects: ProjectRow[];
  radarAxes: RadarAxisRow[];
  starInterests: StarInterestRow[];
  aggregates: AggregateRow[];
  customizations: CustomizationRow | null;
}
