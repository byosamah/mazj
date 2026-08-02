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
import { REKAZ_PRODUCT_TYPE } from "@/server/rekaz/types";
import { listTicketPriceOptions } from "@/server/services/event-tickets";
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

      // Asserted against the enum rather than a literal list, because a literal
      // is what went red here on 2026-07-30: this read `[0, 1]` and the owner
      // added a `2` (Merchandise) product in the Rekaz dashboard, which is not a
      // commit and produces no diff. The alarm worked; pin it to the one place
      // the values are declared so the next new type lands in `types.ts` first.
      const knownTypes = Object.values(REKAZ_PRODUCT_TYPE) as number[];

      for (const product of page.items) {
        expect(typeof product.id).toBe("string");
        expect(typeof product.slug).toBe("string");
        expect(
          knownTypes,
          `${product.slug}: unknown product type ${product.type}, add it to REKAZ_PRODUCT_TYPE and to rekaz/store.ts`
        ).toContain(product.type);
        expect(Array.isArray(product.pricing)).toBe(true);

        for (const price of product.pricing) {
          expect(typeof price.id).toBe("string");
          expect(typeof price.immutableId).toBe("string");
          expect(typeof price.amount).toBe("number");

          // 🔴 SCOPED TO THE TWO BOOKING FLOWS, and that scoping is the finding
          // rather than a way to make the test pass. Reservation prices carry
          // `duration` (minutes) and subscription prices carry `billingPeriod`
          // (days), and the booking flow cannot describe what somebody is buying
          // without one of them. A one-time (Merchandise) price carries NEITHER,
          // correctly: it is a purchase, not a term. Nothing in the booking flow
          // ever reads one, and the event ticket that does only needs its amount.
          if (product.type === REKAZ_PRODUCT_TYPE.merchandise) continue;

          const hasDuration = typeof price.duration === "number";
          const hasBillingPeriod = typeof price.billingPeriod === "number";
          expect(
            hasDuration || hasBillingPeriod,
            `price ${price.name} on ${product.slug} has neither duration nor billingPeriod`
          ).toBe(true);
        }
      }
    });

    it("offers the one-time ticket products, and no room, to the admin", async () => {
      const options = unwrap(await listTicketPriceOptions());

      // A room reaching this list is the expensive failure: the dropdown would
      // put "private office, one year, 34,000 SAR" one mis-click from a 50 SAR
      // ticket, on the form that decides what a stranger is charged.
      const rooms = options.filter((o) =>
        [
          "adwyh-almsahh-almshtrkh",
          "private-office",
          "ghrfh-alajtmaaat-almlqa",
          "qaah-alfaalyat-almaarj",
        ].includes(o.productSlug)
      );
      expect(rooms, "a ROOM product reached the ticket dropdown").toEqual([]);

      // 🔴 THE "A TICKET PRODUCT EXISTS" ASSERTION WAS REMOVED ON 2026-08-02,
      // and it was removed rather than relaxed. It read
      // `options.some(o => o.productSlug.startsWith("faalyh-tjrybyh"))`, i.e. it
      // pinned one row of somebody's production dashboard, and the owner deleted
      // that product. It could never pass again, and a permanently red suite is
      // how a suite stops being read.
      //
      // It also contradicted this file's own contract, stated at the top: these
      // are assertions about STRUCTURE, not content, because MAZJ's operations
      // team edits the catalog as part of running a business.
      //
      // What it was really guarding (the filter must admit merchandise, not only
      // subscriptions, which is the defect that shipped before 2026-07-30 and
      // made the dropdown read "Free" with no explanation) is now
      // `server/services/event-tickets.filter.test.ts`. That is MORE coverage,
      // not less: this suite skips entirely without merchant credentials, so on
      // a fresh clone or a CI runner the rule was never being checked here at
      // all, while the unit test runs on every `npm run test`.
      //
      // ⚠️ The catalog legitimately holds ZERO ticketable products today
      // (measured 2026-08-02: four products, all of them rooms), which means
      // paid events cannot currently be created in /admin. That is an
      // operational state for the owner to resolve in the Rekaz dashboard, not
      // a code defect, so it must not be a failing test.

      for (const option of options) {
        expect(typeof option.amount).toBe("number");

        // 🔴 Rekaz stores a description as HTML and the admin PREFILLS a plain
        // text box from it. Markup arriving here means angle brackets in front
        // of the operator, and on MAZJ's own event page once saved.
        if (option.productDescription !== null) {
          expect(
            option.productDescription,
            `${option.productSlug}: markup survived htmlToPlainText`
          ).not.toMatch(/[<>]/);
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

    it("🔴 IGNORES every DATE filter on /reservations", async () => {
      // The finding this whole pagination strategy exists for. dateMin, dateMax,
      // upcoming and statuses are all accepted and all silently ignored: each
      // returns the identical unfiltered first page. If this ever goes red,
      // Rekaz have implemented filtering and `fetchAllReservations` can stop
      // pulling the entire table on every dashboard render.
      //
      // ⚠️ `customerMobile` is the ONE exception and lives outside this bag; see
      // `ListReservationsOptions`. Nesting the dead ones under `ignoredByRekaz`
      // is what stops the next reader believing the signature.
      //
      // 🔴 SEQUENTIAL, never `Promise.all`. Rekaz degrades catastrophically
      // under concurrency and this is the same API serving mazj.sa's live
      // checkout: load from a test run is load on somebody's purchase.
      const unfiltered = await listReservations({ maxResultCount: 100 });
      const filtered = await listReservations({
        maxResultCount: 100,
        ignoredByRekaz: {
          dateMin: "2026-07-28T00:00:00Z",
          dateMax: "2026-07-30T00:00:00Z",
          upcoming: true,
          statuses: ["Confirmed"],
        },
      });

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
      const ids = all.items.map((r) => r.id);

      expect(all.items.length).toBeGreaterThan(REKAZ_PAGE_MAX);
      expect(new Set(ids).size, "pagination returned duplicate rows").toBe(
        ids.length
      );

      // 🔴 The two assertions that would have caught the original loss. The
      // page cap sat at 4, i.e. 400 rows, against a tenant already holding 562,
      // so a third of the table was dropped on every dashboard render while
      // this suite stayed green: "more than one page" was true of both the
      // complete list and the broken one.
      expect(all.items.length, "the crawl came back short").toBe(all.totalCount);
      expect(all.truncated, "the tenant outgrew MAX_PAGES").toBe(false);
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
