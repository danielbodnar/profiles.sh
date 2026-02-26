import type { APIRoute } from "astro";
import { buildAppManifest } from "../../../lib/github-app/manifest";

/**
 * GET /api/github-app/manifest
 *
 * Returns the GitHub App manifest JSON that can be used with the
 * manifest flow to register a new app instance.
 *
 * See: https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const manifest = buildAppManifest(baseUrl);

  return new Response(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
