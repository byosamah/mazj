import "server-only";

import type { AppError } from "../core/errors";
import { log } from "../core/logger";
import { ok, type Result } from "../core/result";
import { rekazRequest } from "./client";
import { REKAZ_PAGE_MAX } from "./reservations";
import type { RekazPage, RekazSubscription } from "./types";

/**
 * Subscriptions: the shared seat and the private office.
 *
 * ⚠️ `GET /subscriptions` returns recurring subscriptions ONLY. Prepaid usage
 * bundles are a separate resource at `GET /packages`, which currently holds
 * zero rows for this tenant. Counting "members" from this endpoint alone is
 * correct today and would quietly undercount the day MAZJ sells a package.
 */

/**
 * 🔴 **`customerId` is the one filter this endpoint is known to honour** (98
 * rows to 1, measured 2026-07-27). Everything else lives in `unverifiedFilters`
 * below, because a parameter that reads as an ordinary filter and does nothing
 * is exactly what cost a session an afternoon on `GET /reservations`.
 */
export type ListSubscriptionsOptions = {
  /** Verified to filter. The handle to use when you know the customer. */
  customerId?: string;
  skipCount?: number;
  maxResultCount?: number;
  /**
   * Parameters that are sent and must not be relied on.
   *
   * 🔴 `customerMobile` is MEASURED NOT TO WORK here: 101 rows with it and 101
   * without, on 2026-07-28. That is worth stating twice over, because the same
   * parameter name on `GET /reservations` genuinely does filter. The two
   * resources disagree about which of their own filters they implement, so
   * "it works over there" is not evidence about this one.
   *
   * The remaining four have never been probed against the live tenant. Untested
   * is not the same as broken, but it is not something a caller may build on
   * either: measure one before treating it as a filter, and move it up into
   * `ListSubscriptionsOptions` in the same edit that records the measurement.
   */
  unverifiedFilters?: UnverifiedSubscriptionFilters;
};

/** @see ListSubscriptionsOptions.unverifiedFilters. */
export type UnverifiedSubscriptionFilters = {
  /** 🔴 Measured 2026-07-28 NOT to filter. Sent anyway; changes nothing. */
  customerMobile?: string;
  /** ISO 8601. Never probed. */
  startAtMin?: string;
  /** ISO 8601. Never probed. */
  startAtMax?: string;
  /** Never probed. */
  statuses?: string[];
  /** Never probed. */
  branchId?: string;
};

export function listSubscriptions(
  options: ListSubscriptionsOptions = {}
): Promise<Result<RekazPage<RekazSubscription>, AppError>> {
  const { unverifiedFilters = {}, ...rest } = options;
  const { statuses, ...alsoUnverified } = unverifiedFilters;
  return rekazRequest<RekazPage<RekazSubscription>>({
    path: "/subscriptions",
    query: {
      maxResultCount: REKAZ_PAGE_MAX,
      ...rest,
      ...alsoUnverified,
      ...(statuses?.length ? { statuses: statuses.join(",") } : {}),
    },
  });
}

/** Enough pages for a tenant an order of magnitude larger than today's. */
const MAX_PAGES = 10;

/**
 * Every subscription, across pages.
 *
 * 🔴 A single `listSubscriptions()` call returns at most 100 rows, and this
 * tenant already holds **98**. Two more sign-ups and any count derived from one
 * page silently starts undercounting: the dashboard's "Active" figure and its
 * expiring-soon list would simply omit whoever fell off the end, with no error
 * and no visible gap. A wrong number presented confidently is worse than a
 * missing one, and this one is a renewal list somebody acts on.
 *
 * Paged SEQUENTIALLY. Rekaz degrades badly under concurrent requests (six
 * parallel calls made an endpoint hang past two minutes that answered in 1.5s
 * on its own), and that same API serves mazj.sa's live checkout.
 */
export async function fetchAllSubscriptions(): Promise<
  Result<{ items: RekazSubscription[]; totalCount: number }, AppError>
> {
  const first = await listSubscriptions({ skipCount: 0 });
  if (!first.ok) return first;

  const { totalCount } = first.value;
  const items = [...first.value.items];

  for (let page = 1; page < MAX_PAGES; page++) {
    if (items.length >= totalCount) break;

    const next = await listSubscriptions({ skipCount: page * REKAZ_PAGE_MAX });
    if (!next.ok) {
      // Partial beats nothing: page one holds enough to be useful, and the
      // dashboard says how fresh it is. But say so, because a silently short
      // list is the exact failure this function exists to prevent.
      log.warn("rekaz.subscriptions.partial", {
        collected: items.length,
        totalCount,
        reason: next.error.code,
      });
      break;
    }

    if (next.value.items.length === 0) break;
    items.push(...next.value.items);
  }

  if (items.length < totalCount) {
    log.warn("rekaz.subscriptions.truncated", {
      collected: items.length,
      totalCount,
    });
  }

  return ok({ items, totalCount });
}

/**
 * Rekaz's subscription status strings, as observed on the live tenant.
 *
 * Compared case-insensitively at the call site, because this is an undocumented
 * string field on an API with no schema and no SDK. A status that arrives as
 * `active` instead of `Active` should not silently empty the dashboard.
 */
export const SUBSCRIPTION_STATUS = {
  active: "Active",
  pending: "Pending",
  expired: "Expired",
  cancelled: "Cancelled",
} as const;

export function isActive(subscription: RekazSubscription): boolean {
  return subscription.status?.toLowerCase() === "active";
}

/**
 * Subscriptions ending within `days`, soonest first.
 *
 * The churn signal: these are the people whose membership lapses next, and the
 * only reason a coworking operator opens an ops dashboard on a Sunday morning.
 *
 * Already-ended subscriptions are excluded. A renewal prompt for something that
 * expired three weeks ago is noise, and noise is how a dashboard stops being
 * read.
 */
export function expiringWithin(
  subscriptions: RekazSubscription[],
  days: number,
  now: Date = new Date()
): RekazSubscription[] {
  const horizon = now.getTime() + days * 24 * 60 * 60 * 1000;
  return subscriptions
    .filter((s) => {
      if (!isActive(s) || !s.endAt) return false;
      const endsAt = new Date(s.endAt).getTime();
      return Number.isFinite(endsAt) && endsAt >= now.getTime() && endsAt <= horizon;
    })
    .sort((a, b) => Date.parse(a.endAt ?? "") - Date.parse(b.endAt ?? ""));
}
