import "server-only";

import { cookies } from "next/headers";

import { createSessionClient } from "@/server/supabase/session";

/**
 * Wires Next's cookie store into the backend's session client.
 *
 * This is the whole reason `app/admin/_lib/` is a sanctioned boundary crossing.
 * `server/supabase/session.ts` declares the cookie access it needs without
 * importing `next/*`, and this file, which lives on the framework side of the
 * line, supplies it. See the comment at the top of `eslint.config.mjs`.
 */
export async function adminSupabase() {
  const store = await cookies();

  return createSessionClient({
    getAll: () =>
      store.getAll().map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
      })),

    /**
     * 🔴 The try/catch is load-bearing, not defensive padding.
     *
     * Next forbids writing cookies from a Server Component, and it enforces
     * that by throwing. Supabase's client writes cookies whenever it silently
     * refreshes an access token, which it will do on any page render that
     * happens to fall after the token's one-hour expiry.
     *
     * So without this, a perfectly ordinary page load an hour into a session
     * crashes the render with an error about cookies that has nothing
     * obviously to do with what the page was rendering.
     *
     * Swallowing it is correct because the write is not lost, only deferred:
     * the same refresh is retried on the next request that CAN write cookies,
     * which is the auth callback route or any route handler. The session
     * survives either way.
     */
    setAll: (cookiesToSet) => {
      try {
        for (const { name, value, options } of cookiesToSet) {
          store.set(name, value, options);
        }
      } catch {
        // Server Component render. See above.
      }
    },
  });
}
