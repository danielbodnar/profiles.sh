/**
 * CRUD operations for all 6 D1 tables using prepared statements.
 *
 * Every query uses `.bind()` for safety — no string interpolation of user input.
 * JSON columns are serialized/deserialized at this layer so callers work with
 * native JS objects.
 */

import type {
  ProfileRow,
  PersonaRow,
  ProjectRow,
  RadarAxisRow,
  StarInterestRow,
  AggregateRow,
  CustomizationRow,
  FullProfile,
} from "./types";

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------

export async function getProfile(
  db: D1Database,
  username: string,
): Promise<ProfileRow | null> {
  return db
    .prepare("SELECT * FROM profiles WHERE username = ?")
    .bind(username)
    .first<ProfileRow>();
}

export async function upsertProfile(
  db: D1Database,
  profile: ProfileRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO profiles (
        username, display_name, bio, location, email, blog, company,
        avatar_url, followers, following, public_repos, created_at,
        computed_at, github_data_hash, raw_profile
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        display_name = excluded.display_name,
        bio = excluded.bio,
        location = excluded.location,
        email = excluded.email,
        blog = excluded.blog,
        company = excluded.company,
        avatar_url = excluded.avatar_url,
        followers = excluded.followers,
        following = excluded.following,
        public_repos = excluded.public_repos,
        created_at = excluded.created_at,
        computed_at = excluded.computed_at,
        github_data_hash = excluded.github_data_hash,
        raw_profile = excluded.raw_profile`,
    )
    .bind(
      profile.username,
      profile.display_name,
      profile.bio,
      profile.location,
      profile.email,
      profile.blog,
      profile.company,
      profile.avatar_url,
      profile.followers,
      profile.following,
      profile.public_repos,
      profile.created_at,
      profile.computed_at,
      profile.github_data_hash,
      profile.raw_profile,
    )
    .run();
}

// ---------------------------------------------------------------------------
// personas
// ---------------------------------------------------------------------------

export async function getPersonas(
  db: D1Database,
  username: string,
): Promise<PersonaRow[]> {
  const result = await db
    .prepare("SELECT * FROM personas WHERE username = ? ORDER BY sort_order ASC")
    .bind(username)
    .all<PersonaRow>();
  return result.results;
}

export async function upsertPersonas(
  db: D1Database,
  username: string,
  personas: Omit<PersonaRow, "id">[],
): Promise<void> {
  // Delete existing personas for this user, then insert fresh
  await db
    .prepare("DELETE FROM personas WHERE username = ?")
    .bind(username)
    .run();

  for (const p of personas) {
    await db
      .prepare(
        `INSERT INTO personas (
          username, persona_id, title, tagline, accent_color, icon,
          experience_label, years_active, confidence, stats, stack,
          details, starred_repos, employers, links, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        username,
        p.persona_id,
        p.title,
        p.tagline,
        p.accent_color,
        p.icon,
        p.experience_label,
        p.years_active,
        p.confidence,
        p.stats,
        p.stack,
        p.details,
        p.starred_repos,
        p.employers,
        p.links,
        p.sort_order,
      )
      .run();
  }
}

// ---------------------------------------------------------------------------
// projects
// ---------------------------------------------------------------------------

export async function getProjects(
  db: D1Database,
  username: string,
): Promise<ProjectRow[]> {
  const result = await db
    .prepare("SELECT * FROM projects WHERE username = ? ORDER BY sort_order ASC")
    .bind(username)
    .all<ProjectRow>();
  return result.results;
}

export async function upsertProjects(
  db: D1Database,
  username: string,
  projects: Omit<ProjectRow, "id">[],
): Promise<void> {
  await db
    .prepare("DELETE FROM projects WHERE username = ?")
    .bind(username)
    .run();

  for (const p of projects) {
    await db
      .prepare(
        `INSERT INTO projects (
          username, name, description, url, tech, persona_map,
          language, stars, forks, sort_order, readme_excerpt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        username,
        p.name,
        p.description,
        p.url,
        p.tech,
        p.persona_map,
        p.language,
        p.stars,
        p.forks,
        p.sort_order,
        p.readme_excerpt ?? null,
      )
      .run();
  }
}

// ---------------------------------------------------------------------------
// radar_axes
// ---------------------------------------------------------------------------

export async function getRadarAxes(
  db: D1Database,
  username: string,
): Promise<RadarAxisRow[]> {
  const result = await db
    .prepare("SELECT * FROM radar_axes WHERE username = ? ORDER BY sort_order ASC")
    .bind(username)
    .all<RadarAxisRow>();
  return result.results;
}

export async function upsertRadarAxes(
  db: D1Database,
  username: string,
  axes: Omit<RadarAxisRow, "id">[],
): Promise<void> {
  await db
    .prepare("DELETE FROM radar_axes WHERE username = ?")
    .bind(username)
    .run();

  for (const a of axes) {
    await db
      .prepare(
        `INSERT INTO radar_axes (username, label, value, color, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(username, a.label, a.value, a.color, a.sort_order)
      .run();
  }
}

// ---------------------------------------------------------------------------
// star_interests
// ---------------------------------------------------------------------------

export async function getStarInterests(
  db: D1Database,
  username: string,
): Promise<StarInterestRow[]> {
  const result = await db
    .prepare(
      "SELECT * FROM star_interests WHERE username = ? ORDER BY sort_order ASC",
    )
    .bind(username)
    .all<StarInterestRow>();
  return result.results;
}

export async function upsertStarInterests(
  db: D1Database,
  username: string,
  interests: Omit<StarInterestRow, "id">[],
): Promise<void> {
  await db
    .prepare("DELETE FROM star_interests WHERE username = ?")
    .bind(username)
    .run();

  for (const i of interests) {
    await db
      .prepare(
        `INSERT INTO star_interests (username, label, count, examples, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(username, i.label, i.count, i.examples, i.sort_order)
      .run();
  }
}

// ---------------------------------------------------------------------------
// user_aggregates
// ---------------------------------------------------------------------------

export async function getAggregates(
  db: D1Database,
  username: string,
): Promise<AggregateRow[]> {
  const result = await db
    .prepare(
      "SELECT * FROM user_aggregates WHERE username = ? ORDER BY agg_type ASC, sort_order ASC",
    )
    .bind(username)
    .all<AggregateRow>();
  return result.results;
}

export async function upsertAggregates(
  db: D1Database,
  username: string,
  aggregates: Omit<AggregateRow, "username">[],
): Promise<void> {
  await db
    .prepare("DELETE FROM user_aggregates WHERE username = ?")
    .bind(username)
    .run();

  for (const a of aggregates) {
    await db
      .prepare(
        `INSERT INTO user_aggregates (username, agg_type, item, count, from_owned, from_starred, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(username, a.agg_type, a.item, a.count, a.from_owned, a.from_starred, a.sort_order)
      .run();
  }
}

// ---------------------------------------------------------------------------
// customizations
// ---------------------------------------------------------------------------

export async function getCustomizations(
  db: D1Database,
  username: string,
): Promise<CustomizationRow | null> {
  return db
    .prepare("SELECT * FROM customizations WHERE username = ?")
    .bind(username)
    .first<CustomizationRow>();
}

export async function upsertCustomizations(
  db: D1Database,
  username: string,
  customs: CustomizationRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO customizations (
        username, custom_taglines, custom_details, custom_employers,
        hidden_personas, theme_overrides, featured_repos, featured_topics
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        custom_taglines = excluded.custom_taglines,
        custom_details = excluded.custom_details,
        custom_employers = excluded.custom_employers,
        hidden_personas = excluded.hidden_personas,
        theme_overrides = excluded.theme_overrides,
        featured_repos = excluded.featured_repos,
        featured_topics = excluded.featured_topics`,
    )
    .bind(
      username,
      customs.custom_taglines,
      customs.custom_details,
      customs.custom_employers,
      customs.hidden_personas,
      customs.theme_overrides,
      customs.featured_repos ?? null,
      customs.featured_topics ?? null,
    )
    .run();
}

// ---------------------------------------------------------------------------
// getFullProfile — joins all tables for complete profile data
// ---------------------------------------------------------------------------

export async function getFullProfile(
  db: D1Database,
  username: string,
): Promise<FullProfile | null> {
  const profile = await getProfile(db, username);
  if (!profile) return null;

  const [personas, projects, radarAxes, starInterests, aggregates, customizations] =
    await Promise.all([
      getPersonas(db, username),
      getProjects(db, username),
      getRadarAxes(db, username),
      getStarInterests(db, username),
      getAggregates(db, username),
      getCustomizations(db, username),
    ]);

  return {
    profile,
    personas,
    projects,
    radarAxes,
    starInterests,
    aggregates,
    customizations,
  };
}
