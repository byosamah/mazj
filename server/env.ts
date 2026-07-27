import "server-only";

import { z } from "zod";

/**
 * Validated backend configuration.
 *
 * Mirrors the fail-loudly idiom already used by `lib/site.ts`: a misconfigured
 * backend should announce itself with a sentence you can act on, not with a
 * `TypeError: Cannot read properties of undefined` six frames deep inside the
 * Supabase client.
 *
 * WHEN THIS RUNS. Validation happens at module scope, but the API routes are
 * `force-dynamic`, so Next never executes this during `next build`. The
 * practical effect is that a missing variable surfaces on the first request
 * rather than at build time, which is why `npm run check:env` exists: run it in
 * CI or before a deploy to fail on the ground instead of in the air.
 *
 * WHY THE LITERAL `process.env.X` READS. Next inlines `NEXT_PUBLIC_*` variables
 * by static text substitution. Destructuring (`const {NEXT_PUBLIC_FOO} =
 * process.env`) or dynamic indexing defeats that and yields `undefined` in any
 * bundle. Every read below is written out in full on purpose. Do not "tidy"
 * them into a loop.
 */

/** Keys are `sb_secret_…` (current) or a `service_role` JWT (legacy). */
const SECRET_KEY_HINT =
  "Supabase dashboard > Project Settings > API Keys > secret key";

const schema = z.object({
  /**
   * Project origin, e.g. `https://abcdefgh.supabase.co`. No trailing slash:
   * supabase-js concatenates paths onto it and a trailing slash produces `//`
   * in every request path, which PostgREST answers with a 404.
   */
  SUPABASE_URL: z
    .url("must be a full URL including https://")
    .refine((v) => !v.endsWith("/"), "must not end with a trailing slash"),

  /**
   * Publishable (`sb_publishable_…`) or legacy `anon` key. Safe in a browser by
   * design: it carries no privileges of its own and every request it makes is
   * subject to Row Level Security.
   */
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20, "looks too short to be a key"),

  /**
   * Secret (`sb_secret_…`) or legacy `service_role` key.
   *
   * 🔴 This key BYPASSES Row Level Security completely. It is the database's
   * root password wearing a different hat. It must never be sent to a browser,
   * never logged, never put in a `NEXT_PUBLIC_*` variable, and never used in a
   * code path that has not already authorised the caller.
   */
  SUPABASE_SECRET_KEY: z.string().min(20, "looks too short to be a key"),

  /**
   * Salt for hashing client IP addresses before they touch the database.
   *
   * A bare IP is personal data under PDPL. A salted hash still supports
   * per-client rate limiting and abuse investigation while storing nothing that
   * identifies a person on its own. Rotating this value deliberately breaks the
   * link to all previously stored hashes, which is a feature.
   */
  IP_HASH_SALT: z.string().min(16, "use at least 16 characters of randomness"),
});

export type BackendEnv = z.infer<typeof schema>;

function readEnv(): BackendEnv {
  const parsed = schema.safeParse({
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    IP_HASH_SALT: process.env.IP_HASH_SALT,
  });

  if (parsed.success) return parsed.data;

  // Name every problem at once. Fixing environment variables one round-trip at
  // a time is miserable, especially on a hosting dashboard.
  const lines = parsed.error.issues.map((issue) => {
    const key = String(issue.path[0] ?? "(unknown)");
    return `  - ${ENV_VAR_NAMES[key] ?? key}: ${issue.message}`;
  });

  throw new Error(
    `Backend configuration is invalid:\n${lines.join("\n")}\n\n` +
      `Copy .env.example to .env.local and fill it in.\n` +
      `Keys live in the ${SECRET_KEY_HINT.replace(" > secret key", "")} page.\n` +
      `Generate IP_HASH_SALT with:  openssl rand -base64 32`
  );
}

/** Schema field name -> the actual environment variable it is read from. */
const ENV_VAR_NAMES: Record<string, string> = {
  SUPABASE_URL: "NEXT_PUBLIC_SUPABASE_URL",
  SUPABASE_PUBLISHABLE_KEY: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  SUPABASE_SECRET_KEY: "SUPABASE_SECRET_KEY",
  IP_HASH_SALT: "IP_HASH_SALT",
};

let cached: BackendEnv | null = null;

/**
 * Validated environment, parsed once per process.
 *
 * Lazy rather than eager so that importing a module for a unit test does not
 * require a full production environment to be present.
 */
export function env(): BackendEnv {
  return (cached ??= readEnv());
}

/** Test seam. Never call this from application code. */
export function resetEnvCacheForTests(): void {
  cached = null;
}
