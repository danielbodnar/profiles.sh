/// <reference path="../.astro/types.d.ts" />
/// <reference types="./worker-configuration.d.ts" />

// Secrets not in wrangler.jsonc vars — extend the generated Env
declare namespace Cloudflare {
  interface Env {
    GITHUB_TOKEN: string;
  }
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
