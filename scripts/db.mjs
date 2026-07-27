#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

import { config } from "dotenv";

/**
 * Thin wrapper around the Supabase CLI.
 *
 * Exists for one boring reason: npm scripts run through a shell that has never
 * heard of `.env.local`, so `supabase db push --db-url "$SUPABASE_DB_URL"` in
 * package.json passes an empty string and fails with a confusing error. This
 * loads the file first, then shells out.
 *
 * Usage:
 *   node scripts/db.mjs push          apply pending migrations
 *   node scripts/db.mjs types         regenerate server/supabase/types.gen.ts
 *   node scripts/db.mjs types:check   fail if the checked-in types have drifted
 *   node scripts/db.mjs diff <name>   write a migration from remote drift
 */

config({ path: ".env.local", override: false, quiet: true });

const DB_URL = process.env.SUPABASE_DB_URL;
const TYPES_PATH = "server/supabase/types.gen.ts";

if (!DB_URL) {
  console.error(
    "SUPABASE_DB_URL is not set.\n" +
      "Add it to .env.local. Find it under:\n" +
      "  Supabase dashboard > Project Settings > Database > Connection string\n\n" +
      "Note: the direct db.<ref>.supabase.co host is IPv6-only. On an IPv4-only\n" +
      "network, use the Supavisor pooler host instead."
  );
  process.exit(1);
}

/** Runs the CLI through npx so a broken global install cannot block us. */
function supabase(args, { capture = false } = {}) {
  return spawnSync("npx", ["--yes", "supabase", ...args], {
    encoding: "utf8",
    stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
  });
}

function generateTypes() {
  const result = supabase(
    ["gen", "types", "typescript", "--db-url", DB_URL, "--schema", "public"],
    { capture: true }
  );
  if (result.status !== 0) {
    console.error("Type generation failed.");
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case "push": {
    const result = supabase(["db", "push", "--db-url", DB_URL, ...rest]);
    process.exit(result.status ?? 1);
  }

  case "types": {
    writeFileSync(TYPES_PATH, generateTypes());
    console.log(`✅ Regenerated ${TYPES_PATH}`);
    break;
  }

  /**
   * CI guard. Generated types drifting from the schema is a silent failure:
   * everything compiles against a shape the database no longer has, and the
   * mismatch only surfaces at runtime on a column that no longer exists.
   */
  case "types:check": {
    const fresh = generateTypes();
    let current = "";
    try {
      current = readFileSync(TYPES_PATH, "utf8");
    } catch {
      console.error(`${TYPES_PATH} is missing. Run: npm run db:types`);
      process.exit(1);
    }
    if (fresh.trim() !== current.trim()) {
      console.error(
        `🔴 ${TYPES_PATH} is out of date with the database schema.\n` +
          "   Run: npm run db:types    then commit the result."
      );
      process.exit(1);
    }
    console.log("✅ Generated types match the database schema.");
    break;
  }

  case "diff": {
    const name = rest[0];
    if (!name) {
      console.error("Usage: node scripts/db.mjs diff <migration_name>");
      process.exit(1);
    }
    const result = supabase(["db", "diff", "--db-url", DB_URL, "-f", name]);
    process.exit(result.status ?? 1);
  }

  default:
    console.error(
      "Unknown command.\n" +
        "  push          apply pending migrations\n" +
        "  types         regenerate generated types\n" +
        "  types:check   fail if generated types have drifted\n" +
        "  diff <name>   write a migration from remote drift"
    );
    process.exit(1);
}
