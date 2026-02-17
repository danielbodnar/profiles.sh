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

import { fetchProfile, fetchRepos, fetchAllStars, filterActiveRepos } from "./github/client";
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
  // 1. Fetch GitHub data (cached in KV)
  const [githubProfile, rawRepos, rawStars] = await Promise.all([
    fetchProfile(username, env, config),
    fetchRepos(username, env, config),
    fetchAllStars(username, env, config),
  ]);

  // 2. Filter out archived + inactive repos
  const inactiveYears = config?.inactiveYears ?? 3;
  const repos = filterActiveRepos(rawRepos, inactiveYears);
  const stars = filterActiveRepos(rawStars, inactiveYears);

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
