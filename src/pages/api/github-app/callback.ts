import type { APIRoute } from "astro";

/**
 * GET /api/github-app/callback
 *
 * OAuth-style redirect endpoint used during GitHub App manifest registration.
 * GitHub redirects here after the user creates the app from the manifest flow,
 * providing a `code` query parameter that can be exchanged for the app's
 * credentials.
 *
 * See: https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest#implementing-the-manifest-flow
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response(JSON.stringify({ error: "Missing code parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Exchange the code for the app configuration.
  // In production, POST to https://api.github.com/app-manifests/{code}/conversions
  // and persist the returned credentials (app_id, pem, webhook_secret, etc.)
  // For now, return a success message directing the user to complete setup.

  return new Response(
    JSON.stringify({
      message: "GitHub App registered successfully. Complete setup in your GitHub settings.",
      code,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};
