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
const { REKAZ_STORE_ORIGIN, storeSharesDomainWith } = await import(
  "../server/rekaz/store.ts"
);

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

  // 🔴 The launch collision, and the ONE place anything says it out loud.
  //
  // A paid event links to its product on the Rekaz storefront, which is served
  // from mazj.sa. The launch plan has www.mazj.sa serving THIS site. The day
  // both are true, every ticket button points at a route this application does
  // not have and every buyer lands on our own 404 with the ticket unsold.
  //
  // Warned rather than thrown, deliberately, and it is the same call made for
  // the email variables below: refusing to boot over a link would take the
  // booking flow down with it. The owner has accepted this as a launch-day
  // chore, so the job here is to make sure it cannot be forgotten quietly.
  console.log(`   Rekaz store:      ${REKAZ_STORE_ORIGIN}`);
  if (storeSharesDomainWith(parsed.SITE_URL)) {
    console.warn(
      `⚠️  NEXT_PUBLIC_SITE_URL (${parsed.SITE_URL}) is the same domain as the\n` +
        "   Rekaz storefront, so every paid event's ticket button now points at\n" +
        "   this app instead of the store, and answers 404. Move the store to a\n" +
        "   subdomain (tickets.mazj.sa) and change REKAZ_STORE_ORIGIN in\n" +
        "   server/rekaz/store.ts to match."
    );
  }

  // 🔴 Warned, not thrown, and the asymmetry is deliberate. These four are read
  // by one feature (the startups offer). Throwing here would be honest for that
  // feature and catastrophic for the site: `env()` runs at module scope, so a
  // hard failure would take the live booking flow down over an unsent marketing
  // email. The requirement lives at the point of use instead, where the admin
  // sees the exact missing variable printed beside the application it could not
  // answer. See the comment block in server/env.ts.
  const email = [
    ["RESEND_API_KEY", parsed.RESEND_API_KEY],
    ["EMAIL_FROM", parsed.EMAIL_FROM],
    ["EMAIL_ALERT_TO", parsed.EMAIL_ALERT_TO],
    ["NEXT_PUBLIC_SITE_URL", parsed.SITE_URL],
  ] as const;
  const missingEmail = email.filter(([, value]) => !value).map(([name]) => name);

  if (missingEmail.length === 0) {
    console.log(`   Email sending:    ${parsed.EMAIL_FROM}`);
  } else {
    console.warn(
      `⚠️  Transactional email is NOT configured (${missingEmail.join(", ")}).\n` +
        "   Startup applications can still be received and decided, and the\n" +
        "   decision is stored either way, but no applicant is ever told. The\n" +
        "   admin screen shows the failure per application. Verify the sending\n" +
        "   domain in Resend first: it is DNS, not code."
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
