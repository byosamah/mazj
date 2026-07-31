import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isAllowedAdminEmail } from "@/server/domain/admin-access";

import { adminSupabase } from "./supabase";

/**
 * Gate 3 of 3: the check that runs on every admin request.
 *
 * Gate 1 refuses to email a link to an outsider. Gate 2 refuses to create an
 * account for one. This gate assumes both of those have already failed, because
 * a gate that trusts the gates in front of it is decoration.
 *
 * See `server/domain/admin-access.ts` for the domain rule itself, and the spec
 * at `docs/superpowers/specs/2026-07-27-admin-dashboard-design.md` for why there
 * are three.
 */

export type AdminUser = {
  id: string;
  email: string;
};

/**
 * Why nobody is signed in, when nobody is signed in.
 *
 * 🔴 THESE FOUR ARE NOT INTERCHANGEABLE, and collapsing them into one `null` is
 * the defect this type exists to remove.
 *
 * Until 2026-07-29 `getAdminUser()` answered `null` for every one of them, so a
 * Supabase Auth outage was rendered with the same pixels as having no cookie:
 * the visitor was sent to the login form, typed the address they have typed a
 * hundred times, and was told a link was on its way. Nothing had been sent, and
 * nothing could be. Two consecutive lies to a colleague trying to get in, and
 * neither one recoverable by the person reading them.
 *
 * The four states drive four different sentences on the login screen, because
 * they need four different actions from the reader: wait, sign in again, ask
 * somebody, or nothing at all.
 */
export type AdminSessionProblem =
  /** No credential was presented. A first visit, or a properly signed-out one. */
  | "anonymous"
  /** A credential was presented and no longer works. Signing in again fixes it. */
  | "expired"
  /** A verified session whose address the domain rule now refuses. */
  | "revoked"
  /** We could not find out. Supabase Auth gave us no verdict either way. */
  | "unavailable";

/** Either the signed-in admin, or the reason there isn't one. */
export type AdminSession = AdminUser | AdminSessionProblem;

/**
 * Narrows a session to the admin, if there is one.
 *
 * 🔴 Use this rather than a truthy test. Every `AdminSessionProblem` is a
 * non-empty string, so `if (await getAdminUser())` is true for all four of them.
 * On the login page that reads as "already signed in" and bounces an anonymous
 * visitor to `/admin`, which bounces them back here, forever.
 */
export function isSignedInAdmin(session: AdminSession): session is AdminUser {
  return typeof session !== "string";
}

/**
 * Where each problem sends the visitor.
 *
 * The login screen renders one sentence per query shape. `?state=` is a fixed
 * literal chosen here, never anything Supabase said: an upstream message on a
 * page reached by an unauthenticated visitor is a defect, not a diagnostic.
 */
const LOGIN_DESTINATION: Record<AdminSessionProblem, string> = {
  anonymous: "/admin/login",
  expired: "/admin/login?state=expired",
  revoked: "/admin/login?state=revoked",
  unavailable: "/admin/login?state=outage",
};

/**
 * The signed-in admin, or the reason there is not one.
 *
 * 🔴 Uses `getUser()`, never `getSession()`.
 *
 * `getSession()` reads the auth cookie and decodes it. It does not verify it.
 * The cookie is in the visitor's hands, so on a page whose entire job is
 * deciding whether to let someone in, "decode what they gave me and believe it"
 * is not authorisation. `getUser()` sends the token to the Supabase auth server
 * and gets back a verified identity, at the cost of one network call, which is
 * exactly the right trade on an internal dashboard.
 *
 * The email domain is re-checked here rather than trusted from the token.
 * Supabase lets an address be changed on an existing account, so an account
 * created legitimately on `@mazj.org` and later moved to another address must
 * stop working, and only a check at request time notices that.
 *
 * 🔴 A REFUSED DOMAIN IS `"revoked"`, AND THAT LEAKS NOTHING.
 *
 * The login form deliberately does not check the domain in the browser, so that
 * an outsider cannot learn from it which domain MAZJ admins use. This branch
 * does not weaken that: it is reachable only by presenting a session token that
 * Supabase itself has just verified, i.e. by someone who already holds a real
 * account. An arbitrary address typed into the login form never reaches this
 * function at all; it goes to `requestLoginLink`, which reports the identical
 * hedged outcome for every address on earth.
 *
 * The session is deliberately NOT cleared here. Clearing it would need a cookie
 * write, which Next forbids from a Server Component render anyway, and the
 * domain re-check above is what actually enforces the refusal: it runs again on
 * every single request, whatever the browser is still holding.
 */
export async function getAdminUser(): Promise<AdminSession> {
  const supabase = await adminSupabase();

  let response: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    response = await supabase.auth.getUser();
  } catch {
    // `getUser()` resolves its own auth failures into `error` rather than
    // throwing, so reaching here means something underneath it threw: a lock
    // timeout, a storage adapter refusing, a fetch that never became a
    // response. We have no verdict about this visitor either way.
    return "unavailable";
  }

  const { data, error } = response;

  if (error) {
    if (isAuthOutage(error)) return "unavailable";
    return (await hasSessionCookie()) ? "expired" : "anonymous";
  }

  // No error and no user is not a state the client documents. Reporting it as
  // "signed out" would be inventing an answer, which is the exact collapse this
  // function stopped doing.
  if (!data.user) return "unavailable";

  // Two ways in here, and both mean the same thing to the person holding the
  // session: the address on this account is not one the admin accepts. An
  // account with no address at all cannot be a MAZJ admin either, since gate 2
  // only ever mints one from an emailed sign-in.
  const email = data.user.email;
  if (typeof email !== "string" || !isAllowedAdminEmail(email)) return "revoked";

  return { id: data.user.id, email };
}

/**
 * The signed-in admin, or a redirect to the login page.
 *
 * 🔴 Called by the admin layout AND by every page, route handler and action
 * underneath it. The layout is not the security boundary: React renders a
 * route's components concurrently, so a layout's `redirect()` does not stop the
 * page it wraps, and a crafted `Next-Router-State-Tree` can skip the layout
 * entirely. See `app/CLAUDE.md`.
 *
 * `redirect()` throws, so it stays outside the try/catch in `getAdminUser()`.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const session = await getAdminUser();
  if (isSignedInAdmin(session)) return session;

  redirect(LOGIN_DESTINATION[session]);
}

/**
 * Did Supabase Auth fail, as opposed to answer?
 *
 * `@supabase/auth-js` reports a fetch that never completed as status `0`, an
 * auth service that failed on its own account as 5xx (it counts Cloudflare's
 * 52x in that band too), and a response body it could not read with no status
 * at all. None of those three tells us anything about this visitor, so none of
 * them may be rendered as "you are not signed in".
 *
 * Everything else (400 session missing, 401, 403, an invalid refresh token) IS
 * an answer about this visitor: the credential they hold does not work.
 *
 * Read off `status` rather than the error's class name, because the class names
 * are internal to a package that has renamed them before and the status band is
 * the part that carries the meaning.
 */
function isAuthOutage(error: { status?: number }): boolean {
  if (typeof error.status !== "number") return true;
  return error.status === 0 || error.status >= 500;
}

/**
 * Is the browser holding a session cookie at all?
 *
 * The only thing separating "your session ended" from "you have never signed
 * in", and both sentences are worth getting right: one asks for a click, the
 * other explains why the screen someone had open all week stopped working.
 *
 * `@supabase/ssr` names the cookie `sb-<project-ref>-auth-token`, splitting it
 * into `.0` / `.1` chunks when it outgrows a cookie. The pattern is anchored on
 * purpose: the PKCE cookie is `<same>-auth-token-code-verifier` and is written
 * by merely REQUESTING a link, so an unanchored match would tell a first-time
 * visitor that their session had expired.
 */
const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

async function hasSessionCookie(): Promise<boolean> {
  const store = await cookies();
  return store.getAll().some((cookie) => SESSION_COOKIE.test(cookie.name));
}
