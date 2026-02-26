import type { APIRoute } from "astro";
import { setupPersonaCardsRepo, removePersonaCardsRepo } from "../../../lib/github-app/setup";

/**
 * POST /api/github-app/webhook
 *
 * Handles GitHub App webhook events:
 *  - `installation` → created: sets up the persona-cards repo
 *  - `installation` → deleted: optionally removes the repo
 */
export const POST: APIRoute = async ({ request }) => {
  const event = request.headers.get("x-github-event");
  if (event !== "installation") {
    return new Response(JSON.stringify({ ignored: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: InstallationPayload;
  try {
    payload = await request.json() as InstallationPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const action = payload.action;
  const username = payload.sender?.login;
  const token = payload.installation?.access_tokens_url
    ? undefined // In production, exchange for an installation token
    : undefined;

  if (!username) {
    return new Response(JSON.stringify({ error: "Missing sender" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ---- Installation created ----
  if (action === "created" && token) {
    try {
      const result = await setupPersonaCardsRepo(token, username);
      return new Response(JSON.stringify(result), {
        status: result.created ? 201 : 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ---- Installation deleted ----
  if (action === "deleted" && token) {
    await removePersonaCardsRepo(token, username);
    return new Response(JSON.stringify({ removed: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InstallationPayload {
  action: "created" | "deleted" | "suspend" | "unsuspend";
  installation: {
    id: number;
    access_tokens_url: string;
    account: { login: string };
  };
  sender: { login: string };
}
