/**
 * GitHub API fetcher with KV caching and pagination.
 *
 * All requests use:
 *   - Authorization via GITHUB_TOKEN secret (5000 req/hour) when available
 *   - Falls back to unauthenticated requests (60 req/hour) if token is missing/invalid
 *   - User-Agent: ProfilesSh/1.0
 *   - Accept: application/vnd.github.v3+json
 *   - per_page configurable (default 100)
 */

import type { GitHubProfile, GitHubRepo, GitHubStarEntry, StarsMeta } from "./types";
import { getCached, putCached } from "./cache";
import type { AppConfig } from "../config";
import { putRepoObject, getRepoObject } from "../r2/repo-store";
import { getStarManifest, putStarManifest } from "../r2/star-manifest";
import type { StarManifest } from "../r2/star-manifest";

const GITHUB_API = "https://api.github.com";
const USER_AGENT = "ProfilesSh/1.0";

/** Track whether the token is known to be invalid (avoids repeated 401s). */
let tokenInvalid = false;

/** Build auth + accept headers for every GitHub request. */
function githubHeaders(token?: string, accept?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: accept ?? "application/vnd.github.v3+json",
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
  accept?: string,
): Promise<Response> {
  const res = await fetch(url, { headers: githubHeaders(token, accept) });

  if (res.status === 401 && token && !tokenInvalid) {
    // Token is invalid — mark it and retry without auth
    tokenInvalid = true;
    console.warn("[github/client] GITHUB_TOKEN returned 401, falling back to unauthenticated requests");
    return fetch(url, { headers: githubHeaders(undefined, accept) });
  }

  return res;
}

/**
 * Fetch a GitHub user profile, with KV caching.
 * KV key: github:profile:{username}
 */
export async function fetchProfile(
  username: string,
  env: { KV?: KVNamespace; GITHUB_TOKEN?: string },
  config?: Pick<AppConfig, "cacheTtl">,
): Promise<GitHubProfile> {
  const ttl = config?.cacheTtl ?? 86400;
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
  await putCached(env.KV, cacheKey, data, ttl);

  return data;
}

/**
 * Fetch all owned (non-fork) repos for a user, paginated, with KV caching.
 * KV key: github:repos:{username}
 *
 * Caps at `config.maxRepoPages` pages (default 5 = 500 repos).
 */
export async function fetchRepos(
  username: string,
  env: { KV?: KVNamespace; GITHUB_TOKEN?: string },
  config?: Pick<AppConfig, "githubPerPage" | "maxRepoPages" | "cacheTtl">,
): Promise<GitHubRepo[]> {
  const perPage = config?.githubPerPage ?? 100;
  const maxPages = config?.maxRepoPages ?? 5;
  const ttl = config?.cacheTtl ?? 86400;
  const cacheKey = `github:repos:${username}`;

  const cached = await getCached<GitHubRepo[]>(env.KV, cacheKey);
  if (cached) return cached;

  const repos: GitHubRepo[] = [];
  let page = 1;

  while (page <= maxPages) {
    const res = await githubFetch(
      `${GITHUB_API}/users/${username}/repos?per_page=${perPage}&page=${page}&sort=pushed`,
      env.GITHUB_TOKEN,
    );

    if (res.status === 404) break;
    if (res.status === 403) throw new Error("GitHub API rate limit exceeded");
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

    const data: GitHubRepo[] = await res.json();
    if (data.length === 0) break;

    repos.push(...data.filter(r => !r.fork));
    if (data.length < perPage) break;
    page++;
  }

  await putCached(env.KV, cacheKey, repos, ttl);
  return repos;
}

/**
 * Fetch all starred repos for a user with per-page KV caching.
 *
 * Each page is individually cached under github:stars:{username}:{page}.
 * A metadata entry at github:stars:{username}:meta tracks overall state.
 *
 * Caps at `config.maxStarPages` pages (default 50 = 5000 stars).
 */
export async function fetchAllStars(
  username: string,
  env: { KV?: KVNamespace; GITHUB_TOKEN?: string },
  config?: Pick<AppConfig, "githubPerPage" | "maxStarPages" | "cacheTtl">,
): Promise<GitHubRepo[]> {
  const perPage = config?.githubPerPage ?? 100;
  const maxPages = config?.maxStarPages ?? 50;
  const ttl = config?.cacheTtl ?? 86400;

  const stars: GitHubRepo[] = [];
  let page = 1;
  let fetchedPages = 0;

  while (page <= maxPages) {
    const cacheKey = `github:stars:${username}:${page}`;
    let data = await getCached<GitHubRepo[]>(env.KV, cacheKey);

    if (!data) {
      const res = await githubFetch(
        `${GITHUB_API}/users/${username}/starred?per_page=${perPage}&page=${page}`,
        env.GITHUB_TOKEN,
      );

      if (res.status === 404) break;
      if (res.status === 403) throw new Error("GitHub API rate limit exceeded");
      if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

      data = await res.json();
      if (!data || data.length === 0) break;

      await putCached(env.KV, cacheKey, data, ttl);
    }

    fetchedPages++;
    stars.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  // Store pagination metadata
  const meta: StarsMeta = {
    totalPages: fetchedPages,
    fetchedAt: new Date().toISOString(),
    complete: page <= maxPages,
  };
  await putCached(env.KV, `github:stars:${username}:meta`, meta, ttl);

  return stars;
}

/**
 * Incremental star fetch using R2 as durable cache.
 *
 * Uses `Accept: application/vnd.github.star+json` to get `starred_at`
 * timestamps, sorted newest-first. Stops paginating when we hit a star
 * older than the last known `starred_at` from the R2 manifest.
 *
 * On first run (no manifest), does a full fetch and writes everything to R2.
 * Returns all GitHubRepo[] (new from API + existing from R2 manifest refs).
 */
export async function fetchStarsIncremental(
  username: string,
  env: { KV?: KVNamespace; R2?: R2Bucket; GITHUB_TOKEN?: string },
  config?: Pick<AppConfig, "githubPerPage" | "maxStarPages" | "cacheTtl">,
): Promise<GitHubRepo[]> {
  if (!env.R2) {
    // Fallback to legacy fetch if R2 unavailable
    return fetchAllStars(username, env, config);
  }

  const perPage = config?.githubPerPage ?? 100;
  const maxPages = config?.maxStarPages ?? 50;

  // 1. Read existing manifest from R2
  const manifest = await getStarManifest(env.R2, username);
  const lastStarredAt = manifest?.last_starred_at ?? null;

  // 2. Paginate GitHub stars API (newest first)
  const newRepos: GitHubRepo[] = [];
  const newRefs: string[] = [];
  let newestStarredAt = lastStarredAt;
  let page = 1;
  let hitExisting = false;

  while (page <= maxPages && !hitExisting) {
    const url = `${GITHUB_API}/users/${username}/starred?per_page=${perPage}&page=${page}&sort=created&direction=desc`;
    const res = await githubFetch(url, env.GITHUB_TOKEN, "application/vnd.github.star+json");

    if (res.status === 404) break;
    if (res.status === 403) throw new Error("GitHub API rate limit exceeded");
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

    const entries: GitHubStarEntry[] = await res.json();
    if (!entries || entries.length === 0) break;

    for (const entry of entries) {
      // Early termination: this star is older than our last known
      if (lastStarredAt && entry.starred_at <= lastStarredAt) {
        hitExisting = true;
        break;
      }

      // Track newest starred_at
      if (!newestStarredAt || entry.starred_at > newestStarredAt) {
        newestStarredAt = entry.starred_at;
      }

      newRepos.push(entry.repo);
      newRefs.push(entry.repo.full_name);
    }

    if (entries.length < perPage) break;
    page++;
  }

  // 2b. Write new repo objects to R2 in parallel batches (frontmatter only, no README yet)
  const r2BatchSize = 50;
  for (let i = 0; i < newRepos.length; i += r2BatchSize) {
    const batch = newRepos.slice(i, i + r2BatchSize);
    await Promise.allSettled(batch.map((repo) => putRepoObject(env.R2!, repo)));
  }

  console.log(
    `[github/client] Stars incremental: ${newRefs.length} new stars fetched in ${page} pages for ${username}`,
  );

  // 3. Build complete repo list: new repos + existing refs loaded from R2
  const existingRefs = manifest?.refs ?? [];
  const allRefs = [...new Set([...newRefs, ...existingRefs])];

  // 4. Update manifest
  const updatedManifest: StarManifest = {
    username,
    last_starred_at: newestStarredAt,
    total: allRefs.length,
    fetched_at: new Date().toISOString(),
    refs: allRefs,
  };
  await putStarManifest(env.R2, username, updatedManifest);

  // 5. Return all repos: new ones we already have in memory,
  //    plus existing ones loaded from R2 (only need the repo data for scoring)
  const existingOnlyRefs = existingRefs.filter((ref) => !newRefs.includes(ref));
  const existingRepos = await loadReposFromR2(env.R2, existingOnlyRefs);

  return [...newRepos, ...existingRepos];
}

/** Load repo objects from R2 by full_name refs, converting back to GitHubRepo shape. */
async function loadReposFromR2(
  r2: R2Bucket,
  refs: string[],
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  // Process in batches to avoid overwhelming R2
  const batchSize = 50;
  for (let i = 0; i < refs.length; i += batchSize) {
    const batch = refs.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((ref) => getRepoObject(r2, ref)),
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        repos.push(repoObjectToGitHubRepo(result.value));
      }
    }
  }
  return repos;
}

/** Convert an R2 RepoObject back to the GitHubRepo shape the engine expects. */
function repoObjectToGitHubRepo(obj: import("../r2/repo-store").RepoObject): GitHubRepo {
  return {
    id: 0,
    full_name: obj.full_name,
    name: obj.name,
    owner: { login: obj.owner, avatar_url: "" },
    html_url: obj.html_url,
    description: obj.description,
    fork: false,
    language: obj.language,
    stargazers_count: obj.stargazers_count,
    watchers_count: 0,
    forks_count: obj.forks_count,
    open_issues_count: 0,
    topics: obj.topics,
    created_at: obj.created_at,
    updated_at: obj.created_at,
    pushed_at: obj.pushed_at,
    homepage: null,
    archived: obj.archived,
    disabled: false,
    license: obj.license ? { key: obj.license, name: obj.license, spdx_id: obj.license } : null,
  };
}

/**
 * Fetch raw README content for a repo.
 * Returns null on 404 (no README) or error.
 */
export async function fetchReadme(
  fullName: string,
  env: { GITHUB_TOKEN?: string },
): Promise<string | null> {
  try {
    const res = await githubFetch(
      `${GITHUB_API}/repos/${fullName}/readme`,
      env.GITHUB_TOKEN,
      "application/vnd.github.v3.raw",
    );

    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Fetch public org memberships for a user, with KV caching.
 * KV key: github:orgs:{username}
 *
 * Returns an array of org login names.
 */
export async function fetchUserOrgs(
  username: string,
  env: { KV?: KVNamespace; GITHUB_TOKEN?: string },
  config?: Pick<AppConfig, "cacheTtl">,
): Promise<string[]> {
  const ttl = config?.cacheTtl ?? 86400;
  const cacheKey = `github:orgs:${username}`;

  const cached = await getCached<string[]>(env.KV, cacheKey);
  if (cached) return cached;

  const res = await githubFetch(
    `${GITHUB_API}/users/${username}/orgs`,
    env.GITHUB_TOKEN,
  );

  if (!res.ok) {
    // Non-fatal: return empty if orgs can't be fetched
    console.warn(`[github/client] Failed to fetch orgs for ${username}: ${res.status}`);
    return [];
  }

  const data: { login: string }[] = await res.json();
  const logins = data.map((o) => o.login);
  await putCached(env.KV, cacheKey, logins, ttl);

  return logins;
}

/**
 * Fetch repos for a single org, paginated, with KV caching.
 * KV key: github:repos:org:{orgname}
 *
 * Uses `type=sources` to exclude forks at the API level.
 * Caps at `config.maxRepoPages` pages (default 5 = 500 repos per org).
 */
export async function fetchOrgRepos(
  org: string,
  env: { KV?: KVNamespace; GITHUB_TOKEN?: string },
  config?: Pick<AppConfig, "githubPerPage" | "maxRepoPages" | "cacheTtl">,
): Promise<GitHubRepo[]> {
  const perPage = config?.githubPerPage ?? 100;
  const maxPages = config?.maxRepoPages ?? 5;
  const ttl = config?.cacheTtl ?? 86400;
  const cacheKey = `github:repos:org:${org}`;

  const cached = await getCached<GitHubRepo[]>(env.KV, cacheKey);
  if (cached) return cached;

  const repos: GitHubRepo[] = [];
  let page = 1;

  while (page <= maxPages) {
    const res = await githubFetch(
      `${GITHUB_API}/orgs/${org}/repos?per_page=${perPage}&page=${page}&sort=pushed&type=sources`,
      env.GITHUB_TOKEN,
    );

    if (res.status === 404) break;
    if (res.status === 403) throw new Error("GitHub API rate limit exceeded");
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

    const data: GitHubRepo[] = await res.json();
    if (data.length === 0) break;

    repos.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  await putCached(env.KV, cacheKey, repos, ttl);
  return repos;
}

/**
 * Fetch all owned repos: personal + all org repos, deduplicated by full_name.
 *
 * Orchestrates fetchRepos() + fetchUserOrgs() + fetchOrgRepos() in parallel.
 */
export async function fetchAllOwnedRepos(
  username: string,
  env: { KV?: KVNamespace; GITHUB_TOKEN?: string },
  config?: Pick<AppConfig, "githubPerPage" | "maxRepoPages" | "cacheTtl">,
): Promise<GitHubRepo[]> {
  const [personalRepos, orgs] = await Promise.all([
    fetchRepos(username, env, config),
    fetchUserOrgs(username, env, config),
  ]);

  // Fetch org repos in parallel (all orgs at once)
  const orgRepoArrays = await Promise.all(
    orgs.map((org) => fetchOrgRepos(org, env, config)),
  );

  // Combine and deduplicate by full_name
  const seen = new Set(personalRepos.map((r) => r.full_name));
  const allRepos = [...personalRepos];
  for (const orgRepos of orgRepoArrays) {
    for (const repo of orgRepos) {
      if (!seen.has(repo.full_name)) {
        seen.add(repo.full_name);
        allRepos.push(repo);
      }
    }
  }
  return allRepos;
}

// ---------------------------------------------------------------------------
// Repo filtering
// ---------------------------------------------------------------------------

/**
 * Filter out archived, disabled, and inactive repos.
 *
 * A repo is considered inactive if its last push was more than
 * `inactiveYears` years ago (default 3).
 */
export function filterActiveRepos(
  repos: GitHubRepo[],
  inactiveYears = 3,
): GitHubRepo[] {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - inactiveYears);

  return repos.filter((r) =>
    !r.archived &&
    !r.disabled &&
    (!r.pushed_at || new Date(r.pushed_at) >= cutoff)
  );
}
