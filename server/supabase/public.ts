import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "../env";
import type { Database } from "./types.gen";

/**
 * The unprivileged Supabase client, using the publishable key.
 *
 * Row Level Security applies to everything it does, which today means it can do
 * essentially nothing: every table in this project has RLS enabled with no
 * policies and privileges revoked from `anon`.
 *
 * So why does it exist? Because "RLS is enabled" is a configuration claim, and
 * configuration claims rot. The integration test uses this client to attempt
 * the reads and writes an attacker would attempt, and asserts they fail. That
 * turns a claim into a test that breaks the build the day someone adds a
 * well-meaning policy that opens a table wider than they realised.
 *
 * Note the absence of `import "server-only"`: the publishable key is designed
 * to be public, and this client is the one a browser would legitimately use the
 * day there is a browser-side feature to use it for.
 */

let client: SupabaseClient<Database> | null = null;

export function supabasePublic(): SupabaseClient<Database> {
  if (client) return client;

  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = env();

  client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "x-client-info": "mazj-server/public" },
    },
  });

  return client;
}

/** Test seam. Never call this from application code. */
export function resetPublicClientForTests(): void {
  client = null;
}
