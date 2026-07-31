/**
 * Structured logging with mandatory redaction.
 *
 * Two rules drive the design:
 *
 * 1. **Structured, not prose.** One JSON object per line, so a hosting
 *    platform's log search can filter on `level` or `event` instead of grepping
 *    English.
 *
 * 2. 🔴 **Personal data never reaches a log line.** MAZJ operates in Saudi
 *    Arabia under PDPL, and log aggregation is exactly the kind of secondary
 *    copy that turns a lawful collection into an unlawful one. Redaction here is
 *    applied on the way out rather than as a discipline at every call site,
 *    because the call site is where it gets forgotten.
 *
 * Redaction is TWO defences, and both are needed. A **key** denylist drops the
 * value of any field whose name looks personal, and a **value** scrubber
 * (`scrubValue`) removes mobile and email shapes from inside string values,
 * whose keys a denylist cannot judge. The first covers fields we name; the
 * second covers text an upstream wrote.
 *
 * Both are intentionally aggressive. Losing a debugging detail is cheaper than
 * leaking a customer's phone number into a third-party log store.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Substring match, case-insensitive, applied to every key at every depth. */
const REDACTED_KEY_PATTERNS = [
  // Personal data
  "email",
  "phone",
  "mobile",
  "name",
  "message",
  "address",
  "ip",
  "user_agent",
  "useragent",
  // Credentials
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "auth",
  "cookie",
  "session",
  "key",
] as const;

const REDACTED = "[redacted]";
const MAX_DEPTH = 6;

function isRedactedKey(key: string): boolean {
  const k = key.toLowerCase();
  return REDACTED_KEY_PATTERNS.some((p) => k.includes(p));
}

/**
 * Personal data sitting inside a string VALUE, where a key denylist is blind.
 *
 * 🔴 `isRedactedKey` matches on KEYS. That closes the case where WE choose the
 * field name and get it wrong. It does nothing at all about a number sitting
 * inside `{"errors":{"MobileNumber":["The value '+966534600488' is not
 * valid."]}}`, because the key that value hangs off is `errors`, which is on no
 * denylist and should not be. Rekaz runs ASP.NET Core, whose model binder echoes
 * the submitted value back verbatim, and every booking POST carries the
 * visitor's name, mobile and email inline. So the echo is not hypothetical: it
 * is the normal shape of a validation failure on the path that takes money.
 *
 * Two shapes are matched, mobile and email. ⚠️ A NAME cannot be pattern-matched
 * and is deliberately not attempted; that third one stays a matter of not
 * logging bodies you do not need.
 *
 * ⚠️ These are regex LITERALS, not `new RegExp` composed from string fragments.
 * The composed version reads a little better and fails a great deal worse: a
 * typo inside a fragment becomes a `SyntaxError` thrown at module scope, and
 * every module in `server/`, plus `/api/health` and `npm run check:env`, imports
 * this file. That is a crash on boot, not a lint error. A literal is checked
 * when the file is parsed, which is to say by `tsc` and by the editor, long
 * before it runs.
 *
 * ⚠️ Non-ASCII digits are written as `\u` escapes and never as literal bytes: a
 * literal Arabic-Indic digit in source is invisible in review and easy to lose
 * in a copy-paste.
 *
 * 🔴 EVERY BRANCH DEMANDS A PREFIX, and the hyphen is accepted as a separator
 * ONLY after a literal `+`. Both restrictions exist for one reason: this runs
 * over every string in every log line, and this codebase is full of hex
 * identifiers. `originHash` and `submitterHash` are 32 hex characters and a
 * Rekaz id is a UUID; a pattern loose enough to catch a bare nine-digit run
 * mangles both, and a permissive separator set lets
 * `69cddd5e-0030-4224-8926-a5d106dcaf0f` read as an international number. The
 * reason the shapes below leave those alone is structural rather than lucky: no
 * branch can produce a run of exactly 32, 36 or 64 characters, and a `+` never
 * appears in hex.
 *
 * The accepted cost is the plusless international form of a NON-Saudi number
 * (`00971...`), which is not scrubbed. What this codebase sends upstream is
 * always E.164 with the plus, so that is what comes back echoed.
 *
 * Order matters: the longest, most specific written form runs first, so a
 * shorter branch cannot bite a piece out of a number a longer one owns.
 */
const MOBILE_PATTERNS: readonly RegExp[] = [
  // Any country, when the plus is there. A `+` cannot occur inside a hex id, so
  // this is the one branch that can afford a loose separator set and a range.
  /(?<![0-9A-Za-z\u0660-\u0669\u06F0-\u06F9])\+(?:[\s().-]{0,2}[0-9\u0660-\u0669\u06F0-\u06F9]){8,15}(?![0-9A-Za-z\u0660-\u0669\u06F0-\u06F9])/gu,
  // `00966534600488`, the other way to write the plus. From here down the
  // country code (966) or the trunk `0` is the prefix that stands in for it.
  /(?<![0-9A-Za-z\u0660-\u0669\u06F0-\u06F9])[0\u0660\u06F0][0\u0660\u06F0][\s()]{0,2}[9\u0669\u06F9][6\u0666\u06F6][6\u0666\u06F6][\s()]{0,2}[15\u0661\u0665\u06F1\u06F5](?:[\s()]{0,2}[0-9\u0660-\u0669\u06F0-\u06F9]){8}(?![0-9A-Za-z\u0660-\u0669\u06F0-\u06F9])/gu,
  // `966534600488`. Rekaz tolerates and echoes the plusless form.
  /(?<![0-9A-Za-z\u0660-\u0669\u06F0-\u06F9])[9\u0669\u06F9][6\u0666\u06F6][6\u0666\u06F6][\s()]{0,2}[15\u0661\u0665\u06F1\u06F5](?:[\s()]{0,2}[0-9\u0660-\u0669\u06F0-\u06F9]){8}(?![0-9A-Za-z\u0660-\u0669\u06F0-\u06F9])/gu,
  // `0534600488`, the way it is written inside the Kingdom. The first digit of a
  // Saudi national number is 5 for mobile and 1 for landline.
  /(?<![0-9A-Za-z\u0660-\u0669\u06F0-\u06F9])[0\u0660\u06F0][15\u0661\u0665\u06F1\u06F5](?:[\s()]{0,2}[0-9\u0660-\u0669\u06F0-\u06F9]){8}(?![0-9A-Za-z\u0660-\u0669\u06F0-\u06F9])/gu,
];

/** An email address in a string value. Same prefix reasoning as the number. */
const EMAIL_PATTERN =
  /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

/**
 * Removes personal data from a string VALUE.
 *
 * Exported because `server/rekaz/client.ts` needs it outside a log line too: the
 * raw upstream body was going into `AppError.message`, which is re-logged
 * downstream under keys that match no denylist and, on the booking path, gets
 * persisted into Supabase.
 *
 * The email pass runs first so that an address containing a number cannot be
 * torn in half by the mobile pass.
 */
export function scrubValue(text: string): string {
  let out = text.replace(EMAIL_PATTERN, "[email]");
  for (const pattern of MOBILE_PATTERNS) out = out.replace(pattern, "[mobile]");
  return out;
}

/**
 * Recursively redacts sensitive KEYS, and scrubs personal data out of string
 * VALUES.
 *
 * Two passes because they catch two different mistakes. The key denylist catches
 * a field WE named badly. `scrubValue` catches a mobile or an email that arrived
 * inside somebody else's text, under a key that is perfectly innocent, which is
 * the shape every echoed upstream body has.
 *
 * Depth-capped because a Supabase error object can carry a cyclic-ish request
 * chain, and a logger that hangs the process is worse than no logger.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[max depth]";
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redact(v, depth + 1));
  }

  if (value instanceof Error) {
    // 🔴 This object is RETURNED, not re-walked, so its `message` key never
    // faces the denylist that would otherwise eat it. Free text written by an
    // upstream or a database driver therefore reaches the log untouched, which
    // is exactly the gap the value scrubber exists to close.
    return { name: value.name, message: scrubValue(value.message) };
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isRedactedKey(k) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }

  // 🔴 The other half of the redaction. A denylisted KEY drops its value above;
  // this catches a mobile or an email sitting inside a value whose key is
  // innocent, which is precisely how an echoed upstream body defeats a key
  // denylist. Numbers, booleans and symbols fall through untouched.
  if (typeof value === "string") return scrubValue(value);

  return value;
}

export type LogFields = Record<string, unknown>;

function emit(level: LogLevel, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...(redact(fields) as LogFields),
  });

  // `console` is the only transport a serverless platform reliably collects.
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, fields?: LogFields) => {
    if (process.env.NODE_ENV !== "production") emit("debug", event, fields);
  },
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
} as const;
