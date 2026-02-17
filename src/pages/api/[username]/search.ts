import type { APIRoute } from "astro";
import { searchRepos } from "../../../lib/vectorize/search";

const MAX_QUERY_LENGTH = 500;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://profiles.sh",
  "Access-Control-Allow-Methods": "GET",
  "Cache-Control": "public, max-age=60",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/**
 * GET /api/:username/search?q=kubernetes+deployment
 *
 * Semantic search over a user's starred/owned repos via Vectorize.
 * Returns ranked results with similarity scores.
 */
export const GET: APIRoute = async ({ params, url, locals }) => {
  const username = params.username?.toLowerCase();
  if (!username) {
    return jsonResponse({ error: "Username required" }, 400);
  }

  const query = url.searchParams.get("q")?.trim();
  if (!query) {
    return jsonResponse({ error: "Query parameter 'q' is required" }, 400);
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return jsonResponse({ error: `Query too long (max ${MAX_QUERY_LENGTH} chars)` }, 400);
  }

  const topK = Math.min(Number(url.searchParams.get("limit")) || 20, 50);

  const env = (locals as any).runtime.env as Env;

  if (!env.AI || !env.VECTORIZE) {
    return jsonResponse(
      { error: "Semantic search not configured (AI/Vectorize bindings missing)" },
      503,
    );
  }

  try {
    const results = await searchRepos(env.AI, env.VECTORIZE, query, username, topK);
    return jsonResponse({ query, username, results, count: results.length });
  } catch (err) {
    console.error(`[api/search] Search failed for ${username}:`, err);
    return jsonResponse({ error: "Search failed" }, 500);
  }
};
