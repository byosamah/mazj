import { respond, route } from "@/server/core/http";
import { checkHealth } from "@/server/services/health";

/**
 * `GET /api/health` — is the backend actually wired up?
 *
 * The route handler is deliberately this short. Everything it knows how to do
 * is call one service and hand the result to one mapper; all reasoning lives in
 * `server/`, which is what keeps that folder liftable.
 */

// Node runtime: `server/core/hash.ts` uses `node:crypto`, which the edge runtime
// only partially implements.
export const runtime = "nodejs";
// Never prerendered or cached. A cached health check reports the health of a
// moment that has passed.
export const dynamic = "force-dynamic";

export const GET = route(async () =>
  respond(await checkHealth(), (value) => ({
    body: value,
    // 🔴 The one API route this app exposes, and it was fully indexable.
    // robots.txt carries exactly two `Disallow` lines and both are `/admin`,
    // so nothing kept a crawler off this URL; measured across 30 captured
    // production responses, only `/llms.txt` and `/pricing.md` shipped any
    // `x-robots-tag` at all. Nothing links here, so discovery risk was low,
    // but a JSON body naming the database's reachability and its latency is
    // not a search result MAZJ wants, and an uptime monitor or a referrer
    // header is all it takes to get the URL discovered.
    //
    // A header rather than a robots.txt `Disallow`, for the reason
    // `app/robots.ts` already gives about /privacy and /terms: a disallowed
    // URL is never fetched, so the directive is never read. Same pattern as
    // `app/pricing.md/route.ts`.
    headers: { "X-Robots-Tag": "noindex" },
  }))
);
