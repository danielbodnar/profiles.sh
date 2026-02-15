/// <reference path="../.astro/types.d.ts" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

interface Env {
  KV: KVNamespace;
  DB: D1Database;
  R2: R2Bucket;
  PROFILE_QUEUE: Queue;
  RATE_LIMITER: DurableObjectNamespace;
  GITHUB_TOKEN: string;
  ENVIRONMENT: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}
