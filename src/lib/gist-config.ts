/**
 * Gist-based personalization: applies overrides from a user's
 * `profiles-sh.json` gist to computed profile data.
 *
 * Overrides:
 *   - featured_repos:      pin repos to top of projects section
 *   - featured_topics:     boost topic scores in domain scoring
 *   - hidden_categories:   remove personas from display
 *   - tagline_overrides:   replace persona taglines
 *   - theme:               theme preference (stored in customizations)
 */

import type { GistConfig } from "./github/types";
import type { CustomizationRow } from "./db/types";

/**
 * Apply gist config overrides to persona rows (in-place mutation for efficiency).
 *
 * - Removes personas in `hidden_categories`
 * - Replaces taglines from `tagline_overrides`
 *
 * Returns the filtered persona list.
 */
export function applyPersonaOverrides<
  T extends { persona_id: string; tagline: string | null },
>(personas: T[], config: GistConfig): T[] {
  const hidden = new Set(
    (config.hidden_categories ?? []).map((c) => c.toLowerCase()),
  );

  let filtered = personas;
  if (hidden.size > 0) {
    filtered = personas.filter((p) => !hidden.has(p.persona_id.toLowerCase()));
  }

  const taglines = config.tagline_overrides;
  if (taglines) {
    for (const p of filtered) {
      const override = taglines[p.persona_id];
      if (override != null) {
        p.tagline = override;
      }
    }
  }

  return filtered;
}

/**
 * Apply gist config overrides to project rows.
 *
 * - Sorts `featured_repos` to the top of the list (preserves original order otherwise).
 *
 * Returns a new sorted array.
 */
export function applyProjectOverrides<T extends { name: string }>(
  projects: T[],
  config: GistConfig,
): T[] {
  const featured = config.featured_repos;
  if (!featured || featured.length === 0) return projects;

  const featuredSet = new Set(featured.map((r) => r.toLowerCase()));
  const pinned = projects.filter((p) => featuredSet.has(p.name.toLowerCase()));
  const rest = projects.filter((p) => !featuredSet.has(p.name.toLowerCase()));
  return [...pinned, ...rest];
}

/**
 * Build a CustomizationRow from gist config for D1 persistence.
 */
export function gistConfigToCustomizationRow(
  username: string,
  config: GistConfig,
): CustomizationRow {
  return {
    username,
    custom_taglines: config.tagline_overrides
      ? JSON.stringify(config.tagline_overrides)
      : null,
    custom_details: null,
    custom_employers: null,
    hidden_personas: config.hidden_categories
      ? JSON.stringify(config.hidden_categories)
      : null,
    theme_overrides: config.theme
      ? JSON.stringify({ theme: config.theme })
      : null,
    featured_repos: config.featured_repos
      ? JSON.stringify(config.featured_repos)
      : null,
    featured_topics: config.featured_topics
      ? JSON.stringify(config.featured_topics)
      : null,
  };
}
