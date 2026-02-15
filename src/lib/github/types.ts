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
