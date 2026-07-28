import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "../env";
import type { Database } from "./types.gen";

/**
 * The request-scoped Supabase client: the one that carries a signed-in user.
 *
 * `server/CLAUDE.md` reserved a place for this "the day authentication ships".
 * This is that day.
 *
 * It uses the PUBLISHABLE key, not the secret one. That is the whole point:
 * every query it makes runs as the signed-in user with Row Level Security
 * applied. Reaching for `supabaseAdmin()` to answer a question about the
 * current user throws away the only mechanism that stops one user reading
 * another's rows.
 *
 * WHY IT TAKES A COOKIE ADAPTER RATHER THAN CALLING `cookies()` ITSELF.
 *
 * `server/` may not import `next/*`. That rule is what keeps this folder
 * liftable into its own service later, and it is enforced by ESLint in both
 * directions. `@supabase/ssr` needs to read and write cookies, and in Next that
 * means `next/headers`.
 *
 * So the dependency is inverted: this module declares the shape of the cookie
 * store it needs, and the caller in `app/` (which may import `next/*` freely)
 * supplies it. The framework import stays on the framework side of the line,
 * and this file stays portable. See `app/admin/_lib/supabase.ts`.
 */

/** A cookie as `@supabase/ssr` reads them. */
export type CookieRecord = { name: string; value: string };

/** A cookie as `@supabase/ssr` writes them, with whatever options it chose. */
export type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

/**
 * The minimum cookie access a session client needs.
 *
 * Structurally identical to what Next's `cookies()` provides, but expressed
 * without importing it.
 */
export type CookieAdapter = {
  getAll: () => CookieRecord[];
  /**
   * May be a no-op. In a Server Component, Next forbids writing cookies, and
   * `@supabase/ssr` will still attempt it while refreshing a token. Swallowing
   * that is correct there, because the refresh is retried in a context that can
   * write. See the caller for the full reasoning.
   */
  setAll: (cookies: CookieToSet[]) => void;
};

/**
 * Builds a Supabase client bound to one request's cookies.
 *
 * 🔴 Never cache this across requests. It closes over one visitor's cookie jar,
 * so a module-level singleton would serve the first visitor's session to
 * everyone who lands on the same warm serverless instance. That is the reason
 * `admin.ts` and `public.ts` may be singletons and this one may not.
 */
export function createSessionClient(
  cookies: CookieAdapter
): SupabaseClient<Database> {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = env();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: cookies.getAll,
      setAll: cookies.setAll,
    },
    global: {
      headers: { "x-client-info": "mazj-server/session" },
    },
  });
}
