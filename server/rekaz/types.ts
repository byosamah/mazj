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
export const REKAZ_PRODUCT_TYPE = {
  /** Time-slot booking: meeting room, events hall. `POST /reservations/bulk`. */
  reservation: 0,
  /** Term booking: shared seat, private office. `POST /subscriptions`. */
  subscription: 1,
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
