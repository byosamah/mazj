import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { redact } from "@/server/core/logger";

/**
 * No `log.*` call anywhere may name a field the redactor eats.
 *
 * 🔴 This is the class fix. Everything else was a symptom.
 *
 * `core/logger.ts` redacts any key CONTAINING "email", "mobile", "name", "ip",
 * "key", "auth" and more, case-insensitively, at every depth. The denylist is
 * correct and stays. What it also does, silently, is swallow fields whose
 * contents are perfectly safe, and it swallowed ten of them: `submittedName` and
 * `mobileSuffix` on `booking.attempt` (the line a comment called the answer to
 * "who actually booked this?"), `receipt` on `booking.no_payment_link` (because
 * "receipt" contains "ip", so the whole Rekaz response vanished on the one path
 * where a customer may have been charged), `key` on
 * `booking.indeterminate_mark_failed`, and three `email` fields in
 * `services/admin-auth.ts`.
 *
 * A sibling test previously checked this by hand-copying the field list into a
 * fixture. That cannot fail when the source renames a field, which is the exact
 * mistake being defended against: it passed while `admin.magic_link.sent` was
 * still emitting nothing but `{"email":"[redacted]"}`.
 *
 * So this reads the SOURCE. Add a dead field anywhere in `server/` and it fails,
 * naming the file, the event and the field.
 */

const SERVER_DIR = join(process.cwd(), "server");

/**
 * Call sites deliberately handing the redactor something to eat.
 *
 * 🔴 KEYED ON `event -> field`, NOT on the field name alone, and the distinction
 * is the whole value of this list. A first draft exempted the bare name "email"
 * globally, which immediately re-admitted the exact bug this file exists to
 * catch: `admin.magic_link.sent` logging `{ email }` and recording nothing. A
 * blanket exemption is indistinguishable from the defect.
 *
 * Empty today, and it should stay that way. Adding an entry means writing down
 * why a log line is deliberately blank, which is a sentence worth having to
 * write.
 */
const DELIBERATELY_REDACTED = new Set<string>([]);

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, found);
    else if (extname(entry.name) === ".ts" && !entry.name.includes(".test."))
      found.push(path);
  }
  return found;
}

/**
 * Every `log.<level>("event", { ... })` call, with the keys of its object
 * literal.
 *
 * Deliberately shallow: it reads only top-level keys of the literal, because
 * that is what the call site controls. Nested objects (a Rekaz response, a
 * Supabase error) carry keys we did not author, and those the redactor handles
 * on its own at every depth.
 */
function logCalls(source: string): { event: string; fields: string[] }[] {
  const calls: { event: string; fields: string[] }[] = [];

  for (const match of source.matchAll(/\blog\.\w+\(\s*"([^"]+)"\s*,\s*\{/g)) {
    const event = match[1]!;
    const start = match.index! + match[0].length - 1;

    // Walk to the matching brace so a nested object cannot end the scan early.
    let depth = 0;
    let end = start;
    for (let i = start; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    const body = source.slice(start + 1, end);

    // Top-level keys only: skip anything nested inside a deeper brace.
    const fields: string[] = [];
    let nesting = 0;
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (nesting === 0) {
        // `key: value`, `key,` AND a bare shorthand `key` with nothing after
        // it. The last form is not pedantry: the real defect this file exists to
        // catch was the single-line `log.info("admin.magic_link.sent", { email })`,
        // whose shorthand property has neither a colon nor a trailing comma. An
        // earlier draft of this regex required one and sailed straight past it.
        const key = /^(\w+)\s*(?::|,|$)/.exec(trimmed);
        if (key) fields.push(key[1]!);
      }
      nesting += (line.match(/[{[(]/g) ?? []).length;
      nesting -= (line.match(/[}\])]/g) ?? []).length;
    }

    calls.push({ event, fields });
  }

  return calls;
}

/** Asks the real redactor, rather than restating its denylist here. */
function isSwallowed(field: string): boolean {
  const probe = redact({ [field]: "a-real-value" }) as Record<string, unknown>;
  return probe[field] === "[redacted]";
}

describe("every logged field survives the redactor", () => {
  const files = sourceFiles(SERVER_DIR);

  it("finds log call sites to check", () => {
    const total = files.reduce(
      (n, f) => n + logCalls(readFileSync(f, "utf8")).length,
      0
    );

    // Guards against the scanner silently matching nothing after a refactor,
    // which would make this whole suite pass by checking zero fields.
    expect(total).toBeGreaterThan(15);
  });

  it.each(files.map((f) => [f.replace(process.cwd() + "/", ""), f]))(
    "%s logs nothing that redacts to [redacted]",
    (_label, file) => {
      const dead: string[] = [];

      for (const { event, fields } of logCalls(readFileSync(file, "utf8"))) {
        for (const field of fields) {
          if (DELIBERATELY_REDACTED.has(`${event} -> ${field}`)) continue;
          if (isSwallowed(field)) dead.push(`${event} -> ${field}`);
        }
      }

      expect(
        dead,
        `These fields are written as "[redacted]" and record nothing:\n  ${dead.join("\n  ")}\n\n` +
          `Rename them so they do not collide with the logger denylist (originHash, ` +
          `submitterHash, idemPrefix, rekazResponse, submittedDomain are the ` +
          `established names), or add the field to DELIBERATELY_REDACTED with a reason.`
      ).toEqual([]);
    }
  );
});

describe("the redactor itself still works", () => {
  /** The half that must NOT regress while making the pseudonyms survive. */
  it("still eats genuinely personal keys", () => {
    for (const key of ["email", "customerMobile", "fullName", "ipHash", "apiKey"]) {
      expect(isSwallowed(key)).toBe(true);
    }
  });

  it("lets the established pseudonym names through", () => {
    for (const key of [
      "originHash",
      "submitterHash",
      "idemPrefix",
      "rekazResponse",
      "submittedDomain",
      "originAttested",
    ]) {
      expect(isSwallowed(key)).toBe(false);
    }
  });
});
