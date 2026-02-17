import { defineMiddleware } from "astro:middleware";

// Reserved subdomains that should NOT be rewritten to user profile routes.
// These fall through to next() and are handled by normal Astro routing,
// allowing future API/CDN subdomains without conflicting with user profiles.
const RESERVED = new Set(["www", "api", "cdn", "static"]);
const PRODUCTION_DOMAIN = "profiles.sh";

// GitHub usernames: alphanumeric + hyphens, max 39 chars, no leading/trailing hyphens
const GITHUB_USERNAME_RE = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/;

export const onRequest = defineMiddleware(async (ctx, next) => {
  const url = new URL(ctx.request.url);

  // Only apply subdomain routing on the production domain (e.g. danielbodnar.profiles.sh)
  // Skip on *.workers.dev, localhost, and other non-production hosts
  if (!url.hostname.endsWith(PRODUCTION_DOMAIN)) {
    return next();
  }

  const parts = url.hostname.split(".");

  // Detect subdomain: e.g. "danielbodnar.profiles.sh" -> sub = "danielbodnar"
  // Reserved subdomains (www, api, cdn, static) pass through to standard routing
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase();
    if (!RESERVED.has(sub) && GITHUB_USERNAME_RE.test(sub)) {
      ctx.locals.subdomainUsername = sub;

      // Rewrite root to /{username}
      if (url.pathname === "/" || url.pathname === "") {
        return ctx.rewrite(`/${sub}`);
      }

      // Rewrite other paths to /{username}/...
      if (!url.pathname.startsWith(`/${sub}`)) {
        return ctx.rewrite(`/${sub}${url.pathname}`);
      }
    }
  }

  return next();
});
