import { afterEach, describe, expect, it, vi } from "vitest";

import { log, redact } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("redact", () => {
  /**
   * MAZJ operates under PDPL, and a log aggregator is exactly the kind of
   * secondary copy that turns a lawful collection into an unlawful one. The
   * denylist is aggressive on purpose: losing a debugging detail costs less
   * than leaking a customer's phone number into a third-party log store.
   */
  it.each([
    "email",
    "phone",
    "full_name",
    "fullName",
    "message",
    "ip_hash",
    "user_agent",
    "address",
  ])("redacts personal field %s", (field) => {
    const out = redact({ [field]: "sensitive" }) as Record<string, unknown>;
    expect(out[field]).toBe("[redacted]");
  });

  it.each([
    "password",
    "apiKey",
    "api_key",
    "authorization",
    "SUPABASE_SECRET_KEY",
    "access_token",
    "cookie",
  ])("redacts credential field %s", (field) => {
    const out = redact({ [field]: "sensitive" }) as Record<string, unknown>;
    expect(out[field]).toBe("[redacted]");
  });

  it("redacts at depth", () => {
    const out = JSON.stringify(
      redact({ a: { b: { c: { email: "someone@example.com" } } } })
    );
    expect(out).not.toContain("example.com");
  });

  it("redacts inside arrays", () => {
    const out = JSON.stringify(redact({ items: [{ phone: "+966534600488" }] }));
    expect(out).not.toContain("966534600488");
  });

  it("keeps non-sensitive fields intact", () => {
    expect(redact({ interest: "meeting_room", count: 3, ok: true })).toEqual({
      interest: "meeting_room",
      count: 3,
      ok: true,
    });
  });

  it("reduces an Error to name and message, dropping the stack", () => {
    expect(redact(new Error("boom"))).toEqual({
      name: "Error",
      message: "boom",
    });
  });

  it("terminates on deeply nested input instead of hanging", () => {
    let deep: Record<string, unknown> = { end: true };
    for (let i = 0; i < 50; i++) deep = { nested: deep };
    expect(() => redact(deep)).not.toThrow();
    expect(JSON.stringify(redact(deep))).toContain("[max depth]");
  });

  it("passes null and undefined through", () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });
});

describe("log", () => {
  it("emits one line of JSON with level, event and timestamp", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("lead.created", { interest: "event_hall" });

    expect(spy).toHaveBeenCalledOnce();
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line).toMatchObject({
      level: "info",
      event: "lead.created",
      interest: "event_hall",
    });
    expect(Date.parse(line.at)).not.toBeNaN();
  });

  it("redacts fields on the way out, not at the call site", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("lead.failed", { email: "someone@example.com" });
    expect(spy.mock.calls[0]![0]).not.toContain("example.com");
  });

  it("sends warnings and errors to the right console channel", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    log.warn("a");
    log.error("b");
    expect(warn).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();
  });
});
