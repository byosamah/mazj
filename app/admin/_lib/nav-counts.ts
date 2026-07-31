import "server-only";

import { cache } from "react";

import { log } from "@/server/core/logger";
import { supabaseAdmin } from "@/server/supabase/admin";

import type { AdminUser } from "./auth";

/**
 * The numbers the rail carries beside each section, and the ones `/admin`'s
 * index cards print.
 *
 * Three rules, all hard, and each one is a defect this redesign exists to end.
 *
 * 1. 🔴 POSTGRES ONLY. NEVER REKAZ. This runs in the layout, so it runs on every
 *    admin request including the ones that have nothing to do with bookings.
 *    Rekaz `/products` is recorded answering between 1.2s and 10.8s (see
 *    `docs/rekaz-api-findings.md`), and the same API serves mazj.sa's live
 *    checkout. One Rekaz call here makes every route as slow as the worst one,
 *    which is precisely why the dashboard has a 60-second cache and this does
 *    not need one: our own Postgres sits in Frankfurt and so do the functions,
 *    measured at ~39ms per query after the `fra1` pin.
 *
 * 2. 🔴 A FAILED QUERY RETURNS `null`, NEVER `0`, and `null` renders no badge.
 *    A zero that is actually a failure, sitting in the chrome of every page, is
 *    the collapse this whole redesign is against, and it is already live one
 *    directory away: `_lib/events.ts:120-121` turns a failed seat count into
 *    `new Map()`, so every row shows a confident 0. Shipping the same bug into
 *    the nav would put it in the one place nobody would think to check.
 *
 * 3. ZERO IS SUPPRESSED, in `Sidebar`. A permanent "0" beside a section trains
 *    the eye to skip the row it exists to make you notice.
 *
 * 🔴 It also never throws. The shell wraps every protected page, so an
 * exception here is not a missing badge, it is a 500 on the whole admin.
 *
 * 4. 🔴 IT RUNS ONCE PER REQUEST, NOT ONCE PER READER. Since 2026-07-30 two
 *    components want these numbers on the same render: the layout's rail, and
 *    `/admin`'s index cards. React's `cache()` below makes the second call free,
 *    so the pair costs three queries rather than six. The alternative anybody
 *    reaches for first is a second loader for the page, which is a second
 *    definition of "coming up" and "waiting on you", and a badge in the chrome
 *    that disagrees with the card in the content is precisely the collapse rules
 *    2 and 3 exist to prevent.
 */

/**
 * Keys are nav segments, plus one suffixed key for an alarm.
 *
 * `Partial`, so "we do not publish a count for this section" and "the count
 * failed" stay different states: an absent key was never asked for, `null` was
 * asked for and could not be answered.
 */
export type NavCounts = Partial<Record<string, number | null>>;

type CountResponse = { count: number | null; error: { message: string } | null };

/**
 * One count, or `null`.
 *
 * The `try` is not defensive padding: `supabaseAdmin()` calls `env()`, which
 * throws by design when the backend is misconfigured, and that throw happens
 * inside the layout of every admin page.
 */
async function safeCount(
  what: string,
  run: () => PromiseLike<CountResponse>
): Promise<number | null> {
  try {
    const { count, error } = await run();
    if (error) {
      log.warn("admin.nav_count_failed", { what, reason: error.message });
      return null;
    }
    // `count` is `null` when PostgREST answered without a count header. That is
    // an unanswered question, not an empty set, and it takes the same branch.
    return count ?? null;
  } catch (cause) {
    log.warn("admin.nav_count_failed", { what, cause });
    return null;
  }
}

/**
 * 🔴 The unused `_admin` is the compile-time half of the guard, and every loader
 * in `_lib/` carries one. An `AdminUser` can only be obtained from
 * `requireAdmin()`, so a caller that forgot to authorise cannot call this at
 * all. Deleting it as dead code removes the guarantee, not the parameter.
 *
 * 🔴 The argument is ALSO why the cache has to sit on a separate zero-argument
 * function. React's `cache()` keys on the arguments it is called with, by
 * identity for an object, and `requireAdmin()` mints a fresh `AdminUser` per
 * call: the layout's and the page's are two different objects carrying the same
 * two strings, so caching `loadNavCounts` directly would miss every time and
 * silently run the queries twice while looking cached.
 *
 * The name still begins `load`, which is what makes
 * `test/admin-page-guards.test.ts` order it below `await requireAdmin()` on
 * every page that reads it.
 */
export function loadNavCounts(_admin: AdminUser): Promise<NavCounts> {
  return countNavItems();
}

/**
 * The queries, once per request.
 *
 * ⚠️ `cache()`, NOT `unstable_cache()`. This is per-request memoisation and
 * nothing else: it holds no data between requests, so there is no window in
 * which one admin's numbers can be served to the next. That distinction is the
 * whole reason the deleted dashboard loader could not put its own per-admin
 * lookups inside `unstable_cache`.
 */
const countNavItems = cache(async (): Promise<NavCounts> => {
  const nowIso = new Date().toISOString();

  const [events, startups, startupsAlarm] = await Promise.all([
    // Events still ahead of us. Same definition the public site uses (an event
    // leaves "coming up" when its `ends_at` passes, computed at read time), so
    // the badge and `/events` cannot disagree about what is upcoming.
    // Its word is "Coming up", carried by `nav.ts` as `countLabel` and rendered
    // twice: announced after the rail's badge, and printed on `/admin`'s Events
    // card. Change the meaning of this query and you change that word too.
    safeCount("events coming up", () =>
      supabaseAdmin()
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .gte("ends_at", nowIso)
    ),

    // Applications nobody has decided. This is the only number in the admin
    // that means a person outside MAZJ is waiting for an answer.
    // Its word is "Waiting on you", in `nav.ts` as `countLabel`, rendered by the
    // rail and by `/admin`'s Startups card.
    safeCount("startup applications waiting", () =>
      supabaseAdmin()
        .from("startup_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
    ),

    // Decided, and the founder was never told. The decision commits before the
    // email is attempted and a mail failure deliberately does not roll it back
    // (`startup-application.ts:603-617`), so this state is normal, silent, and
    // invisible on the row itself: the application looks answered.
    // Matches `emailDelivered === false` in `_lib/startups.ts`.
    // 🔴 The ONE count with no `countLabel`, because it is not a quantity, it is
    // an alarm, and each surface states it as a full sentence in its own
    // register: the rail announces "N approved or rejected with no email sent",
    // and `/admin` opens a destructive `Notice` naming the founders nobody told.
    // Both render NOTHING on zero. It is the only number here that is allowed to
    // be loud, and habituating anyone to it would cost exactly that.
    safeCount("startup decisions never emailed", () =>
      supabaseAdmin()
        .from("startup_applications")
        .select("id", { count: "exact", head: true })
        .neq("status", "pending")
        .is("decision_email_sent_at", null)
    ),
  ]);

  // 🔴 NO COUNT FOR THE INDEX (`""`), deliberately, and the reason CHANGED on
  // 2026-07-30 while the answer stayed the same.
  //
  // It used to be rule 1: everything that screen reported (free rooms, today's
  // reservations, active subscriptions) lived in Rekaz, and rule 1 forbids
  // calling Rekaz from a loader that runs on every admin request. That screen no
  // longer exists. `/admin` is now an index whose entire content is these three
  // numbers, so a fourth counting the index itself would be a badge whose value
  // is the sum of the two badges under it.
  //
  // The surviving rule is the plainer one: a badge that means nothing, sitting
  // beside two that mean "act", costs more than the empty space it fills.
  return {
    events,
    startups,
    "startups:alarm": startupsAlarm,
  };
});
