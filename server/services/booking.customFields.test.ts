import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What reaches Rekaz's `customFields`, and what does not.
 *
 * 🔴 The Server Action accepts ANY `cf:`-prefixed form key and only trims it,
 * and this service used to forward the whole map. Nothing checked the GUIDs
 * against the product's own `customFields`, which the server is already holding;
 * nothing bounded the values; and the free-text cleaner that guards the name and
 * the email was never applied to them. `isRequired` was a client attribute, so
 * the browser's `required` was the entire enforcement and a crafted post skipped
 * it, turning a field the visitor forgot into a Rekaz 400 that renders as
 * "Something went wrong on our side".
 *
 * ⚠️ THE FILE FIELD BELOW IS MARKED REQUIRED ON PURPOSE, and the live tenant's
 * is not. Rekaz publishes no upload endpoint, so this form cannot collect a file
 * at all; enforcing `isRequired` on one would refuse every events-hall booking
 * on OUR side. The fixture is harsher than reality so that exemption is proven
 * on every run rather than assumed.
 */

/** The three fields the live events hall declares. Keyed by `name`, not `id`. */
const FIELD_ATTENDEES = "3a14ba65-3e22-d2f1-b556-5b32d8ca8be6";
const FIELD_ABOUT = "b7b81d2b-4b3f-4ab2-b2ff-f7606911a440";
const FIELD_DOCUMENT = "3a1bf7d5-678d-a4d2-dc03-8ef286c23c73";

const createReservation = vi.fn(async (_input: Record<string, unknown>) => ({
  ok: true as const,
  value: {
    invoiceId: "inv-1",
    reservationIds: ["r-1"],
    paymentLink: "/orders/pay/X",
  },
}));

vi.mock("@/server/core/idempotency", () => ({
  beginIdempotent: async () => ({ ok: true, value: { kind: "proceed" } }),
  completeIdempotent: async () => ({ ok: true, value: undefined }),
  abandonIdempotent: async () => undefined,
}));

vi.mock("@/server/core/rate-limit", () => ({
  checkRateLimit: async () => ({
    ok: true,
    value: { allowed: true, remaining: 7, resetAt: new Date(), retryAfterSeconds: 0 },
  }),
  checkRateLimits: async () => ({
    ok: true,
    value: { allowed: true, remaining: 7, resetAt: new Date(), retryAfterSeconds: 0 },
  }),
  rateLimitedError: () => ({ code: "rate_limited", message: "x" }),
}));

vi.mock("@/server/env", () => ({
  env: () => ({
    IP_HASH_SALT: "0123456789abcdef0123456789abcdef",
    REKAZ_API_BASE: "https://platform.rekaz.io/api/public",
  }),
}));

// The booking record is bookkeeping AFTER the sale, deliberately best effort in
// the service. Stubbed to a success so nothing here depends on a database.
vi.mock("@/server/db/bookings", () => ({
  recordBooking: async () => ({ ok: true, value: undefined }),
}));

const PRICE = {
  id: "live-price-id",
  immutableId: "stable-price-id",
  order: 1,
  name: "ساعتان",
  duration: 120,
  billingPeriod: null,
  amount: 220,
  discountedAmount: 220,
  depositAmount: 0,
  hasDeposit: false,
};

/**
 * `id` and `name` are deliberately DIFFERENT values, because Rekaz expects the
 * `name` GUID back and sending `id` produces a field it silently ignores.
 */
const CUSTOM_FIELDS = [
  {
    id: "cf-1",
    name: FIELD_ATTENDEES,
    label: "كم عدد الحضور؟",
    placeholder: null,
    isRequired: true,
    type: 2,
  },
  {
    id: "cf-2",
    name: FIELD_ABOUT,
    label: "وصف الفعالية",
    placeholder: null,
    isRequired: true,
    type: 1,
  },
  {
    id: "cf-3",
    name: FIELD_DOCUMENT,
    label: "السجل التجاري - تصريح النشاط",
    placeholder: null,
    // ⚠️ Optional on the live tenant. Required here on purpose: see the header.
    isRequired: true,
    type: 10,
  },
];

const product = (
  id: string,
  slug: string,
  customFields: typeof CUSTOM_FIELDS
) => ({
  id,
  slug,
  nameAr: "x",
  nameEn: "x",
  name: "x",
  type: 0,
  typeString: "Reservation",
  pricing: [PRICE],
  customFields,
  productProviders: [],
  branchIds: ["branch-1"],
  isOutOfStock: false,
  amount: 220,
  duration: 120,
  description: null,
  shortDescription: null,
  maximumQuantityPerOrder: 1,
});

vi.mock("@/server/rekaz/catalog", () => ({
  listProducts: async () => ({
    ok: true,
    value: {
      totalCount: 2,
      items: [
        product("p-hall", "qaah-alfaalyat-almaarj", CUSTOM_FIELDS),
        // The meeting room declares none, which is what makes "an undeclared key
        // is dropped" testable at its strongest.
        product("p-meeting", "ghrfh-alajtmaaat-almlqa", []),
      ],
    },
  }),
  listBranches: async () => ({ ok: true, value: [{ id: "branch-1" }] }),
  resolveBranchId: async (p: { branchIds?: string[] }) => ({
    ok: true,
    value: p.branchIds?.[0] ?? "branch-1",
  }),
}));

vi.mock("@/server/rekaz/reconcile", () => ({
  reconcileReservation: async () => ({ ok: true, value: { outcome: "absent" } }),
  reconcileSubscription: async () => ({ ok: true, value: { outcome: "absent" } }),
}));

vi.mock("@/server/rekaz/reservations", () => ({
  getSlots: async () => ({
    ok: true,
    value: [{ from: "2026-08-10T17:00:00Z", to: "2026-08-10T19:00:00Z" }],
  }),
}));

vi.mock("@/server/rekaz/booking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/rekaz/booking")>();
  return {
    ...actual,
    // ⚠️ `CustomerMatch`, not a bare customer-or-null. The lookup gained a
    // THIRD outcome (`ambiguous`) on 2026-07-28; a `null` here now reaches
    // `lookup.kind` and throws rather than reading as "no such customer".
    findCustomerByMobile: async () => ({ ok: true, value: { kind: "none" } }),
    createReservation: (input: Record<string, unknown>) => createReservation(input),
    createSubscription: vi.fn(),
  };
});

const { createBooking } = await import("@/server/services/booking");

const BASE = {
  space: "event-hall",
  priceImmutableId: "stable-price-id",
  slotFrom: "2026-08-10T17:00:00Z",
  slotTo: "2026-08-10T19:00:00Z",
  customer: { name: "Test Person", mobile: "0534600488" },
  ip: { ip: "203.0.113.9", attested: true },
};

/** Both required non-file fields, filled in. */
const COMPLETE = {
  [FIELD_ATTENDEES]: "40",
  [FIELD_ABOUT]: "A product workshop",
};

function sentCustomFields(): Record<string, string> | undefined {
  const items = createReservation.mock.calls[0]![0].items as {
    customFields?: Record<string, string>;
  }[];
  return items[0]!.customFields;
}

beforeEach(() => {
  createReservation.mockClear();
});

describe("custom fields are validated against the product", () => {
  it("forwards the declared fields, keyed by the field's name GUID", async () => {
    const result = await createBooking({
      ...BASE,
      customFields: COMPLETE,
      idempotencyKey: "k-complete-1",
    });

    expect(result.ok).toBe(true);
    expect(sentCustomFields()).toEqual(COMPLETE);
  });

  it("🔴 refuses a missing required field here, rather than letting Rekaz 400", async () => {
    const result = await createBooking({
      ...BASE,
      customFields: { [FIELD_ATTENDEES]: "40" },
      idempotencyKey: "k-missing-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation_failed");
      // Named as the form input names it, so the page can point at the control.
      expect(result.error.fields?.[`cf:${FIELD_ABOUT}`]).toBe("required");
    }
    expect(createReservation).not.toHaveBeenCalled();
  });

  it("🔴 does NOT enforce a required FILE field, which the form cannot collect", async () => {
    // Rekaz publishes no upload endpoint and `BookingFlow` renders no input for
    // a type 10, so enforcing this would refuse every events-hall booking on our
    // own side. The fixture marks it required precisely to prove the exemption.
    const result = await createBooking({
      ...BASE,
      customFields: COMPLETE,
      idempotencyKey: "k-file-1",
    });

    expect(
      result.ok,
      "a required file field refused a booking the form cannot complete"
    ).toBe(true);
    expect(Object.keys(sentCustomFields() ?? {})).not.toContain(FIELD_DOCUMENT);
  });

  it("drops a key the product never declared", async () => {
    await createBooking({
      ...BASE,
      customFields: { ...COMPLETE, "not-a-declared-field": "anything" },
      idempotencyKey: "k-undeclared-1",
    });

    expect(sentCustomFields()).toEqual(COMPLETE);
  });

  it("sends no customFields at all for a product that declares none", async () => {
    await createBooking({
      ...BASE,
      space: "meeting-room",
      customFields: { "not-a-declared-field": "anything" },
      idempotencyKey: "k-nofields-1",
    });

    const items = createReservation.mock.calls[0]![0].items as Record<
      string,
      unknown
    >[];
    expect(Object.keys(items[0]!)).not.toContain("customFields");
  });

  it("cleans and bounds a value, the same as the customer's name", async () => {
    // 🔴 The control character is written as an ESCAPE SEQUENCE. A literal NUL
    // byte in a .ts file is a hard ESLint parse error.
    await createBooking({
      ...BASE,
      customFields: {
        [FIELD_ATTENDEES]: "40",
        [FIELD_ABOUT]: `A\u0000 workshop   about   things${"x".repeat(900)}`,
      },
      idempotencyKey: "k-dirty-1",
    });

    const about = sentCustomFields()![FIELD_ABOUT]!;
    expect(about).not.toContain("\u0000");
    expect(about).toContain("A workshop about things");
    expect(about.length).toBe(500);
  });
});
