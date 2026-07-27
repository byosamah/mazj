"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { clientIp } from "@/server/core/request";
import { requestAdminMagicLink } from "@/server/services/admin-auth";

import { DASHBOARD_CACHE_TAG } from "./dashboard";
import { adminSupabase } from "./supabase";

/**
 * The admin's write endpoints, as Server Actions.
 *
 * These are Server Actions rather than route handlers under `app/api/**` for
 * one concrete reason: `@supabase/ssr` uses the PKCE flow, so requesting a
 * magic link writes a code-verifier cookie that the callback later needs to
 * complete the exchange. Both halves therefore need a cookie store they can
 * WRITE to, which a Server Component cannot provide but an action can.
 *
 * They are still public POST endpoints, with all that implies. The rate limit
 * lives in the service, not here, so it cannot be skipped by a second caller.
 */

export type LoginState = { message: string | null; sent: boolean };

/**
 * Requests a magic link.
 *
 * 🔴 Reports the SAME outcome for an address that is allowed and one that is
 * not. The service explains why at length; the short version is that any
 * difference here is a way to enumerate who works at MAZJ.
 */
export async function requestLoginLink(
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  const requestHeaders = await headers();
  const supabase = await adminSupabase();

  // Built from the incoming request rather than from a configured site URL, so
  // a link requested on localhost returns to localhost and one requested on the
  // production domain returns there. A hardcoded origin here is how the magic
  // link ends up sending a developer to production.
  const origin = requestOrigin(requestHeaders);

  const result = await requestAdminMagicLink(supabase, {
    email: formData.get("email"),
    ip: clientIp(requestHeaders),
    redirectTo: `${origin}/admin/auth/callback`,
  });

  if (!result.ok) {
    return {
      sent: false,
      message:
        result.error.code === "rate_limited"
          ? "Too many attempts. Please wait a while before trying again."
          : "Something went wrong. Please try again.",
    };
  }

  return {
    sent: true,
    message: null,
  };
}

/** Ends the session and returns to the login page. */
export async function signOut(): Promise<void> {
  const supabase = await adminSupabase();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

/**
 * Forces a fresh pull from Rekaz.
 *
 * 🔴 Must invalidate the tag, not merely redirect. The dashboard's data is
 * cached for 60 seconds, so a bare redirect would re-render the identical
 * cached figures and the button would appear broken in the one situation
 * somebody presses it: when they believe what they are looking at is stale.
 */
export async function refreshDashboard(): Promise<void> {
  // `updateTag`, not `revalidateTag`. Next 16 draws the distinction precisely:
  // revalidateTag purges for FUTURE requests, while updateTag gives
  // read-your-own-writes within this action, so the redirect below lands on
  // genuinely refetched data instead of the cached copy the user just rejected.
  updateTag(DASHBOARD_CACHE_TAG);
  redirect("/admin");
}

/**
 * The origin this request arrived on.
 *
 * ⚠️ `host` is client-controlled and must never be used for a security
 * decision. It is safe HERE only because Supabase independently validates the
 * redirect against its own allow-list: a forged host produces a link Supabase
 * refuses to issue, not a link that sends a visitor somewhere hostile. Keep
 * that allow-list tight, and never reuse this value for anything else.
 */
function requestOrigin(requestHeaders: Headers): string {
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
