import "server-only";

import { errors, type AppError } from "../core/errors";
import { log } from "../core/logger";
import { err, ok, type Result } from "../core/result";
import { rekazRequest } from "./client";
import { REKAZ_PAGE_MAX } from "./reservations";
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

/**
 * How long a memoised catalog read is reused before Rekaz is asked again.
 *
 * 🔴 Sixty seconds, and the number is a product decision rather than a
 * performance knob. `client.ts` sends `cache: "no-store"` and nothing sits in
 * front of it, so a visitor who opens a booking page, changes the duration twice
 * and submits paid FOUR sequential full-catalog downloads of an endpoint
 * measured between 1.2s and 10.8s. The data behind them changes about monthly.
 *
 * A minute is short enough that a price edited in the Rekaz dashboard is live on
 * the site before the person who edited it can walk back to a screen and check.
 */
const CATALOG_TTL_MS = 60_000;

/**
 * One memoised catalog read.
 *
 * 🔴 A plain module-level object, NOT `unstable_cache`. `server/` may not import
 * anything under `next/`; `eslint.config.mjs` enforces it, and that boundary is
 * what keeps this folder liftable out of Next later. The cost is honest and
 * worth stating: the memo is per-instance, so on serverless each warm function
 * keeps its own copy and the hit rate is whatever traffic one instance sees.
 * That is still the whole of the win here, because the case being fixed is ONE
 * visitor making four sequential reads inside a single booking journey, and
 * those land on the same instance.
 */
type CatalogMemo<T> = {
  value: T | null;
  expiresAt: number;
  /** The download currently in progress, shared by everyone who asks for it. */
  inFlight: Promise<Result<T, AppError>> | null;
};

function newMemo<T>(): CatalogMemo<T> {
  return { value: null, expiresAt: 0, inFlight: null };
}

/**
 * Serves `load()` from the memo, or starts exactly one download.
 *
 * Two properties beyond the TTL, neither of which the TTL alone would give:
 *
 * 1. **Single flight.** Callers arriving during a cold 10.8s `/products` call
 *    share ONE download instead of starting several against an upstream that
 *    degrades sharply under concurrency (six parallel calls once hung an
 *    endpoint past two minutes that answered in 1.5s on its own). Without this
 *    the memo does nothing at all in the only case anybody notices, which is a
 *    cold cache under a burst. The sharing applies to a LIVE read too: two
 *    callers who both refuse the stored copy still only cost Rekaz one request.
 * 2. 🔴 **Failures are never stored.** Caching an `upstream_unavailable` for a
 *    minute would turn one Rekaz blip into sixty seconds of "booking
 *    unavailable" on every space page with the upstream already healthy again.
 *    The in-flight promise IS still shared for a failing call, because that is
 *    what stops a burst stampeding a struggling API; only the successful value
 *    is retained.
 *
 * `useStored: false` skips the stored value but still joins an in-flight
 * download: the download it would otherwise start is, by definition, no newer
 * than the one already running.
 *
 * ⚠️ A live read still WARMS the memo, which is deliberate and safe. Writing a
 * fresh value down carries no risk at all; the only thing that ever needs a
 * decision is whether a caller may READ one back. So the billing path, which
 * always asks Rekaz, leaves the catalog warm for whatever read path asks next.
 */
async function memoised<T>(
  memo: CatalogMemo<T>,
  load: () => Promise<Result<T, AppError>>,
  useStored: boolean
): Promise<Result<T, AppError>> {
  const cached = memo.value;
  if (useStored && cached !== null && Date.now() < memo.expiresAt) {
    return ok(cached);
  }

  if (memo.inFlight) return memo.inFlight;

  const request = (async () => {
    const result = await load();
    if (result.ok) {
      memo.value = result.value;
      memo.expiresAt = Date.now() + CATALOG_TTL_MS;
    }
    return result;
  })();

  memo.inFlight = request;
  try {
    return await request;
  } finally {
    // Cleared whatever the outcome, and only by the call that owns it, so a
    // failed download can never wedge every later request onto one settled
    // promise.
    if (memo.inFlight === request) memo.inFlight = null;
  }
}

/**
 * How a catalog read treats the memo.
 *
 * 🔴 **The default is LIVE, and the cache is what you have to ask for.** That
 * asymmetry is the whole safety property of this module, so it is worth being
 * explicit about why it is not the other way round.
 *
 * `listProducts` is not a read-path convenience. It is where BOTH billing paths
 * resolve the exact price id posted to Rekaz (`server/services/booking.ts` and
 * `server/services/event-tickets.ts`), and a price id ROTATES the moment anyone
 * edits an amount in the Rekaz dashboard. Bill against a rotated id and Rekaz
 * answers 400, which we map to the generic `internal` copy at the final click of
 * a purchase. The same read also carries `isOutOfStock`, so a stale copy keeps
 * selling a product operations has just pulled.
 *
 * Cache-by-default would make that failure the consequence of FORGETTING a
 * parameter in a file somebody edits a year from now, and forgetting is the one
 * thing you can count on. Live-by-default makes forgetting cost a slow page
 * instead of a wrong charge, which is the trade this codebase should always
 * take. Availability and the charged price stay live, structurally, rather than
 * by everyone remembering.
 */
export type CatalogReadOptions = {
  /**
   * Serve from the 60s memo when one is warm.
   *
   * 🔴 READ PATHS ONLY. Never pass this from anything that is about to bill, to
   * check stock, or to decide what a customer may buy right now.
   */
  cached?: boolean;
  /**
   * Ask Rekaz now, ignoring anything stored.
   *
   * The default already does this, so it is a no-op. It exists because a caller
   * on the money path that says its requirement out loud should not have to know
   * which way the default happens to point today, and because a reader of
   * `listProducts({ fresh: true })` at a billing call site learns something
   * true. Set together with `cached`, this wins.
   */
  fresh?: boolean;
};

function wantsStored(options: CatalogReadOptions): boolean {
  return (options.cached ?? false) && !(options.fresh ?? false);
}

const productsMemo = newMemo<RekazPage<RekazProduct>>();

/**
 * The tenant's branches.
 *
 * ⚠️ `/branches` returns a BARE ARRAY: no envelope, no `totalCount`, and so no
 * way for it to self-report a short page. There is nothing to compare `length`
 * against, which is why the completeness check on `/products` below exists and
 * cannot exist here. MAZJ has one branch, so a page size would be answering a
 * question the endpoint does not ask.
 *
 * 🔴 Deliberately NOT memoised. Its only caller is the fallback in
 * `resolveBranchId`, which runs on the write path and decides which branch takes
 * the money. A cache under that is a cache under a billing decision, for a value
 * MAZJ changes when it opens a second location, i.e. all cost and no win.
 */
export function listBranches(): Promise<Result<RekazBranch[], AppError>> {
  return rekazRequest<RekazBranch[]>({ path: "/branches" });
}

/**
 * ⚠️ Returns `{items}` with NO `totalCount`, unlike every other collection.
 * Verified live: assuming the paginated envelope here yields `undefined`.
 *
 * Left exactly as it was, including the absent page size. Its only caller is the
 * live drift alarm in `test/rekaz.integration.test.ts`, so sending this endpoint
 * a parameter it has never been sent would be buying upstream risk on a
 * production API for a call no customer makes.
 */
export function listProviders(): Promise<
  Result<RekazList<RekazProvider>, AppError>
> {
  return rekazRequest<RekazList<RekazProvider>>({ path: "/providers" });
}

/**
 * The whole product catalog.
 *
 * 🔴 LIVE unless the caller passes `{ cached: true }`. See `CatalogReadOptions`
 * for why that default points the way it does: this is the call that resolves
 * the price id we are about to charge, and it also carries `isOutOfStock`.
 *
 * 🔴 No retry and no backoff, here or anywhere else in `rekaz/`. Rekaz has no
 * idempotency, so a retried POST is a second real booking and a second real
 * invoice, and a retry helper written for a GET is one refactor away from
 * wrapping a POST.
 */
export async function listProducts(
  options: CatalogReadOptions = {}
): Promise<Result<RekazPage<RekazProduct>, AppError>> {
  const result = await memoised(
    productsMemo,
    () =>
      rekazRequest<RekazPage<RekazProduct>>({
        path: "/products",
        // 🔴 An explicit page size, because this call used to send none and took
        // whatever default Rekaz felt like returning as "the whole catalog".
        // With four products that is right; it stops being right silently, and
        // the symptom is a space's booking page answering "booking unavailable"
        // while the product sits plainly in the Rekaz dashboard.
        query: { maxResultCount: REKAZ_PAGE_MAX },
        // ⚠️ A longer ceiling than the client's 10s default, and ONLY here.
        // `/products` was measured answering between 1.2s and 10.8s, i.e. the
        // default sits BELOW the slowest response actually observed, so a cold
        // read can time out against a perfectly healthy upstream and take every
        // space's booking page down with it. A ceiling that fails a purchase
        // which would have succeeded is a self-inflicted outage.
        //
        // This applies on the submit path too, because that is where the price
        // is resolved, and that is accepted rather than overlooked: the risk a
        // longer wait creates is a second tap on submit, and that is covered by
        // the idempotency key `server/services/booking.ts` holds around the
        // whole attempt, which covers it identically at 2s and at 20s.
        timeoutMs: 20_000,
      }),
    wantsStored(options)
  );

  if (result.ok) {
    const returned = result.value.items?.length ?? 0;
    if (returned < result.value.totalCount) {
      // Logged at ERROR rather than warn: this is a page of the catalog we
      // cannot see, and whichever products fell off it are unbookable on this
      // site with no other symptom anywhere. The fix is paging, deliberately not
      // written on spec for a tenant that sells four things.
      log.error("rekaz.catalog.truncated", {
        returned,
        totalCount: result.value.totalCount,
        pageSize: REKAZ_PAGE_MAX,
      });
    }
  }

  return result;
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
 * The branch to bill a product against.
 *
 * ⚠️ Falls back to the tenant's only branch when the product names none. The
 * events hall carries an empty `branchIds` while the other three name the
 * branch, so reading it straight off the product would break the single most
 * valuable product in the catalog.
 *
 * 🔴 Lives here rather than beside its first caller because it now has two:
 * room bookings and event tickets. Two copies of "which branch takes the money"
 * is precisely the shape of drift this repo has already paid for elsewhere, and
 * the failure mode is an invoice raised against the wrong branch, which nobody
 * notices until the accounts are reconciled.
 */
export async function resolveBranchId(
  product: RekazProduct
): Promise<Result<string, AppError>> {
  const fromProduct = product.branchIds?.[0];
  if (fromProduct) return ok(fromProduct);

  const branches = await listBranches();
  if (!branches.ok) return branches;

  const only = branches.value[0]?.id;
  if (!only) return err(errors.internal("Rekaz returned no branches"));
  return ok(only);
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
