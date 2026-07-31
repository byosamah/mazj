import { registerHooks } from "node:module";

import { config } from "dotenv";

/**
 * Proves the Rekaz credential in `.env.local` actually reaches Rekaz.
 *
 * 🔴 WHY THIS EXISTS, PLAINLY. `npm run check:env` cannot answer this question
 * and looks exactly as though it can. `server/env.ts` validates
 * `REKAZ_AUTH_BASIC` with a LENGTH check, `z.string().min(20)`, so twenty
 * characters of anything at all print a green tick beside a completely dead key.
 * The only assertion in this repo that has ever spoken to Rekaz lives in
 * `test/rekaz.integration.test.ts`, and that suite SKIPS when credentials are
 * absent, i.e. it reports success on exactly the condition it exists to catch.
 * So until this script there was no way to tell "the credential works" apart
 * from "the credential was never checked", and both were green.
 *
 * Measured 2026-07-29, rather than assumed: with a 32-character junk value in
 * `REKAZ_AUTH_BASIC`, `npm run check:env` printed "Backend environment is valid"
 * and exited 0, while this script printed HTTP 401 and exited 1.
 *
 * ONE authenticated call, `listBranches()`, which is a single GET `/branches`
 * returning a bare one-row array. No write, no parallelism, and 🔴 never
 * `/customers`: a tool written because 287 customer records sit behind a
 * disclosed key must not itself read them. The branch NAME is printed on
 * success, so a key pointing at the wrong tenant is visible too, rather than
 * only a key that does not work at all.
 *
 * ⚠️ IT VALIDATES THE RESOLVED ENVIRONMENT, with `.env.local` as the FALLBACK.
 * `override: false` means a variable already exported in your shell, or by
 * direnv, WINS over the file. That matters most at the step that most needs the
 * truth: the runbook asks you to re-run this after pasting a new key into
 * `.env.local` and BEFORE pasting it into Vercel, and a stale `export
 * REKAZ_AUTH_BASIC` would pass on a value that is neither the one you just
 * pasted nor the one going to production. So the script SAYS SO when it
 * happens, below, rather than leaving the claim in a comment nobody reads.
 *
 * ⚠️ It cannot see Vercel at all, so a pass here can never green-light
 * production. The value is triage: green here plus a dead booking page puts the
 * fault in the Vercel paste or the redeploy rather than in the key. The
 * deployed-side proof stays the one the runbook already names, one book route
 * per locale. See `docs/rekaz-api-findings.md`.
 *
 * Runs under Node's TypeScript stripping with the `react-server` condition set,
 * which is what makes `import "server-only"` resolve to its empty module rather
 * than throwing. See the `check:rekaz` script in package.json.
 *
 * 🔴 Run it with the command sandbox OFF. The sandbox breaks Node's outbound
 * TLS, which lands on the "could not reach Rekaz" branch below and blames the
 * vendor for the shell.
 */

// 🔴 CAPTURED BEFORE dotenv RUNS. `override: false` lets an already-exported
// shell variable beat the file, silently, and the one moment that is dangerous
// is a rotation: you paste a new key into `.env.local`, re-run this, and a stale
// `export` from an hour ago answers instead. The runbook then tells you to
// conclude the key is fine and the fault is Vercel. So the values are recorded
// here and the shadowing is reported at the end of a PASS, where it is the only
// thing that could make a green tick a lie.
const SHADOWED = ["REKAZ_AUTH_BASIC", "REKAZ_TENANT_ID", "REKAZ_API_BASE"].filter(
  (name) => process.env[name] !== undefined
);

config({ path: ".env.local", override: false, quiet: true });

/**
 * Lets Node resolve `server/`'s extensionless relative imports.
 *
 * ⚠️ Without this the script dies before it reaches Rekaz, on
 * `Cannot find module '/server/core/errors'`. Node's type stripping applies
 * strict ESM resolution, where a relative import must carry its real file
 * extension, while `server/` is written for the bundler's resolution
 * (`moduleResolution: bundler`) and says `from "../core/errors"`.
 * `scripts/check-env.mts` never meets this because `server/env.ts` imports only
 * bare specifiers, so this is the first script to reach deeper into the backend.
 *
 * 🔴 THE ALTERNATIVE WAS WORSE, which is why a resolver hook lives in a script.
 * The other way to make one authenticated call is for this script to build its
 * own `fetch`, and that means a SECOND copy of the credential header, the
 * `__tenant` trap (two underscores; Rekaz documents one) and the mandatory
 * explicit `User-Agent` that the edge in front of Rekaz 403s without. A probe
 * whose request differs from the application's request can report green on a
 * credential the site itself cannot use, which is precisely the ambiguity this
 * tool exists to remove. So it calls the real client, headers and error mapping
 * included.
 *
 * Deliberately narrow: relative specifiers only, the extension appended ONLY
 * after honest resolution has already failed, and the ORIGINAL error rethrown if
 * that retry fails too, so a genuinely missing module still names what the code
 * actually wrote.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
      return nextResolve(specifier, context);
    }
    try {
      return nextResolve(specifier, context);
    } catch (unresolved) {
      try {
        return nextResolve(`${specifier}.ts`, context);
      } catch {
        throw unresolved;
      }
    }
  },
});

const { listBranches } = await import("../server/rekaz/catalog.ts");

/**
 * The upstream HTTP status, read back out of the message `client.ts` built.
 *
 * ⚠️ This is the one place in the tree that PARSES an `AppError.message` rather
 * than logging or forwarding it, and `server/core/errors.ts` says in as many
 * words that callers must never do that.
 * The exception is deliberate and narrow: a 401 and a 400 both arrive here as
 * `internal`, so the code alone cannot say "your key is dead", which is the one
 * question this script was written to answer. `mapErrorResponse` builds that
 * prefix in exactly one place, as `Rekaz ${status} on ${method} ${path}`, and a
 * miss falls through to the catch-all, which prints everything verbatim. So the
 * worst outcome of this heuristic is vaguer advice, never wrong advice.
 */
function upstreamStatus(message: string): number | undefined {
  const matched = /^Rekaz (\d{3}) on /.exec(message);
  return matched ? Number(matched[1]) : undefined;
}

try {
  const result = await listBranches();

  if (result.ok) {
    const branches = result.value;
    // 🔴 GUARDED, because a 2xx does not guarantee an array. `rekazRequest`
    // returns `ok(undefined)` for ANY empty 2xx body, deliberately, since 204
    // and an empty body are legitimate on the PUT endpoints. Reading `.length`
    // off that threw a TypeError which the catch below then dressed up as a
    // configuration problem and sent the operator to `check:env`, a command
    // that passes. Wrong advice, at step 5 of a rotation, is worse than none.
    if (!Array.isArray(branches)) {
      console.error("❌ Rekaz answered 2xx with a body this script cannot read.");
      console.error(
        `   Expected an array of branches, got ${branches === undefined ? "an empty body" : typeof branches}.\n` +
          "   The credential was ACCEPTED, so this is not the key. Something\n" +
          "   between here and Rekaz is rewriting the response, or the endpoint\n" +
          "   changed shape. Capture it with curl before drawing a conclusion."
      );
      process.exit(1);
    }
    if (branches.length === 0) {
      // The credential is live, because a dead one never gets this far. An empty
      // tenant is therefore a tenant problem, and worth failing on: every
      // booking path resolves a branch, and `resolveBranchId` returns
      // "Rekaz returned no branches" from here.
      console.error("❌ Rekaz accepted the credential and returned NO branches.");
      console.error(
        "   The key is fine, so this is the tenant. Check REKAZ_TENANT_ID.\n" +
          "   Every booking resolves a branch, so nothing can be sold in this state."
      );
      process.exit(1);
    }

    // Rekaz holds no English content, so this name arrives in Arabic. It is
    // printed for recognition, not for display: seeing MAZJ's own branch is what
    // separates a working key from a working key on somebody else's tenant.
    const [first] = branches;
    const extra = branches.length > 1 ? ` (+${branches.length - 1} more)` : "";
    console.log("✅ Rekaz accepted the credential.");
    console.log("   Call:   GET /branches");
    console.log(`   Branch: ${first.name}${extra}`);

    // 🔴 LOUDEST ON A PASS, because a pass is the only outcome this can
    // falsify. A failure is a failure whichever value produced it; a green tick
    // on a shell variable you forgot you exported is the one that sends you to
    // Vercel looking for a fault that is sitting in your terminal.
    if (SHADOWED.length > 0) {
      console.warn(
        `⚠️  NOT the value in .env.local: ${SHADOWED.join(", ")} ${SHADOWED.length === 1 ? "was" : "were"} already set\n` +
          "   in this shell, and an exported variable wins over the file. If you\n" +
          "   just pasted a new key into .env.local, THIS DID NOT TEST IT. Open a\n" +
          `   clean shell (or 'unset ${SHADOWED.join(" ")}') and run it again.`
      );
    }

    console.warn(
      "⚠️  This proves your local environment, NOT the deployment. Vercel keeps\n" +
        "   its own copy of REKAZ_AUTH_BASIC that this script cannot read. After a\n" +
        "   rotation, the deployed-side proof is still one book route per locale."
    );
  } else {
    const { code, message } = result.error;
    const status = upstreamStatus(message);

    if (status === 401) {
      // The whole point of the script. Rekaz rejected the key itself.
      console.error("❌ Rekaz REJECTED the credential (HTTP 401).");
      console.error(
        "   REKAZ_AUTH_BASIC in .env.local is wrong, truncated, or has been\n" +
          "   regenerated since it was pasted. Rekaz displays a key once and\n" +
          "   cannot re-show it, only regenerate at platform.rekaz.io under\n" +
          "   User Management > API Keys.\n" +
          "   🔴 Regenerating also kills the key the deployment is using. Read the\n" +
          "   rotation checklist in docs/rekaz-api-findings.md BEFORE clicking it."
      );
      process.exit(1);
    }

    if (
      code === "upstream_unavailable" &&
      status === undefined &&
      // 🔴 NOT EVERY STATUS-LESS `upstream_unavailable` IS A DEAD CONNECTION.
      // The client returns the same code, with no `Rekaz <status> on ` prefix
      // for the regex to find, when a request COMPLETED and its body would not
      // parse. Without this clause an HTTP 200 carrying a captive-portal or
      // proxy page printed "Could not reach Rekaz at all" followed by the whole
      // "suspect your shell, the sandbox breaks TLS" paragraph. The tool built
      // to remove that exact ambiguity was manufacturing it. Anything that got
      // a reply falls through to the catch-all, which prints the message
      // verbatim and guesses nothing.
      !message.includes("unparseable JSON on a")
    ) {
      // Nothing answered: a timeout, DNS, or TLS. No HTTP status exists, which
      // is exactly what separates this from a 5xx (which carries one, and falls
      // through to the catch-all below).
      console.error("❌ Could not reach Rekaz at all.");
      console.error(`   ${message}`);
      console.error(
        "   🔴 Suspect this shell before suspecting the vendor. The command\n" +
          "   sandbox breaks Node's outbound TLS while curl to the same URL\n" +
          "   returns 200, because curl trusts the system keychain and Node ships\n" +
          "   its own CA store. It surfaces as a bare network failure, i.e. as\n" +
          "   'Rekaz is down'. Re-run with the sandbox OFF before concluding\n" +
          "   anything about the credential."
      );
      process.exit(1);
    }

    // 🔴 EVERYTHING ELSE, PRINTED RATHER THAN GUESSED. The three outcomes above
    // are not the whole space and pretending otherwise would make a tool built
    // to remove ambiguity invent a new one. A 403 lands in none of them, and
    // there are TWO different 403s here (a Cloudflare edge block on User-Agent,
    // which is ours to fix, versus a Rekaz business refusal, which is not),
    // plus 429 and every 5xx.
    console.error("❌ Rekaz refused the request, in a way this script will not label for you.");
    console.error(`   HTTP status: ${status ?? "not carried through"}`);
    console.error(`   Our code:    ${code}`);
    console.error(`   Message:     ${message}`);
    if (status === undefined) {
      console.error(
        "   Two codes deliberately carry no status out of server/rekaz/client.ts:\n" +
          "   `forbidden` is an upstream 403 that arrived in one of Rekaz's own\n" +
          "   JSON envelopes (a business refusal, kept bare because that message\n" +
          "   can reach a visitor), and `rate_limited` is an upstream 429."
      );
    }
    console.error(
      "   The rekaz.request_failed JSON line printed above carries the raw\n" +
        "   detail: the envelope shape, the field names, Cloudflare's edge code\n" +
        "   and the traceId Rekaz support asks for first."
    );
    process.exit(1);
  }
} catch (error) {
  // `env()` throws on the first Rekaz call when a variable is missing or
  // malformed, so a configuration fault arrives here rather than as a Result.
  // Its own message names every offending variable at once.
  console.error(error instanceof Error ? error.message : String(error));
  console.error(
    "\n   That is configuration, not connectivity. `npm run check:env` covers\n" +
      "   this ground first and names every missing variable in one pass."
  );
  process.exit(1);
}
