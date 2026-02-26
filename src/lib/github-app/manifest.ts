/**
 * GitHub App manifest for the profiles.sh self-hosted app.
 *
 * Used in the manifest flow (https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)
 * to let users register their own instance of the app.
 *
 * The manifest is also useful as reference documentation for the permissions
 * and events the app requires.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubAppManifest {
  name: string;
  url: string;
  hook_attributes: { url: string; active: boolean };
  redirect_url: string;
  description: string;
  public: boolean;
  default_events: string[];
  default_permissions: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Manifest builder
// ---------------------------------------------------------------------------

/**
 * Build the GitHub App manifest for a given base URL.
 *
 * @param baseUrl  The canonical URL of the profiles.sh instance
 *                 (e.g. `https://profiles.sh`).
 */
export function buildAppManifest(baseUrl: string): GitHubAppManifest {
  const url = baseUrl.replace(/\/+$/, "");

  return {
    name: "profiles-sh",
    url: `${url}`,
    hook_attributes: {
      url: `${url}/api/github-app/webhook`,
      active: true,
    },
    redirect_url: `${url}/api/github-app/callback`,
    description:
      "Self-host your profiles.sh persona cards via a persona-cards repo in your account.",
    public: true,
    default_events: ["installation"],
    default_permissions: {
      // Create the persona-cards repo and push workflow + pages content
      contents: "write",
      // Read-only access to the user's public metadata
      metadata: "read",
      // Enable GitHub Actions workflows in the created repo
      actions: "write",
      // Enable GitHub Pages deployment
      pages: "write",
    },
  };
}
