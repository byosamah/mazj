/**
 * Rekaz Merchant Public API response types.
 *
 * Hand-written, because Rekaz publishes no OpenAPI document and ships no SDK.
 * That has a consequence worth stating plainly: **nothing here is enforced by
 * Rekaz.** These types describe what the live API returned on 2026-07-27 and
 * will silently drift the day Rekaz changes a field. The integration tests in
 * `test/rekaz.integration.test.ts` exist to make that drift loud.
 *
 * Only the fields this application actually reads are modelled. Rekaz returns
 * considerably more on most resources; adding a field you do not use creates an
 * obligation to keep it accurate for no benefit.
 *
 * Full observed shapes and the traps live in `docs/rekaz-api-findings.md`.
 */

/** Rekaz's `type` discriminator on a product. Drives which booking flow applies. */
/**
 * The figure a buyer is shown, and therefore the figure MAZJ records.
 *
 * 🔴 IT EXISTS SO THE TWO CANNOT DRIFT. A Rekaz price carries `amount` and
 * `discountedAmount`, and the booking page has always rendered the discounted
 * one when it is set. The booking service separately writes an `amountSnapshot`
 * onto our own `bookings` row so a member of staff can answer "what did I pay"
 * after a dashboard price edit has moved the catalog underneath it.
 *
 * Those were two expressions of the same rule, written in two files, and they
 * agreed only for as long as no price carried a discount. The moment the owner
 * sets `discountedAmount` on a price, the buyer sees one number, is charged that
 * number, and the desk reads a different one off a field documented as "what
 * MAZJ charged". The divergence is triggered by exactly the event this snapshot
 * was built to survive, so the rule now lives in one place and both callers ask
 * it the same question.
 *
 * ⚠️ `|| ` rather than `??` on purpose, and it matches the shipped behaviour:
 * Rekaz sends `discountedAmount` equal to `amount` when nothing is discounted
 * rather than sending null, and a genuine zero is not a price this site sells.
 */
export function chargedAmount(price: RekazPrice): number {
  return price.discountedAmount || price.amount;
}

export const REKAZ_PRODUCT_TYPE = {
  /** Time-slot booking: meeting room, events hall. `POST /reservations/bulk`. */
  reservation: 0,
  /** Term booking: shared seat, private office. `POST /subscriptions`. */
  subscription: 1,
  /**
   * A one-time purchase. Rekaz calls it `Merchandise`, and MAZJ's event tickets
   * are this.
   *
   * 🔴 THERE IS NO WRITE ENDPOINT FOR IT, and that single fact is why the whole
   * event-ticket flow leaves this site. Rekaz publishes POST for reservations,
   * subscriptions, customers and attendances and nothing else, and their own
   * storefront sells merchandise through an add-to-cart flow rather than one
   * call. So a paid event does not transact here: it links to the product's page
   * on the Rekaz storefront. See `./store.ts` and
   * `docs/superpowers/specs/2026-07-30-paid-events-link-out-design.md`.
   */
  merchandise: 2,
} as const;

export type RekazProductType =
  (typeof REKAZ_PRODUCT_TYPE)[keyof typeof REKAZ_PRODUCT_TYPE];

export type RekazBranch = {
  id: string;
  name: string;
  /**
   * 🔴 `nameEn` is byte-identical to `nameAr` for this tenant. Rekaz holds no
   * English content at all. Never render either into the English site; use
   * `messages/en.json`. See `docs/rekaz-api-findings.md`.
   */
  nameAr: string;
  nameEn: string;
  addressUrl: string | null;
};

/**
 * A price's inventory, when the merchant configures one.
 *
 * ⚠️ **Both MAZJ ticket products currently sit on `isUnlimited: true`, so the
 * two quantity fields are null and the meanings below are read off the field
 * NAMES rather than measured.** Nothing here can be verified until somebody sets
 * a real quantity in the Rekaz dashboard. That is why `ticketStock` in
 * `services/event-tickets.ts` leans on `RekazProduct.isOutOfStock`, which is a
 * plain boolean this code has always read, and treats a missing or
 * non-numeric `remainingQuantity` as "say nothing" rather than as zero.
 */
export type RekazStock = {
  availableQuantity: number | null;
  allocatedQuantity: number;
  isUnlimited: boolean;
  remainingQuantity: number | null;
};

export type RekazPrice = {
  /**
   * ⚠️ Rotates when the price is edited in the Rekaz dashboard. Never persist
   * or hardcode it; resolve from `GET /products` at request time.
   */
  id: string;
  /** Stable across edits. The handle to use if one must be stored. */
  immutableId: string;
  order: number;
  name: string;
  /** Minutes. Null on subscription prices, which use `billingPeriod` instead. */
  duration: number | null;
  /** Days. Null on reservation prices. */
  billingPeriod: number | null;
  amount: number;
  discountedAmount: number;
  depositAmount: number;
  hasDeposit: boolean;
  /** Absent on older records, so optional rather than nullable-required. */
  stock?: RekazStock | null;
};

export type RekazCustomField = {
  id: string;
  /** The key to send back in a reservation's `customFields`. */
  name: string;
  /** 🔴 Arabic only. The English label must come from `messages/en.json`. */
  label: string;
  placeholder: string | null;
  isRequired: boolean;
  /** Rekaz's field-type enum. 1 = text, 2 = number, 10 = file. */
  type: number;
};

export type RekazProductProvider = {
  id: string;
  name: string;
  /** Always null for this tenant. Product imagery lives in our repository. */
  image: string | null;
};

export type RekazProduct = {
  id: string;
  name: string;
  nameAr: string;
  nameEn: string;
  description: string | null;
  shortDescription: string | null;
  /** Matches the `BOOKING` paths in `lib/links.ts`. */
  slug: string;
  type: RekazProductType;
  typeString: string;
  amount: number;
  duration: number | null;
  pricing: RekazPrice[];
  customFields: RekazCustomField[] | null;
  productProviders: RekazProductProvider[] | null;
  /** ⚠️ Empty on the events hall while the other three name the branch. */
  branchIds: string[];
  isOutOfStock: boolean;
  maximumQuantityPerOrder: number | null;
};

export type RekazProvider = { id: string; name: string };

/**
 * One bookable window from `GET /reservations/slots`.
 *
 * 🔴 Windows OVERLAP. They slide at 1-hour granularity regardless of the price
 * duration, so a 2-hour price yields 07:00-09:00, 08:00-10:00, 09:00-11:00.
 * They do not tile a day.
 */
export type RekazSlot = {
  /** ISO 8601 UTC. The venue is UTC+3; convert once, at render. */
  from: string;
  to: string;
  availableReservationsCount: number;
  availableProvidersCount: number;
  availableProviderIds: string[];
  /** True when the window has already passed. Always filter these out. */
  isOutDated: boolean;
  isAvailable: boolean;
  amounts: {
    totalPrice: number;
    totalAfterDiscount: number;
    effectiveQuantity: number;
    depositAmount: number | null;
    /** Observed as 0 in every response. Do not display. */
    basePrice: number;
    /** Observed as 0 in every response. Do not display. */
    priceWithTax: number;
  };
  /** Latest end time reachable by chaining contiguous windows. */
  maxConnectedTo: string | null;
};

export type RekazReservation = {
  id: string;
  /** ISO 8601 UTC. */
  startAt: string;
  endAt: string;
  status: string;
  customStatus: string | null;
  customerId: string | null;
  /** ⚠️ Observed empty on some records. Treat as optional in the UI. */
  customerName: string;
  customerMobile: string;
  reservationNumber: number;
  productName: string;
  priceName: string;
  quantity: number;
  providers: { id: string; name: string; isDeleted: boolean }[] | null;
  branchId: string | null;
  branchName: string | null;
  orderPaymentStatusString: string | null;
  reservationTotalAmount: number;
  remainingAmount: number;
  cancellationReason: string | null;
  creationTime: string;
  source: string | null;
};

export type RekazSubscriptionItem = {
  id: string;
  priceId: string;
  name: string;
  quantity: number;
};

export type RekazSubscription = {
  id: string;
  subscriptionCode: string;
  customerId: string | null;
  /** ISO 8601 UTC. */
  startAt: string;
  endAt: string | null;
  status: string;
  isPaused: boolean;
  items: RekazSubscriptionItem[];
  branchId: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  lastInvoiceStatus: string | null;
  creationTime: string;
};

/**
 * The envelope Rekaz wraps paginated collections in.
 *
 * ⚠️ Rekaz uses THREE different collection shapes, and which one you get is not
 * predictable from the endpoint. Verified on the live API:
 *
 *   - `/products`, `/reservations`, `/subscriptions`, `/packages` -> this,
 *     with `totalCount`.
 *   - `/providers` -> `items` only, NO `totalCount`. See `RekazList`.
 *   - `/branches` -> a bare array, no envelope at all.
 *
 * Assuming `totalCount` everywhere yields `undefined` rather than an error,
 * which then renders as "undefined bookings" on a dashboard instead of failing
 * loudly. An integration test pins each shape.
 */
export type RekazPage<T> = {
  totalCount: number;
  items: T[];
};

/** A collection with no total. Currently only `/providers`. */
export type RekazList<T> = {
  items: T[];
};
