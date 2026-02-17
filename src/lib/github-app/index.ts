/**
 * GitHub App module for self-hosted profiles.sh persona cards.
 *
 * Provides:
 *  - App manifest for registration
 *  - Repo setup / teardown helpers
 *  - JSON schema for the cached profile format
 *  - Workflow and generator script templates
 */

export { buildAppManifest } from "./manifest";
export type { GitHubAppManifest } from "./manifest";

export { setupPersonaCardsRepo, removePersonaCardsRepo } from "./setup";
export type { RepoSetupResult } from "./setup";

export { SELF_HOSTED_PROFILE_SCHEMA } from "./schema";
export type { SelfHostedProfile } from "./schema";

export { generateWorkflowYaml } from "./templates/workflow";
export { generateScriptContent } from "./templates/generate-script";
export { generateReadme } from "./templates/readme";
