/**
 * Next.js startup hook. Runs once, server-side, before the first request.
 *
 * Its only job here is to check the backend environment at boot rather than on
 * the unlucky first visitor's request. A missing Supabase key should surface at
 * deploy time, not as a 500 on `/api/leads` that nobody connects to a release.
 *
 * 🔴 IT THROWS IN PRODUCTION AND ONLY WARNS IN DEVELOPMENT, and that asymmetry
 * is deliberate. Most work in this repo is frontend work: components, copy,
 * motion, RTL. Refusing to start `npm run dev` because nobody has pasted a
 * Supabase key yet would block all of it to protect an endpoint the person is
 * not touching. In production the trade-off inverts completely, because a
 * server that boots misconfigured serves errors to real customers.
 *
 * The same shape as the launch gate in `lib/site.ts`, for the same reason, and
 * keyed on `NODE_ENV` rather than a host-specific variable so it holds on
 * Vercel, Netlify, a container and a plain `npm start` alike.
 *
 * This file sits outside `server/` but is server-only by definition (Next never
 * bundles it for the browser), which is why it may import across the boundary.
 * It is one of exactly two sanctioned crossings; the other is `app/api/**`.
 */
export async function register(): Promise<void> {
  // Only the Node.js runtime has the backend available; this hook runs in both
  // runtimes, and the edge pass must not pull `server-only` into its graph.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { env } = await import("./server/env");

  try {
    env();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (process.env.NODE_ENV === "production") throw error;

    console.warn(
      `\n⚠️  Backend environment is incomplete. The site will run, but ` +
        `/api/* will fail.\n${message}\n`
    );
  }
}
