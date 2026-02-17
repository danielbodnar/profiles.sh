/**
 * Queue batch handler for background profile computation.
 *
 * Receives messages of shape { username, requestedAt } from PROFILE_QUEUE.
 * For each message:
 *   1. Fetch GitHub data (profile, repos, stars)
 *   2. Run the persona engine (deterministic algorithms)
 *   3. Transform engine output to D1 row shapes
 *   4. Write computed results to D1
 *   5. Generate OG image and store in R2
 *
 * Reference: spec lines 910-940.
 */

import { fetchProfile, fetchRepos, fetchStarsIncremental, fetchReadme, filterActiveRepos } from "./github/client";
import { putRepoObject } from "./r2/repo-store";
import { putRepoManifest } from "./r2/repo-manifest";
import { indexRepos } from "./vectorize/indexer";
import {
  upsertProfile,
  upsertPersonas,
  upsertProjects,
  upsertRadarAxes,
  upsertStarInterests,
  upsertAggregates,
} from "./db/queries";
import type { ProfileRow } from "./db/types";
import { generateOGImage } from "./og/generator";
import { computeFullProfile } from "./engine/index";
import { resolveConfig } from "./config";
import type { AppConfig } from "./config";

/** Shape of messages produced by the API layer onto PROFILE_QUEUE. */
export interface QueueMessage {
  username: string;
  requestedAt: number;
}

/**
 * Queue batch handler. Exported so it can be wired into the Worker entrypoint.
 *
 * Usage in the Worker entrypoint:
 *   export default {
 *     async queue(batch, env) { await handleQueueBatch(batch, env); }
 *   };
 */
export async function handleQueueBatch(
  batch: MessageBatch<QueueMessage>,
  env: Env,
): Promise<void> {
  const config = resolveConfig(env as unknown as Record<string, string | undefined>);

  for (const msg of batch.messages) {
    try {
      const { username } = msg.body;
      await processUsername(username, env, config);
      msg.ack();
    } catch (err) {
      console.error(
        `[queue-consumer] Failed to process ${msg.body.username}:`,
        err,
      );
      msg.retry();
    }
  }
}

/**
 * Full pipeline for a single username:
 *   GitHub fetch -> filter -> persona engine -> transform -> D1 persist -> OG image.
 */
export async function processUsername(
  username: string,
  env: Env,
  config?: AppConfig,
): Promise<void> {
  // 1. Fetch GitHub data (R2 incremental for stars, KV cached for profile/repos)
  const [githubProfile, rawRepos, rawStars] = await Promise.all([
    fetchProfile(username, env, config),
    fetchRepos(username, env, config),
    fetchStarsIncremental(username, env, config),
  ]);

  // One-time cleanup: remove old per-page KV star keys
  await cleanupLegacyStarKeys(username, env.KV);

  // 2. Filter out archived + inactive repos
  const inactiveYears = config?.inactiveYears ?? 3;
  const repos = filterActiveRepos(rawRepos, inactiveYears);
  const stars = filterActiveRepos(rawStars, inactiveYears);

  // 2b. Store owned repos in R2 + fetch READMEs (non-fatal)
  const readmeMap = new Map<string, string>();
  if (env.R2) {
    try {
      // Fetch READMEs with concurrency limiting (5 at a time)
      const readmeResults = await batchProcess(
        repos,
        async (repo) => {
          const readme = await fetchReadme(repo.full_name, env);
          await putRepoObject(env.R2!, repo, readme);
          return { fullName: repo.full_name, readme };
        },
        5,
        "README fetch",
      );
      for (const { fullName, readme } of readmeResults) {
        if (readme) readmeMap.set(fullName, readme);
      }

      // Write repo manifest
      await putRepoManifest(env.R2, username, {
        username,
        total: repos.length,
        fetched_at: new Date().toISOString(),
        refs: repos.map((r) => r.full_name),
      });
    } catch (err) {
      console.warn(`[queue-consumer] R2 repo storage failed for ${username}:`, err);
    }
  }

  // 3. Run persona engine (deterministic — no AI/LLM)
  const computed = computeFullProfile(githubProfile, repos, stars);

  // 4. Build a simple hash of raw data to detect changes on next run
  const githubDataHash = simpleHash(
    JSON.stringify({
      login: githubProfile.login,
      public_repos: githubProfile.public_repos,
      followers: githubProfile.followers,
      repoCount: repos.length,
      starCount: stars.length,
    }),
  );

  // 5. Build profile row
  const profileRow: ProfileRow = {
    username: githubProfile.login,
    display_name: githubProfile.name,
    bio: githubProfile.bio,
    location: githubProfile.location,
    email: githubProfile.email,
    blog: githubProfile.blog,
    company: githubProfile.company,
    avatar_url: githubProfile.avatar_url,
    followers: githubProfile.followers,
    following: githubProfile.following,
    public_repos: githubProfile.public_repos,
    created_at: githubProfile.created_at,
    computed_at: new Date().toISOString(),
    github_data_hash: githubDataHash,
    raw_profile: JSON.stringify(githubProfile),
  };

  // 6. Transform engine output to D1 row shapes
  const personaRows = computed.personas.map((p) => ({
    persona_id: p.persona_id,
    title: p.title,
    tagline: p.tagline,
    accent_color: p.accent_color,
    icon: p.icon,
    experience_label: p.experience_label,
    years_active: p.years_active,
    confidence: p.confidence,
    stats: JSON.stringify(p.stats),
    stack: JSON.stringify(p.stack),
    details: JSON.stringify(p.details),
    starred_repos: JSON.stringify(p.starred_repos),
    employers: null,
    links: null,
    sort_order: p.sort_order,
  }));

  const projectRows = computed.projects.map((p, i) => ({
    name: p.name,
    description: p.description,
    url: p.url,
    tech: JSON.stringify(p.tech),
    persona_map: JSON.stringify(p.persona_map),
    language: p.language,
    stars: p.stars,
    forks: p.forks,
    sort_order: i,
    readme_excerpt: truncateReadme(readmeMap.get(p.name) ?? readmeMap.get(`${username}/${p.name}`) ?? null),
  }));

  const radarRows = computed.radar_axes.map((a) => ({
    label: a.label,
    value: a.value,
    color: a.color,
    sort_order: a.sort_order,
  }));

  const interestRows = computed.star_interests.map((s, i) => ({
    label: s.label,
    count: s.count,
    examples: s.examples,
    sort_order: i,
  }));

  const aggregateRows = computed.aggregates.map((a, i) => ({
    agg_type: a.type,
    item: a.item,
    count: a.count,
    from_owned: a.fromOwned,
    from_starred: a.fromStarred,
    sort_order: i,
  }));

  // 7. Write everything to D1 (skip gracefully if DB unavailable)
  if (env.DB) {
    try {
      await upsertProfile(env.DB, profileRow);
      await Promise.all([
        upsertPersonas(env.DB, username, personaRows),
        upsertProjects(env.DB, username, projectRows),
        upsertRadarAxes(env.DB, username, radarRows),
        upsertStarInterests(env.DB, username, interestRows),
        upsertAggregates(env.DB, username, aggregateRows),
      ]);
    } catch (err) {
      console.warn(`[queue-consumer] D1 write failed for ${username}:`, err);
    }
  } else {
    console.warn(`[queue-consumer] D1 unavailable, skipping persistence for ${username}`);
  }

  // 8. Generate OG image (stores in R2, non-fatal)
  try {
    await generateOGImage(profileRow, personaRows, env);
  } catch (err) {
    console.warn(`[queue-consumer] OG image generation failed for ${username}:`, err);
  }

  // 9. Index repos into Vectorize for semantic search (non-fatal)
  if (env.AI && env.VECTORIZE) {
    try {
      const allRepos = [...repos, ...stars];
      await indexRepos(env.AI, env.VECTORIZE, allRepos, username, readmeMap);
    } catch (err) {
      console.warn(`[queue-consumer] Vectorize indexing failed for ${username}:`, err);
    }
  }
}

/** Truncate README to ~2000 chars at a paragraph boundary. */
function truncateReadme(readme: string | null, maxLen = 2000): string | null {
  if (!readme) return null;
  if (readme.length <= maxLen) return readme;
  const cut = readme.lastIndexOf("\n\n", maxLen);
  return readme.slice(0, cut > 0 ? cut : maxLen) + "\n\n\u2026";
}

/** Process items in parallel batches with concurrency limit. */
async function batchProcess<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
  label = "batchProcess",
): Promise<R[]> {
  const results: R[] = [];
  let failures = 0;
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(fn));
    for (const r of settled) {
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        failures++;
        console.warn(`[queue-consumer] ${label} item failed:`, r.reason);
      }
    }
  }
  if (failures > 0) {
    console.warn(`[queue-consumer] ${label}: ${failures}/${items.length} items failed`);
  }
  return results;
}

/**
 * Remove legacy per-page KV star keys from before the R2 migration.
 * Runs once per user — checks for the meta key and deletes all pages + meta.
 */
async function cleanupLegacyStarKeys(
  username: string,
  kv?: KVNamespace,
): Promise<void> {
  if (!kv) return;
  try {
    const metaKey = `github:stars:${username}:meta`;
    const meta = await kv.get(metaKey, "json");
    if (!meta) return; // Already cleaned up or never existed

    // Delete page keys + meta key
    const totalPages = (meta as { totalPages?: number }).totalPages ?? 0;
    const keysToDelete = [metaKey];
    for (let p = 1; p <= totalPages; p++) {
      keysToDelete.push(`github:stars:${username}:${p}`);
    }
    await Promise.allSettled(keysToDelete.map((k) => kv.delete(k)));
    console.log(`[queue-consumer] Cleaned up ${keysToDelete.length} legacy KV star keys for ${username}`);
  } catch (err) {
    console.warn(`[queue-consumer] Legacy KV cleanup failed for ${username}:`, err);
  }
}

/** Simple FNV-1a-inspired hash for change detection (not cryptographic). */
function simpleHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
