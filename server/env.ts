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

  /**
   * Which proxy sits in front of this deployment, and may therefore be trusted
   * to have overwritten the client's forwarded headers.
   *
   * 🔴 Whether an IP header is trustworthy is a property of the TOPOLOGY, and a
   * request cannot report its own topology: every header that would reveal it is
   * set by the same client being evaluated. So it is configured, not detected.
   *
   * Optional, and absent means `none`, the least trusting reading. That default
   * can only ever make us treat a real address as untrustworthy, which costs a
   * little strictness; the opposite default would make a forgeable header look
   * attested, which is the mistake that matters. `checkEnv` warns when this is
   * unset so a Vercel deploy cannot quietly run unattested forever.
   */
  IP_TRUST_PROXY: z
    .enum(["vercel", "cloudflare", "none"])
    .optional()
    .describe("vercel | cloudflare | none"),

  /**
   * Rekaz Merchant Public API origin, including `/api/public`.
   *
   * No trailing slash, for the same reason as `SUPABASE_URL`: paths are
   * concatenated onto it.
   */
  REKAZ_API_BASE: z
    .url("must be a full URL including https://")
    .refine((v) => !v.endsWith("/"), "must not end with a trailing slash"),

  /**
   * The base64 `key:secret` pair Rekaz issues, sent as `Authorization: Basic`.
   *
   * 🔴 This is an ADMIN-SCOPE credential, not a storefront key. `GET /customers`
   * with it returns MAZJ's entire customer list, which is personal data under
   * PDPL. Treat it exactly like `SUPABASE_SECRET_KEY`: server-only, never
   * `NEXT_PUBLIC_`, never logged, never in an error response.
   *
   * Rekaz displays a generated key once and cannot re-show it, only regenerate.
   */
  REKAZ_AUTH_BASIC: z.string().min(20, "looks too short to be a base64 key pair"),

  /**
   * Sent as the `__tenant` header. 🔴 TWO underscores: the Quick Start page
   * documents `_tenant`, which the live API does not accept.
   */
  REKAZ_TENANT_ID: z.string().min(8, "looks too short to be a tenant id"),
}).superRefine((value, ctx) => {
  // 🔴 REQUIRED IN PRODUCTION. Advisory configuration is not a security control.
  //
  // Left optional, a deploy that forgets this runs forever in `none`, where the
  // client IP is read verbatim out of a header the client wrote, the `attested`
  // flag is false for every request, and both rate limits fall back to their
  // resource dimension alone. Nothing anywhere would report it.
  //
  // Same idiom as `lib/site.ts`, which refuses a production build while the
  // origin is still the placeholder: a launch gate that fails loudly on the
  // ground beats one that fails silently in the air. `none` remains a legal
  // VALUE, so a self-hosted deployment behind nothing can still say so on
  // purpose; what is refused is leaving it unsaid.
  if (process.env.NODE_ENV === "production" && value.IP_TRUST_PROXY === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["IP_TRUST_PROXY"],
      message:
        "required in production. Set `vercel` on Vercel, `cloudflare` behind " +
        "Cloudflare, or `none` to state deliberately that nothing trusted sits " +
        "in front. Unset means both rate limits run on client-supplied values.",
    });
  }
});

export type BackendEnv = z.infer<typeof schema>;

function readEnv(): BackendEnv {
  const parsed = schema.safeParse({
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    IP_HASH_SALT: process.env.IP_HASH_SALT,
    IP_TRUST_PROXY: process.env.IP_TRUST_PROXY?.trim().toLowerCase() || undefined,
    REKAZ_API_BASE: process.env.REKAZ_API_BASE,
    REKAZ_AUTH_BASIC: process.env.REKAZ_AUTH_BASIC,
    REKAZ_TENANT_ID: process.env.REKAZ_TENANT_ID,
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
  IP_TRUST_PROXY: "IP_TRUST_PROXY",
  REKAZ_API_BASE: "REKAZ_API_BASE",
  REKAZ_AUTH_BASIC: "REKAZ_AUTH_BASIC",
  REKAZ_TENANT_ID: "REKAZ_TENANT_ID",
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
