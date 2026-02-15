/**
 * GitHub API fetcher with KV caching and pagination.
 *
 * All requests use:
 *   - Authorization via GITHUB_TOKEN secret (5000 req/hour) when available
 *   - Falls back to unauthenticated requests (60 req/hour) if token is missing/invalid
 *   - User-Agent: IdentityDeck/1.0
 *   - Accept: application/vnd.github.v3+json
 *   - per_page=100 for paginated endpoints
 */

import type { GitHubProfile, GitHubRepo, StarsMeta } from "./types";
import { getCached, putCached } from "./cache";

const GITHUB_API = "https://api.github.com";
const USER_AGENT = "IdentityDeck/1.0";
const PER_PAGE = 100;
const MAX_STAR_PAGES = 30; // Cap at 3000 stars

/** Track whether the token is known to be invalid (avoids repeated 401s). */
let tokenInvalid = false;

/** Build auth + accept headers for every GitHub request. */
function githubHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": USER_AGENT,
  };
  if (token && !tokenInvalid) {
    headers.Authorization = `token ${token}`;
  }
  return headers;
}

/** Make a GitHub API request, retrying without auth on 401. */
async function githubFetch(
  url: string,
  token?: string,
): Promise<Response> {
  const res = await fetch(url, { headers: githubHeaders(token) });

  if (res.status === 401 && token && !tokenInvalid) {
    // Token is invalid — mark it and retry without auth
    tokenInvalid = true;
    console.warn("[github/client] GITHUB_TOKEN returned 401, falling back to unauthenticated requests");
    return fetch(url, { headers: githubHeaders() });
  }

  return res;
}

/**
 * Fetch a GitHub user profile, with KV caching.
 * KV key: github:profile:{username}
 */
export async function fetchProfile(
  username: string,
  env: { KV: KVNamespace; GITHUB_TOKEN?: string },
): Promise<GitHubProfile> {
  const cacheKey = `github:profile:${username}`;

  const cached = await getCached<GitHubProfile>(env.KV, cacheKey);
  if (cached) return cached;

  const res = await githubFetch(
    `${GITHUB_API}/users/${username}`,
    env.GITHUB_TOKEN,
  );

  if (res.status === 404) {
    throw new Error(`GitHub user not found: ${username}`);
  }
  if (res.status === 403) {
    throw new Error("GitHub API rate limit exceeded");
  }
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const data: GitHubProfile = await res.json();
  await putCached(env.KV, cacheKey, data);

  return data;
}

/**
 * Fetch all owned (non-fork) repos for a user, paginated, with KV caching.
 * KV key: github:repos:{username}
 */
export async function fetchRepos(
  username: string,
  env: { KV: KVNamespace; GITHUB_TOKEN?: string },
): Promise<GitHubRepo[]> {
  const cacheKey = `github:repos:${username}`;

  const cached = await getCached<GitHubRepo[]>(env.KV, cacheKey);
  if (cached) return cached;

  const repos: GitHubRepo[] = [];
  let page = 1;

  while (true) {
    const res = await githubFetch(
      `${GITHUB_API}/users/${username}/repos?per_page=${PER_PAGE}&page=${page}&sort=pushed`,
      env.GITHUB_TOKEN,
    );

    if (res.status === 404) break;
    if (res.status === 403) throw new Error("GitHub API rate limit exceeded");
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

    const data: GitHubRepo[] = await res.json();
    if (data.length === 0) break;

    repos.push(...data.filter(r => !r.fork));
    if (data.length < PER_PAGE) break;
    page++;
  }

  await putCached(env.KV, cacheKey, repos);
  return repos;
}

/**
 * Fetch all starred repos for a user with per-page KV caching.
 *
 * Each page is individually cached under github:stars:{username}:{page}.
 * A metadata entry at github:stars:{username}:meta tracks overall state.
 *
 * Caps at 30 pages = 3000 stars to stay within Worker CPU limits.
 */
export async function fetchAllStars(
  username: string,
  env: { KV: KVNamespace; GITHUB_TOKEN?: string },
): Promise<GitHubRepo[]> {
  const stars: GitHubRepo[] = [];
  let page = 1;
  let fetchedPages = 0;

  while (page <= MAX_STAR_PAGES) {
    const cacheKey = `github:stars:${username}:${page}`;
    let data = await getCached<GitHubRepo[]>(env.KV, cacheKey);

    if (!data) {
      const res = await githubFetch(
        `${GITHUB_API}/users/${username}/starred?per_page=${PER_PAGE}&page=${page}`,
        env.GITHUB_TOKEN,
      );

      if (res.status === 404) break;
      if (res.status === 403) throw new Error("GitHub API rate limit exceeded");
      if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

      data = await res.json();
      if (!data || data.length === 0) break;

      // Cache this page for 24 hours
      await putCached(env.KV, cacheKey, data);
    }

    fetchedPages++;
    stars.push(...data);
    if (data.length < PER_PAGE) break;
    page++;
  }

  // Store pagination metadata
  const meta: StarsMeta = {
    totalPages: fetchedPages,
    fetchedAt: new Date().toISOString(),
    complete: page <= MAX_STAR_PAGES,
  };
  await putCached(env.KV, `github:stars:${username}:meta`, meta);

  return stars;
}
