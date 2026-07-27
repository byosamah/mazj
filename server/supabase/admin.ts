import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "../env";
import type { Database } from "./types.gen";

/**
 * The privileged Supabase client.
 *
 * 🔴 THIS CLIENT BYPASSES ROW LEVEL SECURITY COMPLETELY. The secret key is a
 * `service_role` credential: Postgres applies no policy to it and no grant
 * restricts it. Anything this client asks for, it gets.
 *
 * Three rules follow from that, and none of them are optional:
 *
 *   1. It never reaches a browser. `import "server-only"` at the top of this
 *      file turns any client-component import chain into a build error, which
 *      is the only enforcement that survives a tired afternoon.
 *
 *   2. It is used only after the caller has been authorised. Every query it
 *      runs must already have had its right to run decided in the service
 *      layer, because the database will not decide it for you.
 *
 *   3. Filters are the whole security boundary. `.eq("user_id", userId)` on a
 *      privileged client is not a convenience, it is the access control. Forget
 *      it and you return every row to whoever asked. This is exactly the risk
 *      docs/rekaz-api-review-ar.md section 4.3 raises about Rekaz's own
 *      admin-only key, and the reasoning applies just as much to ours.
 *
 * Constructed once per process. The client is a thin wrapper around `fetch`
 * with no connection pool to exhaust, so a module-level singleton is both
 * correct and cheaper than rebuilding it on every request.
 */

let client: SupabaseClient<Database> | null = null;

export function supabaseAdmin(): SupabaseClient<Database> {
  if (client) return client;

  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = env();

  client = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      // No user sits behind this client, so there is no session to keep. Left
      // on, supabase-js would try to persist and refresh tokens against storage
      // that does not exist on a server, and leak state between requests on a
      // warm serverless instance.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "x-client-info": "mazj-server/admin" },
    },
  });

  return client;
}

/** Test seam. Never call this from application code. */
export function resetAdminClientForTests(): void {
  client = null;
}
