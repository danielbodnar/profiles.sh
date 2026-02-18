/**
 * Repository setup helpers for the GitHub App.
 *
 * These functions use the GitHub REST API (authenticated as the app
 * installation) to create the `persona-cards` repo and push the
 * initial workflow, generator script, and README.
 */

import { generateWorkflowYaml } from "./templates/workflow";
import { generateScriptContent } from "./templates/generate-script";
import { generateReadme } from "./templates/readme";

const GITHUB_API = "https://api.github.com";
const REPO_NAME = "persona-cards";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepoSetupResult {
  /** Whether the repo was newly created (`true`) or already existed. */
  created: boolean;
  /** Full HTML URL of the repo. */
  html_url: string;
}

interface GitHubTreeEntry {
  path: string;
  mode: "100644";
  type: "blob";
  content: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create the `persona-cards` repository in the user's account and push the
 * initial set of files (workflow, generator script, README).
 *
 * If the repository already exists, this is a no-op and returns the existing
 * URL.
 *
 * @param token       Installation access token with `contents:write` scope
 * @param username    GitHub login of the installing user
 */
export async function setupPersonaCardsRepo(
  token: string,
  username: string,
): Promise<RepoSetupResult> {
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ProfilesSh-App/1.0",
  };

  // 1. Check if the repo already exists
  const existingRes = await fetch(
    `${GITHUB_API}/repos/${username}/${REPO_NAME}`,
    { headers },
  );

  if (existingRes.ok) {
    const existing = await existingRes.json() as { html_url: string };
    return { created: false, html_url: existing.html_url };
  }

  // 2. Create the repository
  const createRes = await fetch(`${GITHUB_API}/user/repos`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: REPO_NAME,
      description: `Self-hosted profiles.sh persona cards for @${username}`,
      homepage: `https://${username}.github.io/${REPO_NAME}`,
      has_issues: false,
      has_projects: false,
      has_wiki: false,
      auto_init: true, // Creates an initial commit so we have a branch to push to
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create repo: ${createRes.status} ${err}`);
  }

  const repo = await createRes.json() as { html_url: string; default_branch: string };

  // 3. Push initial files via the Git Trees API (single commit)
  await pushInitialFiles(headers, username, repo.default_branch);

  return { created: true, html_url: repo.html_url };
}

/**
 * Remove the persona-cards repo (opt-in on uninstall).
 */
export async function removePersonaCardsRepo(
  token: string,
  username: string,
): Promise<boolean> {
  const res = await fetch(
    `${GITHUB_API}/repos/${username}/${REPO_NAME}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "ProfilesSh-App/1.0",
      },
    },
  );

  return res.ok || res.status === 404;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Push workflow + generator script + README in a single commit using the
 * Git Data API (create tree → create commit → update ref).
 */
async function pushInitialFiles(
  headers: Record<string, string>,
  username: string,
  defaultBranch: string,
): Promise<void> {
  const repoFullName = `${username}/${REPO_NAME}`;

  // Get the latest commit SHA on the default branch
  const refRes = await fetch(
    `${GITHUB_API}/repos/${repoFullName}/git/ref/heads/${defaultBranch}`,
    { headers },
  );

  if (!refRes.ok) return; // auto_init may not have finished yet
  const refData = await refRes.json() as { object: { sha: string } };
  const baseSha = refData.object.sha;

  // Build the tree entries
  const files: GitHubTreeEntry[] = [
    {
      path: ".github/workflows/generate-profile.yml",
      mode: "100644",
      type: "blob",
      content: generateWorkflowYaml(username),
    },
    {
      path: "generate.mjs",
      mode: "100644",
      type: "blob",
      content: generateScriptContent(username),
    },
    {
      path: "README.md",
      mode: "100644",
      type: "blob",
      content: generateReadme(username),
    },
  ];

  // Create tree
  const treeRes = await fetch(
    `${GITHUB_API}/repos/${repoFullName}/git/trees`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ base_tree: baseSha, tree: files }),
    },
  );

  if (!treeRes.ok) return;
  const tree = await treeRes.json() as { sha: string };

  // Create commit
  const commitRes = await fetch(
    `${GITHUB_API}/repos/${repoFullName}/git/commits`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "chore: initial profiles.sh persona-cards setup",
        tree: tree.sha,
        parents: [baseSha],
      }),
    },
  );

  if (!commitRes.ok) return;
  const commit = await commitRes.json() as { sha: string };

  // Update the branch ref
  await fetch(
    `${GITHUB_API}/repos/${repoFullName}/git/refs/heads/${defaultBranch}`,
    {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha }),
    },
  );
}
