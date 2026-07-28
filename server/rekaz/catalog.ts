import "server-only";

import type { AppError } from "../core/errors";
import type { Result } from "../core/result";
import { rekazRequest } from "./client";
import {
  REKAZ_PRODUCT_TYPE,
  type RekazBranch,
  type RekazList,
  type RekazPage,
  type RekazProduct,
  type RekazProvider,
} from "./types";

/**
 * The Rekaz catalog: what MAZJ sells, where, and at what price.
 *
 * 🔴 Always fetched, never hardcoded. Every `pricing[].id` in the live catalog
 * was reissued in July 2026 while the products themselves date to 2024, which
 * means **price ids rotate whenever a price is edited in the Rekaz dashboard**.
 * A hardcoded price id is a booking that starts failing the day someone in
 * operations changes a number, with no deploy and no warning. `immutableId` is
 * the stable handle if one ever genuinely needs storing.
 */

export function listBranches(): Promise<Result<RekazBranch[], AppError>> {
  // Note the bare array: `/branches` does NOT use the paginated envelope that
  // `/products` and `/reservations` do.
  return rekazRequest<RekazBranch[]>({ path: "/branches" });
}

/**
 * ⚠️ Returns `{items}` with NO `totalCount`, unlike every other collection.
 * Verified live: assuming the paginated envelope here yields `undefined`.
 */
export function listProviders(): Promise<
  Result<RekazList<RekazProvider>, AppError>
> {
  return rekazRequest<RekazList<RekazProvider>>({ path: "/providers" });
}

export function listProducts(): Promise<
  Result<RekazPage<RekazProduct>, AppError>
> {
  return rekazRequest<RekazPage<RekazProduct>>({ path: "/products" });
}

/**
 * Products bookable as time slots: the meeting room and the events hall.
 *
 * ⚠️ Filtered by `type`, never by `branchIds`. The events hall carries an empty
 * `branchIds` while the other three name the branch, so a branch filter would
 * silently drop the single most valuable product in the catalog.
 */
export function splitByBookingFlow(products: RekazProduct[]): {
  reservations: RekazProduct[];
  subscriptions: RekazProduct[];
} {
  return {
    reservations: products.filter(
      (p) => p.type === REKAZ_PRODUCT_TYPE.reservation
    ),
    subscriptions: products.filter(
      (p) => p.type === REKAZ_PRODUCT_TYPE.subscription
    ),
  };
}

/**
 * The provider ids that represent physical, occupiable rooms.
 *
 * Rekaz models a "provider" as whoever or whatever fulfils a booking. For MAZJ
 * that is a room, so the reservation products' providers are exactly the spaces
 * an occupancy view cares about. Derived from the catalog rather than listed
 * here, so adding a room in Rekaz does not require a deploy.
 */
export function bookableRooms(
  products: RekazProduct[]
): { id: string; name: string }[] {
  const rooms = new Map<string, string>();
  for (const product of splitByBookingFlow(products).reservations) {
    for (const provider of product.productProviders ?? []) {
      rooms.set(provider.id, provider.name);
    }
  }
  return [...rooms].map(([id, name]) => ({ id, name }));
}
