import { describe, expect, it } from "vitest";

import {
  bookableRooms,
  listBranches,
  listProducts,
  listProviders,
  splitByBookingFlow,
} from "@/server/rekaz/catalog";
import {
  fetchAllReservations,
  getSlotsRaw,
  listReservations,
  REKAZ_PAGE_MAX,
} from "@/server/rekaz/reservations";
import { listSubscriptions } from "@/server/rekaz/subscriptions";
import { unwrap } from "@/server/core/result";

import { hasRekazCredentials } from "./setup";

/**
 * The drift alarm.
 *
 * Rekaz ships no OpenAPI document, no SDK and no changelog, so every type in
 * `server/rekaz/types.ts` is an assertion about an API we do not control. The
 * usual protection against that is a generated client failing to compile. We do
 * not have one, so this suite is the substitute: it calls the live API and
 * asserts that the fields we actually depend on are still there and still the
 * shape we think.
 *
 * These are assertions about STRUCTURE, deliberately, not about content. MAZJ's
 * operations team changes prices, adds bookings and edits product names as part
 * of running a business, and a test that goes red because someone raised the
 * meeting-room rate is a test that gets deleted. The one content assertion is
 * the `nameEn === nameAr` check, which exists precisely because it is a
 * surprising property we have built decisions on top of.
 *
 * ⚠️ READ-ONLY. There is no Rekaz sandbox; this is the production tenant with
 * real customer data in it. Nothing here may POST, PUT or DELETE.
 *
 * Skipped rather than failed without credentials, matching `rls.integration.test.ts`.
 */
describe.skipIf(!hasRekazCredentials)("rekaz live API", () => {
  describe("connectivity and auth", () => {
    it("authenticates and returns the MAZJ branch", async () => {
      const branches = unwrap(await listBranches());

      expect(branches.length).toBeGreaterThan(0);
      const branch = branches[0]!;
      expect(branch.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(typeof branch.name).toBe("string");
    });

    it("returns providers as a bare items list with no totalCount", async () => {
      // ⚠️ Pins the inconsistency: /providers omits `totalCount` while
      // /products, /reservations and /subscriptions all include it. If Rekaz
      // ever regularises this, that is a type change we want to hear about.
      const page = unwrap(await listProviders());

      expect(page).not.toHaveProperty("totalCount");
      expect(Array.isArray(page.items)).toBe(true);
      for (const provider of page.items) {
        expect(typeof provider.id).toBe("string");
        expect(typeof provider.name).toBe("string");
      }
    });
  });

  describe("catalog", () => {
    it("returns products carrying every field the booking flow reads", async () => {
      const page = unwrap(await listProducts());

      expect(page.items.length).toBeGreaterThan(0);
      for (const product of page.items) {
        expect(typeof product.id).toBe("string");
        expect(typeof product.slug).toBe("string");
        expect([0, 1]).toContain(product.type);
        expect(Array.isArray(product.pricing)).toBe(true);

        for (const price of product.pricing) {
          expect(typeof price.id).toBe("string");
          expect(typeof price.immutableId).toBe("string");
          expect(typeof price.amount).toBe("number");
          // Reservation prices carry `duration` (minutes), subscription prices
          // carry `billingPeriod` (days). Exactly one must be usable, or the
          // booking flow cannot tell the customer what they are buying.
          const hasDuration = typeof price.duration === "number";
          const hasBillingPeriod = typeof price.billingPeriod === "number";
          expect(
            hasDuration || hasBillingPeriod,
            `price ${price.name} on ${product.slug} has neither duration nor billingPeriod`
          ).toBe(true);
        }
      }
    });

    it("🔴 confirms Rekaz still holds no English content", async () => {
      // The day this goes red is the day Rekaz becomes a viable source of
      // English product names and `docs/rekaz-api-findings.md` needs rewriting.
      // Until then, rendering `nameEn` into the English site prints Arabic.
      const page = unwrap(await listProducts());

      for (const product of page.items) {
        expect(
          product.nameEn,
          `${product.slug}: nameEn diverged from nameAr, re-read the findings doc`
        ).toBe(product.nameAr);
      }
    });

    it("splits the catalog into the two booking flows, both non-empty", async () => {
      const page = unwrap(await listProducts());
      const { reservations, subscriptions } = splitByBookingFlow(page.items);

      // If either side empties, one of the two booking flows has nothing to
      // sell and the /book routes for it are dead.
      expect(reservations.length).toBeGreaterThan(0);
      expect(subscriptions.length).toBeGreaterThan(0);
    });

    it("derives at least one bookable room for the occupancy view", async () => {
      const page = unwrap(await listProducts());
      const rooms = bookableRooms(page.items);

      expect(rooms.length).toBeGreaterThan(0);
      for (const room of rooms) {
        expect(typeof room.id).toBe("string");
        expect(room.name.length).toBeGreaterThan(0);
      }
    });
  });

  describe("availability", () => {
    it("returns slots with the fields the picker renders", async () => {
      const products = unwrap(await listProducts());
      const { reservations } = splitByBookingFlow(products.items);
      const price = reservations[0]?.pricing[0];
      expect(price, "no reservation price to test slots with").toBeDefined();

      // A window starting a week out, safely clear of today's outdated slots.
      const start = new Date(Date.now() + 7 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const end = new Date(Date.now() + 9 * 86_400_000)
        .toISOString()
        .slice(0, 10);

      const slots = unwrap(
        await getSlotsRaw({ priceId: price!.id, startDate: start, endDate: end })
      );

      expect(Array.isArray(slots)).toBe(true);
      for (const slot of slots) {
        expect(slot.from).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(slot.to).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(typeof slot.isAvailable).toBe("boolean");
        expect(typeof slot.isOutDated).toBe("boolean");
        expect(typeof slot.amounts?.totalPrice).toBe("number");
      }
    });

    it("🔴 rejects a slots query with no MinQuantity", async () => {
      // Documented as optional, required in practice. `getSlotsRaw` defaults it
      // to 1 so no caller trips over this; the raw request proves the trap is
      // still there and the default is still earning its keep.
      const products = unwrap(await listProducts());
      const price = splitByBookingFlow(products.items).reservations[0]
        ?.pricing[0];

      const { rekazRequest } = await import("@/server/rekaz/client");
      const result = await rekazRequest({
        path: "/reservations/slots",
        query: {
          PriceId: price!.id,
          StartDate: "2026-08-10",
          EndDate: "2026-08-11",
        },
      });

      expect(result.ok).toBe(false);
    });
  });

  describe("operations data the dashboard reads", () => {
    it("returns reservations in the paginated envelope", async () => {
      const page = unwrap(await listReservations({ maxResultCount: 3 }));

      expect(typeof page.totalCount).toBe("number");
      expect(page.items.length).toBeLessThanOrEqual(3);
      for (const reservation of page.items) {
        expect(typeof reservation.id).toBe("string");
        expect(reservation.startAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(reservation.endAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(typeof reservation.status).toBe("string");
        expect(typeof reservation.productName).toBe("string");
      }
    });

    it("🔴 IGNORES every documented filter on /reservations", async () => {
      // The finding this whole pagination strategy exists for. dateMin, dateMax,
      // upcoming and statuses are all accepted and all silently ignored: each
      // returns the identical unfiltered first page. If this ever goes red,
      // Rekaz have implemented filtering and `fetchAllReservations` can stop
      // pulling the entire table on every dashboard render.
      const [unfiltered, filtered] = await Promise.all([
        listReservations({ maxResultCount: 100 }),
        listReservations({
          maxResultCount: 100,
          dateMin: "2026-07-28T00:00:00Z",
          dateMax: "2026-07-30T00:00:00Z",
          upcoming: true,
          statuses: ["Confirmed"],
        }),
      ]);

      const a = unwrap(unfiltered).items.map((r) => r.id);
      const b = unwrap(filtered).items.map((r) => r.id);

      expect(b, "filters appear to work now, revisit fetchAllReservations").toEqual(a);
    });

    it("🔴 orders reservations by creationTime, NOT startAt", async () => {
      // The second half of the trap. Because ordering is by creation, a booking
      // made months ago for next week is NOT on page 1, so "read the first page
      // for upcoming bookings" silently drops long-lead reservations. That is
      // why the dashboard pages through everything.
      const page = unwrap(await listReservations({ maxResultCount: 100 }));
      const created = page.items.map((r) => r.creationTime);

      const descending = created.every(
        (v, i) => i === 0 || created[i - 1]! >= v
      );
      expect(descending, "creationTime is no longer the sort key").toBe(true);
    });

    it("pages through the whole reservation list without duplicates", async () => {
      const all = unwrap(await fetchAllReservations());
      const ids = all.map((r) => r.id);

      expect(all.length).toBeGreaterThan(REKAZ_PAGE_MAX);
      expect(new Set(ids).size, "pagination returned duplicate rows").toBe(
        ids.length
      );
    });

    it("returns subscriptions in the paginated envelope", async () => {
      const page = unwrap(await listSubscriptions({ maxResultCount: 3 }));

      expect(typeof page.totalCount).toBe("number");
      for (const subscription of page.items) {
        expect(typeof subscription.id).toBe("string");
        expect(typeof subscription.status).toBe("string");
        expect(subscription.startAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(Array.isArray(subscription.items)).toBe(true);
      }
    });
  });

  describe("error handling", () => {
    it("maps an unknown id to not_found rather than throwing", async () => {
      const { rekazRequest } = await import("@/server/rekaz/client");
      const result = await rekazRequest({
        path: "/branches/00000000-0000-0000-0000-000000000000",
      });

      // The contract that matters: a failure arrives as data, never as an
      // exception, so no route handler can be taken down by a bad id.
      expect(result.ok).toBe(false);
    });

    it("🔴 never leaks the credential into an error", async () => {
      const { rekazRequest } = await import("@/server/rekaz/client");
      const result = await rekazRequest({ path: "/definitely-not-a-real-path" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const serialised = JSON.stringify({
          code: result.error.code,
          message: result.error.message,
          fields: result.error.fields,
        });
        expect(serialised).not.toContain(process.env.REKAZ_AUTH_BASIC);
        expect(serialised).not.toContain(process.env.REKAZ_TENANT_ID);
        expect(serialised.toLowerCase()).not.toContain("authorization");
      }
    });
  });
});
