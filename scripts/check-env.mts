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

  // 🔴 Loud when unset. Absent means `none`, which is the safe default but also
  // the weakest mode, and a deploy that forgets this would run that way forever
  // with nothing to notice it. Warned rather than thrown so local dev, which has
  // no proxy and correctly wants `none`, is not blocked.
  const trust = parsed.IP_TRUST_PROXY ?? "none";
  console.log(`   Proxy trust:      ${trust}`);
  if (trust === "none") {
    console.warn(
      "⚠️  IP_TRUST_PROXY is unset, so client IPs are treated as unattested and\n" +
        "   the rate limits lean entirely on their per-mobile / per-address\n" +
        "   dimension. Set it to `vercel` on the Vercel deployment."
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
