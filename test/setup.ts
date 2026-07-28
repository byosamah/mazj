import { config } from "dotenv";

/**
 * Test environment bootstrap.
 *
 * Next loads `.env.local` automatically; Vitest does not, so tests would
 * otherwise see an empty `process.env` and every integration test would fail
 * with a misleading "configuration is invalid" rather than an honest skip.
 *
 * `override: false` so that a variable already exported in the shell wins. That
 * is what lets CI point the same test suite at a different project without
 * editing a file.
 */
config({ path: ".env.local", override: false, quiet: true });

/**
 * True when real Supabase credentials are present.
 *
 * Integration tests use this to skip rather than fail. A developer running unit
 * tests on a fresh clone has no keys yet, and a red suite that means "you have
 * not configured anything" trains people to ignore red suites.
 */
export const hasSupabaseCredentials = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SECRET_KEY
);

/**
 * True when real Rekaz credentials are present.
 *
 * ⚠️ Rekaz publishes no sandbox, so the tests these gate hit the PRODUCTION
 * tenant holding real customer data. They are strictly read-only for exactly
 * that reason. Never add a write to a suite that runs unattended.
 */
export const hasRekazCredentials = Boolean(
  process.env.REKAZ_API_BASE &&
    process.env.REKAZ_AUTH_BASIC &&
    process.env.REKAZ_TENANT_ID
);
