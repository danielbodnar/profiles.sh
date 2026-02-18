/**
 * TypeScript interfaces for GitHub API responses.
 * These map to the subset of fields we consume from the GitHub REST API v3.
 */

/** GET /users/:username */
export interface GitHubProfile {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

/** GET /users/:username/repos and /users/:username/starred */
export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
  description: string | null;
  fork: boolean;
  language: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  homepage: string | null;
  archived: boolean;
  disabled: boolean;
  license: {
    key: string;
    name: string;
    spdx_id: string;
  } | null;
}

/** Metadata stored alongside paginated star pages in KV */
export interface StarsMeta {
  totalPages: number;
  fetchedAt: string;
  complete: boolean;
}

/**
 * Entry returned by GitHub stars API when using `Accept: application/vnd.github.star+json`.
 * Wraps each repo with its `starred_at` timestamp.
 */
export interface GitHubStarEntry {
  starred_at: string;
  repo: GitHubRepo;
}

/** Shape of the user's `profiles-sh.json` gist for profile customization. */
export interface GistConfig {
  featured_repos?: string[];
  featured_topics?: string[];
  hidden_categories?: string[];
  theme?: string;
  tagline_overrides?: Record<string, string>;
}

/** GitHub Gist API response (subset of fields we use). */
export interface GitHubGist {
  id: string;
  files: Record<string, { filename: string; raw_url: string; content?: string } | undefined>;
}
