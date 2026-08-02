import "server-only";

import { errors, type AppError } from "../core/errors";
import { err, ok, type Result } from "../core/result";
import { SPACES } from "../domain/spaces";
import { htmlToPlainText } from "../domain/text";
import { listProducts } from "../rekaz/catalog";
import {
  chargedAmount,
  REKAZ_PRODUCT_TYPE,
  type RekazPrice,
  type RekazProduct,
} from "../rekaz/types";

/**
 * The ticket behind a paid event.
 *
 * 🔴 READ THIS BEFORE CHANGING ANYTHING HERE. This module READS the Rekaz
 * catalog and never writes to it, and that is the whole design rather than a
 * gap. Two measured facts put it there:
 *
 * 1. **The catalog is read-only over the API.** `GET /products` exists and there
 *    is no POST. So this site cannot create a ticket. Somebody adds the price in
 *    the Rekaz dashboard and the admin picks it from a dropdown.
 *
 * 2. **A ticket is a one-time (`Merchandise`) product, and Rekaz publishes no
 *    write endpoint for one.** Owner decision, 2026-07-30. The only documented
 *    writes are `POST /reservations/bulk`, `/subscriptions`, `/customers` and
 *    `/attendances`, and Rekaz's own storefront sells merchandise through an
 *    add-to-cart flow rather than a single call.
 *
 * ⚠️ So a paid event does not transact here at all. `/events/<slug>` shows the
 * live price and links to the product's page on the Rekaz storefront, built by
 * `rekaz/store.ts`. What that costs, accepted by the owner: no seat count, no
 * attendee list, no sold-out state and no confirmation of payment for a paid
 * event. Those are counted in Rekaz. Design record:
 * `docs/superpowers/specs/2026-07-30-paid-events-link-out-design.md`.
 *
 * ⚠️ This module previously created the order itself, against a
 * subscription-type price, and every ticket sold appeared in Rekaz's
 * subscriptions list as a one-day entry. That path was deleted on 2026-07-30. A
 * grep for `createTicketOrder` finds nothing; it is in git if it is ever needed.
 */

/** Rekaz product slugs that are ROOMS, and therefore never event tickets. */
const SPACE_SLUGS = new Set(SPACES.map((s) => s.rekazSlug));

/**
 * Product types a ticket may legitimately be.
 *
 * `merchandise` is what MAZJ actually uses. `subscription` stays admissible
 * because it genuinely is buyable on the storefront under its own path, so an
 * event pointed at one still works; excluding it would break an event nobody
 * changed. `reservation` is excluded: it is only sellable against a slot Rekaz
 * reports as available, which would mean configuring working hours per event.
 */
const TICKETABLE_TYPES = new Set<number>([
  REKAZ_PRODUCT_TYPE.merchandise,
  REKAZ_PRODUCT_TYPE.subscription,
]);

/**
 * Whether a catalog product may be offered to the admin as an event ticket.
 *
 * 🔴 EXPORTED FOR ITS OWN TEST, and the reason is a guard that quietly stopped
 * guarding. This rule used to be asserted only inside
 * `test/rekaz.integration.test.ts`, against the LIVE tenant, by checking that a
 * product slugged `faalyh-tjrybyh` was still on sale. That had two faults which
 * both came due: it `skipIf`s away on any machine without merchant credentials,
 * so a fresh clone and any CI runner never ran it at all, and it pinned a row in
 * somebody's production dashboard, so it went permanently red on 2026-08-02 when
 * the owner deleted that product. The rule itself never depended on either: it
 * is two set memberships, and it is now tested as two set memberships, offline,
 * on every run.
 *
 * The invariant that matters is the SECOND line. A room reaching this list puts
 * "private office, one year, 34,000 SAR" one mis-click from a 50 SAR ticket, on
 * the form that decides what a stranger is charged.
 *
 * Structural parameter rather than `RekazProduct` so a test can state the two
 * fields the rule actually reads instead of constructing a whole catalog entry.
 */
export function isTicketableProduct(product: {
  type: number;
  slug: string;
}): boolean {
  if (!TICKETABLE_TYPES.has(product.type)) return false;
  if (SPACE_SLUGS.has(product.slug)) return false;
  return true;
}

export type TicketPriceOption = {
  /** Stable across dashboard edits. This is what an event stores. */
  immutableId: string;
  /** Rekaz holds no English content, so this label is Arabic. */
  label: string;
  amount: number;
  productSlug: string;
  productName: string;
  /**
   * The product's description, tags stripped, for the admin form to PREFILL its
   * Arabic box with.
   *
   * 🔴 ARABIC, ALWAYS, and never a candidate for the English field. `nameEn` is
   * byte-identical to `nameAr` on every product in this tenant, so "the English
   * one" does not exist and pulling it would print Arabic onto the English page.
   *
   * ⚠️ Flattened HERE rather than in the browser: Rekaz stores it as HTML, and
   * the field it lands in is plain text rendered with its line breaks preserved.
   * Sending the markup to the client would put angle brackets in front of the
   * operator and, if saved, on MAZJ's own event page.
   */
  productDescription: string | null;
};

/**
 * How many tickets are left, in the same shape `seatState` uses for a free
 * event, so the page can treat the two identically.
 *
 * 🔴 `sold_out` rests on `product.isOutOfStock`, a plain boolean this codebase
 * has always read. The QUANTITY fields are a different matter: both MAZJ ticket
 * products sit on `isUnlimited: true` today, so `remainingQuantity` has never
 * been observed carrying a number and its meaning is inferred from its name. A
 * missing or non-numeric value is therefore treated as "say nothing", never as
 * zero. Claiming a false sold-out costs a real sale.
 */
export type TicketStock =
  | { kind: "unlimited" }
  | { kind: "available" }
  | { kind: "running_low"; left: number }
  | { kind: "sold_out" };

/**
 * When "N tickets left" starts appearing.
 *
 * ⚠️ A FIXED count, not a ratio, and that is a deliberate departure from
 * `lowSeatThreshold` in `domain/events.ts`, which scales urgency to the size of
 * the room. It can do that because it knows the capacity. Here the only figure
 * that can be trusted is what is LEFT: deriving a total from
 * `availableQuantity`, or from `allocated + remaining`, would mean asserting
 * what those fields mean on a tenant where they have never held a value. 8 is
 * that function's own ceiling for "genuinely nearly gone".
 */
const LOW_TICKET_COUNT = 8;

export function ticketStock(
  product: RekazProduct,
  price: RekazPrice
): TicketStock {
  if (product.isOutOfStock) return { kind: "sold_out" };

  const stock = price.stock;
  if (!stock || stock.isUnlimited) return { kind: "unlimited" };

  const left = stock.remainingQuantity;
  if (typeof left !== "number") return { kind: "unlimited" };
  if (left <= 0) return { kind: "sold_out" };
  if (left <= LOW_TICKET_COUNT) return { kind: "running_low", left };
  return { kind: "available" };
}

/**
 * Every price the admin may legitimately attach to an event.
 *
 * 🔴 The four room products are EXCLUDED, and that exclusion is a safety
 * feature rather than tidiness. Without it the dropdown offers "private office,
 * one year, 34,000 SAR" beside "event ticket, 50 SAR", one mis-click apart, on
 * a form whose whole job is deciding what a stranger gets charged.
 *
 * Derived from the catalog rather than an allowlist, so a ticket created in the
 * Rekaz dashboard appears here with no deploy.
 */
export async function listTicketPriceOptions(): Promise<
  Result<TicketPriceOption[], AppError>
> {
  const catalog = await listProducts();
  if (!catalog.ok) return catalog;

  const options: TicketPriceOption[] = [];

  for (const product of catalog.value.items ?? []) {
    if (!isTicketableProduct(product)) continue;

    for (const price of product.pricing ?? []) {
      options.push({
        immutableId: price.immutableId,
        label: price.name,
        // 🔴 `chargedAmount`, NOT `price.amount`. It is the one rule for "what
        // the buyer is charged", and it matters more here than it looks: the
        // admin picks a ticket off this label and the storefront bills whatever
        // Rekaz has, so an undiscounted figure here would have somebody choose a
        // 50 SAR ticket that actually sells for 40.
        amount: chargedAmount(price),
        productSlug: product.slug,
        productName: product.nameAr,
        productDescription: product.description
          ? (htmlToPlainText(product.description) || null)
          : null,
      });
    }
  }

  return ok(options);
}

export type ResolvedTicket = {
  product: RekazProduct;
  price: RekazPrice;
  stock: TicketStock;
};

/**
 * The live price behind an event's stored handle.
 *
 * 🔴 Looked up by `immutableId`, and this is the reason a stale event page
 * cannot advertise yesterday's price: whatever `id` that immutable handle maps
 * to TODAY is what the storefront charges. Price ids rotate whenever a price is
 * edited in the Rekaz dashboard, so the alternative is an event that silently
 * starts quoting a number nobody is charged.
 *
 * ⚠️ It returns the PARENT PRODUCT as well as the price, and both callers need
 * it: the public page builds the storefront URL from the product's `slug` and
 * `type`, and the admin reads the amount to store as its display snapshot.
 *
 * 🔴 BEING SOLD OUT IS NOT AN ERROR HERE, and it used to be. That was a live
 * footgun: `isOutOfStock` returned a `conflict`, the admin maps `conflict` to
 * "That ticket price is no longer in Rekaz. Pick another, or set the event to
 * free", and so a ticket that had simply sold out told the owner its price had
 * been deleted while prescribing the one irreversible action on the screen.
 * Setting a sold-out event to free makes every subsequent sign-up free. Selling
 * out is a normal, temporary, GOOD state; it is now reported as `stock` and each
 * caller decides. The public page says "Fully booked"; the admin saves happily.
 */
export async function resolveTicketPrice(
  immutableId: string
): Promise<Result<ResolvedTicket, AppError>> {
  const catalog = await listProducts();
  if (!catalog.ok) return catalog;

  for (const product of catalog.value.items ?? []) {
    const price = product.pricing?.find((p) => p.immutableId === immutableId);
    if (!price) continue;

    return ok({ product, price, stock: ticketStock(product, price) });
  }

  // The price was deleted in the Rekaz dashboard while an event still points at
  // it. Reported as a conflict rather than validation: the visitor did nothing
  // wrong and there is no field for them to correct.
  return err(
    errors.conflict("Tickets for this event are not available right now.")
  );
}
