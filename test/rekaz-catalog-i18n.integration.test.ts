import { readFileSync } from "node:fs";

import { beforeAll, describe, expect, it } from "vitest";

import { unwrap } from "@/server/core/result";
import { SPACES } from "@/server/domain/spaces";
import { listProducts } from "@/server/rekaz/catalog";
import type { RekazProduct } from "@/server/rekaz/types";

import { hasRekazCredentials } from "./setup";

/**
 * The catalog-to-copy alarm.
 *
 * Rekaz holds no English content. `nameEn` is byte-identical to `nameAr` on
 * every product, and a custom field's `label` is Arabic only, so
 * `messages/en.json` is the ONLY source of English for a price label and a
 * booking-form field. Both are keyed by a GUID, and nothing in the type system,
 * the build or the linter can tell you a GUID has gone stale.
 *
 * 🔴 THE SECOND DIRECTION IS THE ONE THAT MATTERS. A price's `id` ROTATES
 * whenever somebody edits that price in the Rekaz dashboard, while its
 * `immutableId` does not. A key copied from the wrong field is correct on the
 * day it is written and silently stops matching afterwards, at which point
 * `BookingFlow` falls back to `price.labelAr` and prints Arabic on the English
 * page. Asserting only "every live id has a key" cannot see that. A key that
 * matches NOTHING is the tell, which is why the orphan assertions exist and why
 * they name the rotating id explicitly when they find one.
 *
 * ✅ Checked against the live catalog on 2026-07-28: all 21 keys under
 * `Booking.price` match a live `immutableId` exactly. Zero rotating ids, zero
 * orphans, zero live prices without a key. This suite is therefore the alarm for
 * the NEXT edit, not a report of an outstanding defect.
 *
 * Scoped to the four ROOM products, deliberately, because an event-ticket price
 * lives in the same catalog, is created per event in the Rekaz dashboard, and
 * must NOT need a translation key here. Without that scoping this suite would go
 * red the day the owner publishes a paid event.
 *
 * ⚠️ READ-ONLY. There is no Rekaz sandbox; this is the production tenant with
 * real customer data in it. Nothing here may POST, PUT or DELETE.
 *
 * ⚠️ Skipped rather than failed without credentials, matching
 * `rekaz.integration.test.ts`. 🔴 That means it does NOT run on a fresh clone or
 * on any CI runner without the merchant key, and the thing it guards is tripped
 * by somebody editing a price in a dashboard, which produces no commit and no
 * diff. Run the suite with real credentials before a release, not only after a
 * backend change.
 */

type Dict = Record<string, string>;

function bookingNamespace(file: string): { price: Dict; customField: Dict } {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as {
    Booking: { price: Dict; customField: Dict };
  };
  return parsed.Booking;
}

const en = bookingNamespace("messages/en.json");
const ar = bookingNamespace("messages/ar.json");

/** The Rekaz slugs of the four bookable rooms, from the one mapping that owns them. */
const ROOM_SLUGS = new Set(SPACES.map((s) => s.rekazSlug));

describe.skipIf(!hasRekazCredentials)(
  "the live catalog and the message files agree",
  () => {
    let rooms: RekazProduct[] = [];

    beforeAll(async () => {
      // One call, shared by every assertion below. Rekaz answers `/products`
      // anywhere between 1.2s and 10.8s and degrades sharply under concurrent
      // load, and the same API serves mazj.sa's live checkout, so a fetch per
      // test would be both slow and rude.
      const catalog = unwrap(await listProducts());
      rooms = catalog.items.filter((p) => ROOM_SLUGS.has(p.slug));
    });

    it("finds all four room products, so nothing below passes vacuously", () => {
      // Without this, a slug renamed in the Rekaz dashboard empties every list
      // in this file and the whole suite goes green while checking nothing.
      expect(rooms.map((p) => p.slug).sort()).toEqual([...ROOM_SLUGS].sort());
    });

    it("has an English and an Arabic label for every live price", () => {
      const missing: string[] = [];

      for (const product of rooms) {
        for (const price of product.pricing) {
          const where = `${product.slug} / ${price.name}`;
          if (!en.price[price.immutableId]) {
            missing.push(`en Booking.price.${price.immutableId} (${where})`);
          }
          if (!ar.price[price.immutableId]) {
            missing.push(`ar Booking.price.${price.immutableId} (${where})`);
          }
        }
      }

      expect(
        missing,
        "a price with no key falls back to Rekaz's Arabic label, which renders " +
          "Arabic on the English booking page rather than failing"
      ).toEqual([]);
    });

    it("🔴 carries no price key that matches nothing in the live catalog", () => {
      const live = new Set<string>();
      const rotating = new Set<string>();
      for (const product of rooms) {
        for (const price of product.pricing) {
          live.add(price.immutableId);
          rotating.add(price.id);
        }
      }

      const orphans = [
        ...new Set([...Object.keys(en.price), ...Object.keys(ar.price)]),
      ]
        .filter((key) => !live.has(key))
        .map((key) =>
          rotating.has(key)
            ? `${key}  <- this is a live pricing[].id, NOT its immutableId`
            : key
        )
        .sort();

      expect(
        orphans,
        "these keys match no immutableId in the live catalog. Either the price " +
          "was deleted in the Rekaz dashboard, or the key was written from the " +
          "rotating `id` instead of the stable `immutableId`. Fix the key in " +
          "BOTH message files; do not delete it until you know which"
      ).toEqual([]);
    });

    it("has an English and an Arabic label for every live custom field", () => {
      const missing: string[] = [];

      for (const product of rooms) {
        for (const field of product.customFields ?? []) {
          const where = `${product.slug} / ${field.label}`;
          if (!en.customField[field.name]) {
            missing.push(`en Booking.customField.${field.name} (${where})`);
          }
          if (!ar.customField[field.name]) {
            missing.push(`ar Booking.customField.${field.name} (${where})`);
          }
        }
      }

      expect(
        missing,
        "a custom field with no key renders its Arabic label inside the English form"
      ).toEqual([]);
    });

    it("🔴 carries no custom-field key that matches nothing in the live catalog", () => {
      const live = new Set<string>();
      const byId = new Set<string>();
      for (const product of rooms) {
        for (const field of product.customFields ?? []) {
          // The form keys on `name`, which is the GUID sent back in the
          // reservation's `customFields` map, NOT on `id`. They are different
          // values and confusing them is silent.
          live.add(field.name);
          byId.add(field.id);
        }
      }

      const orphans = [
        ...new Set([
          ...Object.keys(en.customField),
          ...Object.keys(ar.customField),
        ]),
      ]
        .filter((key) => !live.has(key))
        .map((key) =>
          byId.has(key)
            ? `${key}  <- this is a custom field's \`id\`; the form keys on \`name\``
            : key
        )
        .sort();

      expect(
        orphans,
        "unreachable custom-field copy: this label can never be rendered"
      ).toEqual([]);
    });
  }
);
