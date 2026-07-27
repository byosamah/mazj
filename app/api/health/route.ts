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
  respond(await checkHealth(), (value) => ({ body: value }))
);
