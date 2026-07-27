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
 *    a denylist applied on the way out rather than a discipline applied at every
 *    call site, because the call site is where it gets forgotten.
 *
 * The denylist is intentionally aggressive. Losing a debugging detail is
 * cheaper than leaking a customer's phone number into a third-party log store.
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
 * Recursively redacts sensitive keys.
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
    return { name: value.name, message: value.message };
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isRedactedKey(k) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }

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
