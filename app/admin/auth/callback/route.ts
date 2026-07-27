import { NextResponse, type NextRequest } from "next/server";

import { verifyMagicLink } from "../../_lib/session";

/**
 * Where the magic link lands.
 *
 * A route handler rather than a page because verification WRITES cookies, and a
 * Server Component cannot: this is the request that actually persists the
 * session every other admin page then reads.
 *
 * 🔴 This route does not decide who is allowed in. It only turns a one-time
 * credential into a session. The domain check runs in
 * `(protected)/layout.tsx` on every subsequent request, so a session belonging
 * to an address that should not have one is still refused at the door.
 * Authorising here instead would mean the check ran once, at sign-in, and never
 * again for the life of the session.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;

  const result = await verifyMagicLink({
    tokenHash: params.get("token_hash"),
    type: params.get("type"),
    code: params.get("code"),
  });

  // 🔴 Supabase also reports its own failures here, as `error` and
  // `error_description`. Neither is ever forwarded into the redirect. Those are
  // attacker-influenceable strings, and reflecting one into a page renders
  // chosen text inside MAZJ's own chrome on MAZJ's own domain, which is exactly
  // the shape of a convincing phishing message. The login page carries its own
  // fixed sentence instead, and the real reason is already in the server log.
  return NextResponse.redirect(
    new URL(result.ok ? "/admin" : "/admin/login?error=1", request.url)
  );
}
