import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorResponse } from "../core/http";
import { scrubValue } from "../core/logger";
import { rekazRequest } from "./client";

/**
 * The money file, tested without money.
 *
 * 🔴 `server/rekaz/client.ts` carries both booking POSTs, and until this file
 * existed its only coverage was the Rekaz integration suites, which hit the LIVE
 * production tenant and skip themselves the moment credentials are absent. In
 * CI, and on a fresh clone, that meant the one file every purchase passes
 * through was tested by nothing at all.
 *
 * Everything here is offline: `fetch` is stubbed, no network is touched, no
 * Rekaz credential is needed. What it pins is the half that has no schema and no
 * generated client behind it: the headers Rekaz silently requires, the two error
 * envelopes it actually returns, and the promise that neither the credential nor
 * a visitor's personal data can travel out of this file inside an error.
 *
 * ⚠️ `../env` is mocked with LITERALS inside the factory, not with the constants
 * below. `vi.mock` is hoisted above every declaration in the file and its factory
 * runs while `./client` is being imported, so a reference to a `const` here is a
 * temporal-dead-zone error rather than a value.
 *
 * ⚠️ Every fixture below is invented. There is no real mobile number, no real
 * address and no real person in this file, and none should be added: a test
 * fixture is copied into bug reports and pasted into chat far more often than a
 * log line is.
 */

vi.mock("../env", () => ({
  env: () => ({
    REKAZ_API_BASE: "https://platform.rekaz.io/api/public",
    REKAZ_AUTH_BASIC: "bWF6ai1rZXk6bWF6ai1zZWNyZXQtdmFsdWU=",
    REKAZ_TENANT_ID: "mazj-tenant-0001",
  }),
}));

const API_BASE = "https://platform.rekaz.io/api/public";
const AUTH_BASIC = "bWF6ai1rZXk6bWF6ai1zZWNyZXQtdmFsdWU=";
const TENANT_ID = "mazj-tenant-0001";

const fetchMock = vi.fn();

/**
 * The three things `rekazRequest` reads off a Response, and nothing else.
 *
 * Duck-typed rather than a real `Response`: constructing one drags in undici's
 * body handling, and the point of this suite is that no network primitive is
 * involved at all.
 */
function response(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response;
}

/** The structured lines `log.error` wrote during the current test. */
function logLines(): Record<string, unknown>[] {
  return vi
    .mocked(console.error)
    .mock.calls.map(
      ([line]) => JSON.parse(String(line)) as Record<string, unknown>
    );
}

/** The headers of the nth outgoing request. */
function sentHeaders(call = 0): Record<string, string> {
  const init = fetchMock.mock.calls[call]?.[1] as RequestInit;
  return init.headers as Record<string, string>;
}

/** The captured ProblemDetails body from `docs/rekaz-api-findings.md`. */
const PROBLEM_DETAILS = JSON.stringify({
  type: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  title: "One or more validation errors occurred.",
  status: 400,
  errors: { PriceId: ["The value 'BAD' is not valid for PriceId."] },
  traceId: "00-a639fa99de2cdb95f350a8652e1fddbc-cf39424cf2893552-01",
});

/**
 * The OTHER envelope, for an application or business failure.
 *
 * 🔴 RECONSTRUCTED, NOT CAPTURED, and that limit is the point of saying so.
 * `server/CLAUDE.md` records the measured 403 sentence
 * `رقم الجوال مسجل مسبقاً لعميل آخر` (booking against a mobile that already
 * belongs to another customer) and `docs/rekaz-api-findings.md` records the
 * envelope Rekaz's documentation promises. Nobody has saved the raw body of that
 * exact response, so this object is the two halves put together by hand.
 *
 * Which is why `client.ts` does not branch on this shape. It branches on
 * "recognisably one of Rekaz's own JSON envelopes at all", and everything else
 * keeps the old User-Agent diagnosis. These tests therefore prove the CODE, and
 * the day somebody captures the real body they prove the API too.
 */
const BUSINESS_REFUSAL = JSON.stringify({
  error: {
    code: null,
    message: "رقم الجوال مسجل مسبقاً لعميل آخر",
    details: null,
    data: null,
    validationErrors: null,
  },
});

/** Cloudflare, not Rekaz. Plain text, and it never reached Rekaz code. */
const EDGE_BLOCK = "error code: 1010";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);

  // 🔴 `AbortSignal.timeout` is stubbed for EVERY test, not just the two that
  // assert on it. Calling through would arm a real 10s (or 20s) timer per
  // request, and a suite of forty deliberate failures would then sit on forty
  // live timers holding the process open after the last assertion. The returned
  // signal never aborts, which is correct here: `fetch` is a mock and resolves
  // immediately.
  vi.spyOn(AbortSignal, "timeout").mockImplementation(
    () => new AbortController().signal
  );

  // `log.error` writes one JSON line to console.error. Silenced so a suite of
  // deliberate failures does not print forty of them, and captured because two
  // of the findings below are ABOUT what that line contains.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the request Rekaz actually receives", () => {
  it("🔴 always sends an explicit, non-empty User-Agent", async () => {
    // Measured: the API answers 403 to clients whose agent it does not
    // recognise. `Python-urllib/3.12` is refused outright while `curl` and
    // `node` pass. Node's own default happens to pass today, so a runtime
    // upgrade that changes it is a TOTAL outage that reads exactly like an
    // expired credential. This is the test that fails first if the header is
    // ever tidied away as redundant.
    fetchMock.mockResolvedValue(response(200, "[]"));

    await rekazRequest({ path: "/branches" });

    const agent = sentHeaders()["User-Agent"];
    expect(agent).toBeTypeOf("string");
    expect(agent.trim()).not.toBe("");
    expect(agent).toContain("MAZJ");
  });

  it("🔴 spells the tenant header with TWO underscores", async () => {
    // Rekaz's Quick Start page documents `_tenant`. It does not work.
    fetchMock.mockResolvedValue(response(200, "[]"));

    await rekazRequest({ path: "/branches" });

    expect(sentHeaders().__tenant).toBe(TENANT_ID);
    expect(sentHeaders()).not.toHaveProperty("_tenant");
  });

  it("sends the Basic credential and asks for English", async () => {
    fetchMock.mockResolvedValue(response(200, "[]"));

    await rekazRequest({ path: "/branches" });

    expect(sentHeaders().Authorization).toBe(`Basic ${AUTH_BASIC}`);
    expect(sentHeaders()["Accept-Language"]).toBe("en");
  });

  it("drops undefined query values rather than sending the string 'undefined'", async () => {
    fetchMock.mockResolvedValue(response(200, "{}"));

    await rekazRequest({
      path: "/reservations",
      query: { skipCount: 0, maxResultCount: 100, customerMobile: undefined },
    });

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe(`${API_BASE}/reservations`);
    expect(url.searchParams.get("maxResultCount")).toBe("100");
    expect(url.searchParams.get("skipCount")).toBe("0");
    expect(url.searchParams.has("customerMobile")).toBe(false);
  });

  it("never lets Next cache a Rekaz answer", async () => {
    // Rekaz is the system of record and its answers change without warning. A
    // cached availability grid is worse than a slow one.
    fetchMock.mockResolvedValue(response(200, "{}"));

    await rekazRequest({ path: "/products" });

    expect((fetchMock.mock.calls[0][1] as RequestInit).cache).toBe("no-store");
  });
});

describe("success bodies", () => {
  it("parses JSON and hands it back as the asserted type", async () => {
    fetchMock.mockResolvedValue(response(200, '{"totalCount":4,"items":[]}'));

    const result = await rekazRequest<{ totalCount: number }>({
      path: "/products",
    });

    expect(result).toEqual({ ok: true, value: { totalCount: 4, items: [] } });
  });

  it("treats an empty body as success, which is what the PUT endpoints return", async () => {
    fetchMock.mockResolvedValue(response(204, ""));

    const result = await rekazRequest({
      path: "/reservations/abc",
      method: "PUT",
    });

    expect(result.ok).toBe(true);
  });

  it("🔴 calls an unparseable 2xx upstream_unavailable, never internal", async () => {
    // This branch only runs when Rekaz ACCEPTED the request, so on a POST the
    // booking and the invoice already exist and we simply cannot read the
    // confirmation. `services/booking.ts` reads `upstream_unavailable` as
    // "dispatched, no definitive answer" and refuses to release the idempotency
    // key. `internal` would release it and let the retry create a duplicate
    // booking and a duplicate invoice.
    fetchMock.mockResolvedValue(response(200, "<html>gateway</html>"));

    const result = await rekazRequest({
      path: "/reservations/bulk",
      method: "POST",
      body: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("upstream_unavailable");
      expect(result.error.message).toContain("unparseable JSON");
    }
  });
});

describe("timeouts", () => {
  it("cuts a hung upstream off at ten seconds by default", async () => {
    fetchMock.mockResolvedValue(response(200, "{}"));

    await rekazRequest({ path: "/branches" });

    expect(vi.mocked(AbortSignal.timeout)).toHaveBeenCalledWith(10_000);
  });

  it("🔴 honours a per-request timeoutMs, because /products outlives the default", async () => {
    // Measured on this tenant: `/products` answers between 1.2s and 10.8s. A
    // uniform 10s cut-off therefore aborts the endpoint the booking flow has to
    // call FIRST, and reports our own limit as `upstream_unavailable`, which is
    // our bug wearing Rekaz's name on the path that takes money.
    const timedOut = new Error("The operation was aborted due to timeout");
    timedOut.name = "TimeoutError";
    fetchMock.mockRejectedValue(timedOut);

    const result = await rekazRequest({ path: "/products", timeoutMs: 20_000 });

    expect(vi.mocked(AbortSignal.timeout)).toHaveBeenCalledWith(20_000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("upstream_unavailable");
      // The message must name the deadline that actually applied, or a 20s abort
      // reads as a 10s one and sends whoever is on call hunting a phantom.
      expect(result.error.message).toContain("20000ms");
    }
  });

  it("reports a DNS or TLS failure as upstream_unavailable too", async () => {
    // Both are "Rekaz is not answering right now", which is retryable, so
    // neither is an `internal`.
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const result = await rekazRequest({ path: "/branches" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("upstream_unavailable");
  });
});

describe("the two error envelopes", () => {
  it("pulls the traceId and the field names out of ProblemDetails", async () => {
    fetchMock.mockResolvedValue(response(400, PROBLEM_DETAILS));

    const result = await rekazRequest({ path: "/reservations/slots" });

    // Rekaz rejected our request SHAPE. That is our bug, not the visitor's, so
    // it must not surface as "check your input".
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("internal");

    const line = logLines()[0];
    expect(line.shape).toBe("problem");
    expect(line.traceId).toBe(
      "00-a639fa99de2cdb95f350a8652e1fddbc-cf39424cf2893552-01"
    );
    expect(line.fields).toEqual(["PriceId"]);
  });

  it("🔴 rescues the legacy envelope's sentence from the denylist", async () => {
    // `redact` eats any key containing "message", so logging the body alone
    // records `{"error":{"message":"[redacted]"}}` and the one sentence Rekaz
    // wrote is gone, on exactly the failures that carry no traceId either.
    // `upstreamTitle` is named to dodge the denylist deliberately, the same way
    // `delivered` dodges it in `services/startup-application.ts`.
    fetchMock.mockResolvedValue(response(403, BUSINESS_REFUSAL));

    await rekazRequest({
      path: "/reservations/bulk",
      method: "POST",
      body: {},
    });

    const line = logLines()[0];
    expect(line.shape).toBe("legacy");
    expect(line.upstreamCode).toBeNull();
    expect(String(line.upstreamTitle)).toContain("رقم الجوال");

    // And the denylist itself must still be doing its job on the raw body.
    const detail = line.detail as { error: { message: string } };
    expect(detail.error.message).toBe("[redacted]");
  });

  it("🔴 parses the WHOLE body, so a large failure is not logged as unparseable", async () => {
    // This used to read `safeParse(summarise(text))`, handing `JSON.parse` a
    // body cut off mid-object. Every failure longer than 300 characters
    // therefore logged the string "[unparseable body]" and nothing else, which
    // is exactly the large validation failures worth reading.
    const many = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`Field${i}`, ["is not valid."]])
    );
    fetchMock.mockResolvedValue(
      response(400, JSON.stringify({ title: "nope", errors: many }))
    );

    await rekazRequest({ path: "/reservations/bulk", method: "POST", body: {} });

    const line = logLines()[0];
    expect(JSON.stringify(line.detail)).not.toContain("[unparseable body]");
    expect(line.fields).toHaveLength(40);
  });
});

describe("status to error code", () => {
  it("🔴 reads a 403 carrying JSON as a business refusal, not as our bug", async () => {
    // The 403 branch used to return `internal` unconditionally, without ever
    // looking at the body. So "that mobile belongs to another customer" reached
    // the visitor as "Something went wrong on our side. Please try again" on a
    // form that then failed identically on every retry, forever.
    fetchMock.mockResolvedValue(response(403, BUSINESS_REFUSAL));

    const result = await rekazRequest({
      path: "/reservations/bulk",
      method: "POST",
      body: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("🔴 puts NOTHING internal in the forbidden message", async () => {
    // 🔴 The regression guard for the one code in this switch whose message
    // `toPublicError` forwards VERBATIM. `internal` has its message discarded,
    // so the old 403 could say anything; `forbidden` cannot. Upstream's
    // sentence, our method and path, and the Rekaz traceId are all things a
    // visitor must never be handed, and all three are one careless template
    // literal away. Everything diagnostic lives in the log line instead.
    fetchMock.mockResolvedValue(response(403, BUSINESS_REFUSAL));

    const result = await rekazRequest({
      path: "/reservations/bulk",
      method: "POST",
      body: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const message = result.error.message;
      expect(message).not.toContain("رقم الجوال");
      expect(message).not.toContain("/reservations/bulk");
      expect(message).not.toContain("POST");
      expect(message).not.toContain("403");
      expect(message).not.toContain("traceId");
      // Short enough to read, and written in our own voice.
      expect(message.length).toBeLessThan(80);
    }

    // The detail did not vanish; it moved to where it belongs.
    const line = logLines()[0];
    expect(line.path).toBe("/reservations/bulk");
    expect(line.status).toBe(403);
    expect(line.shape).toBe("legacy");
  });

  it("🔴 keeps a plain-text 403 as internal, pointing at the User-Agent", async () => {
    // The edge in front of Rekaz, not Rekaz. This request never reached their
    // code, and it is ours to fix.
    fetchMock.mockResolvedValue(response(403, EDGE_BLOCK));

    const result = await rekazRequest({ path: "/products" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("internal");
      expect(result.error.message).toContain("User-Agent");
    }

    const line = logLines()[0];
    expect(line.shape).toBe("opaque");
    expect(line.edgeCode).toBe("1010");
  });

  it.each([
    ["an empty body", ""],
    ["a bare JSON object carrying no envelope marker", "{}"],
    ["a JSON array", "[]"],
  ])(
    "treats %s on a 403 as the edge, not as a refusal",
    async (_label, body) => {
      // 🔴 The doubtful case takes the SAFE branch, and which branch that is was
      // decided deliberately. Guessing "business refusal" hands a visitor copy
      // about a rule nobody broke and sends nobody to look at the User-Agent;
      // guessing "edge block" costs an engineer one wrong hypothesis. Nothing
      // here is Rekaz's application answering, so there is no positive evidence
      // for the reading with the visible consequence.
      fetchMock.mockResolvedValue(response(403, body));

      const result = await rekazRequest({ path: "/products" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("internal");
        expect(result.error.message).toContain("User-Agent");
      }
    }
  );

  it("names the credential on a 401 rather than guessing", async () => {
    fetchMock.mockResolvedValue(response(401, ""));

    const result = await rekazRequest({ path: "/products" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("internal");
      expect(result.error.message).toContain("credentials rejected");
    }
  });

  it("maps 404 to not_found and 429 to a labelled rate limit", async () => {
    fetchMock.mockResolvedValue(response(404, "{}"));
    const missing = await rekazRequest({ path: "/products/nope" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("not_found");

    fetchMock.mockResolvedValue(response(429, "{}"));
    const limited = await rekazRequest({ path: "/products" });
    expect(limited.ok).toBe(false);
    if (!limited.ok) {
      // Rekaz documents no rate limits and sends no Retry-After. 60s is a guess,
      // and the code says so.
      expect(limited.error).toMatchObject({
        code: "rate_limited",
        retryAfterSeconds: 60,
      });
    }
  });

  it("calls a 5xx retryable and any other 4xx ours", async () => {
    fetchMock.mockResolvedValue(response(500, '{"error":{"code":null}}'));
    const server = await rekazRequest({ path: "/products" });
    expect(server.ok).toBe(false);
    if (!server.ok) expect(server.error.code).toBe("upstream_unavailable");

    fetchMock.mockResolvedValue(response(418, "{}"));
    const odd = await rekazRequest({ path: "/products" });
    expect(odd.ok).toBe(false);
    if (!odd.ok) expect(odd.error.code).toBe("internal");
  });
});

/**
 * 🔴 A code whose message says nothing to the caller MUST say everything to the
 * log, and the two halves live in different files.
 *
 * `errorResponse` writes its `request.failed` line for a fixed list of codes.
 * `forbidden` joined that list the day this client started returning it; without
 * it the most diagnostic failure on the booking path would produce no entry at
 * all, because its message is deliberately bare. Tested here rather than beside
 * `core/http.ts` because this is the file that created the requirement.
 */
describe("a forbidden still reaches the log", () => {
  it("writes request.failed for forbidden, as it does for internal", () => {
    errorResponse({ code: "forbidden", message: "Rekaz refused this request." });
    errorResponse({ code: "internal", message: "boom" });
    // A code the client CAN act on, which needs no server-side line.
    errorResponse({ code: "validation_failed", message: "bad input" });

    expect(logLines().map((line) => line.code)).toEqual([
      "forbidden",
      "internal",
    ]);
  });
});

describe("nothing personal and nothing secret leaves this file", () => {
  /**
   * The exact shape ASP.NET Core produces when a booking's fields fail binding.
   *
   * ⚠️ Invented values. `+966512345678` is a syntactically valid Saudi mobile
   * that belongs to nobody, and the name and address are placeholders. Do not
   * swap in a real one to make the fixture feel authentic: the scrubber matches
   * on SHAPE, so a fake number exercises it exactly as well.
   */
  const ECHOED = JSON.stringify({
    title: "One or more validation errors occurred.",
    status: 400,
    errors: {
      "CustomerDetails.MobileNumber": ["The value '+966512345678' is not valid."],
      "CustomerDetails.Email": ["The value 'visitor@example.com' is not valid."],
      "CustomerDetails.Name": ["The value 'Fulan Alfulani' is not valid."],
    },
    traceId: "00-a639fa99de2cdb95f350a8652e1fddbc-cf39424cf2893552-01",
  });

  it("🔴 keeps the submitted mobile, email and name out of the error message", async () => {
    // The raw body used to be pasted into `AppError.message`, which is re-logged
    // downstream under keys that match no denylist and, on the booking path,
    // persisted into Supabase. Every booking POST carries the visitor's name,
    // mobile and email inline, and Rekaz echoes them back verbatim.
    fetchMock.mockResolvedValue(response(400, ECHOED));

    const result = await rekazRequest({
      path: "/reservations/bulk",
      method: "POST",
      body: {},
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).not.toContain("966512345678");
      expect(result.error.message).not.toContain("visitor@example.com");
      expect(result.error.message).not.toContain("Fulan Alfulani");
      // The field NAMES are the useful half and are kept.
      expect(result.error.message).toContain("CustomerDetails.MobileNumber");
    }
  });

  it("🔴 scrubs the mobile and the email out of the log line's VALUES", async () => {
    // The key denylist cannot see these: they sit inside `errors`, whose key is
    // innocent and should stay that way.
    //
    // ⚠️ A NAME is not pattern-matchable and is not attempted, which is why it is
    // absent from the assertions here and present in the test above: the message
    // is built from field names only, so nothing can echo into it, while the log
    // deliberately keeps the diagnostic body.
    fetchMock.mockResolvedValue(response(400, ECHOED));

    await rekazRequest({
      path: "/reservations/bulk",
      method: "POST",
      body: {},
    });

    const written = JSON.stringify(logLines()[0]);
    expect(written).not.toContain("966512345678");
    expect(written).not.toContain("visitor@example.com");
    expect(written).toContain("CustomerDetails.MobileNumber");
  });

  it("🔴 never leaks the credential, on any branch", async () => {
    // The Rekaz key is ADMIN-SCOPE: `GET /customers` with it returns MAZJ's
    // entire customer list. It has the same blast radius as
    // `SUPABASE_SECRET_KEY` and gets the same handling.
    const branches: [number, string][] = [
      [400, PROBLEM_DETAILS],
      [401, ""],
      [403, BUSINESS_REFUSAL],
      [403, EDGE_BLOCK],
      [404, "{}"],
      [429, "{}"],
      [500, '{"error":{"code":null,"message":"boom"}}'],
      [418, "{}"],
    ];

    for (const [status, body] of branches) {
      fetchMock.mockResolvedValue(response(status, body));
      const result = await rekazRequest({ path: "/customers" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const serialised = JSON.stringify(result.error);
        expect(serialised).not.toContain(AUTH_BASIC);
        expect(serialised).not.toContain(TENANT_ID);
        expect(serialised.toLowerCase()).not.toContain("authorization");
      }
    }

    const written = JSON.stringify(logLines());
    expect(written).not.toContain(AUTH_BASIC);
    expect(written).not.toContain(TENANT_ID);
  });
});

/**
 * `scrubValue` is owned by `core/logger.ts` and tested here because this is the
 * file that needed it: Rekaz is the one upstream that echoes submitted values
 * back at us.
 */
describe("scrubValue", () => {
  it("removes every written form of a Saudi mobile, Arabic-Indic digits included", () => {
    for (const written of [
      "+966512345678",
      "00966512345678",
      "966512345678",
      "0512345678",
      "+966 (0)51 234 5678",
      "+966-51-234-5678",
      // ٠٥١٢٣٤٥٦٧٨, which is what an Arabic keyboard emits. Half the site is
      // Arabic. Written as escapes so a copy-paste cannot silently normalise it
      // to ASCII and leave the test passing for the wrong reason.
      "\u0660\u0665\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668",
    ]) {
      expect(scrubValue(`The value '${written}' is not valid.`)).toBe(
        "The value '[mobile]' is not valid."
      );
    }
  });

  it("removes an email address", () => {
    expect(scrubValue("reply to visitor@example.com today")).toBe(
      "reply to [email] today"
    );
  });

  it("🔴 leaves the identifiers this codebase logs completely alone", () => {
    // The reason every branch demands a prefix, and the reason a hyphen only
    // separates digits after a literal plus. `originHash` and `submitterHash`
    // are 32 hex characters and a Rekaz id is a UUID; a pattern loose enough to
    // catch a bare nine-digit run mangles both, and the audit trail that
    // `test/booking-audit-log.test.ts` protects would go blank again by a
    // different route.
    for (const id of [
      "69cddd5e-0030-4224-8926-a5d106dcaf0f",
      "00000000-0000-0000-0000-000000000000",
      "e3b0c44298fc1c149afbf4c8996fb924",
      "00-a639fa99de2cdb95f350a8652e1fddbc-cf39424cf2893552-01",
      "2026-07-28T10:00:00Z",
      "2026-07-28T10:00:00.123+03:00",
      "SAR 34000",
      "/orders/pay/RMogHOPQc47FStqK",
      "MAZJ-Site/1.0 (+https://mazj.sa)",
    ]) {
      expect(scrubValue(id)).toBe(id);
    }
  });
});
