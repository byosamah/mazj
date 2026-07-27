import { config } from "dotenv";

/**
 * Validates the backend environment without starting the application.
 *
 * Run before a deploy, and in CI. Catching a missing variable here costs a few
 * seconds; catching it after deploy costs a broken endpoint and a rollback.
 *
 * Runs under Node's TypeScript stripping with the `react-server` condition set,
 * which is what makes `import "server-only"` resolve to its empty module rather
 * than throwing. See the `check:env` script in package.json.
 */

config({ path: ".env.local", override: false, quiet: true });

const { env } = await import("../server/env.ts");

try {
  const parsed = env();
  console.log("✅ Backend environment is valid.");
  console.log(`   Supabase project: ${parsed.SUPABASE_URL}`);
  // Never print key material, not even a prefix long enough to be useful.
  console.log(`   Publishable key:  set (${parsed.SUPABASE_PUBLISHABLE_KEY.length} chars)`);
  console.log(`   Secret key:       set (${parsed.SUPABASE_SECRET_KEY.length} chars)`);
  console.log(`   IP hash salt:     set (${parsed.IP_HASH_SALT.length} chars)`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
