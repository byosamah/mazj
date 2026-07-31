import type {Metadata} from "next";

import {pageMetadata} from "@/lib/metadata";

import BookingScreen from "../../_lib/BookingScreen";

/**
 * Booking for event-hall.
 *
 * Three lines of route, because everything real lives in `_lib/BookingScreen`.
 * This file owns the URL and the metadata and nothing else.
 *
 * `force-dynamic`: the page renders live Rekaz prices and availability, so a
 * prerendered copy would show yesterday's catalog to today's buyer.
 *
 * `noindex`: a transactional step, not a landing page. `/spaces/event-hall` is the
 * URL that should rank, and an indexed booking form competes with it for the
 * same query while offering a worse first impression.
 */
export const dynamic = "force-dynamic";

/**
 * ⚠️ Raised from the platform default (10s Hobby, 15s Pro), and THIS is the route
 * the number was chosen on. The other three carry a short form of this note.
 *
 * Route segment config governs the Server ACTIONS dispatched from the route, not
 * only the render, and the render here is the quick part. An events-hall booking
 * chains up to six SEQUENTIAL Rekaz calls (catalog, branches, slot re-check,
 * customer lookup, the write, and a reconciliation read when the write does not
 * answer cleanly) against a tenant measured answering between 1.2 and 10.8
 * seconds. The hall is also the only product whose `branchIds` is empty, so it is
 * the only one that pays for the extra `/branches` call.
 *
 * ⚠️ Say plainly what 60 does NOT buy, because the obvious reading of it is
 * wrong. The Rekaz client times out at 10 seconds per call and gives `/products`
 * 20, so the per-call ceilings on this chain SUM TO ABOUT 70: a run where every
 * call goes to its limit is killed at 60 regardless. This narrows the window in
 * which a booking dies mid-write, it does not close it. What it does buy is
 * every run anywhere near the measured behaviour, against a platform default
 * that the FIRST call on its own can exceed. Sixty is also the ceiling on the
 * Hobby plan, so there is nothing above it to reach for, and shortening the
 * chain is the only real fix left.
 *
 * 🔴 A function killed mid-booking is the one failure the idempotency layer
 * cannot absorb. `markIndeterminate` cannot run in a process that no longer
 * exists, so the `in_progress` row is reclaimed after 90 seconds and the
 * customer's retry books the room a second time. On the hall that is MAZJ's most
 * valuable booking, duplicated. Which is also why 60 must stay UNDER that
 * 90-second reclaim (`STALE_AFTER_SECONDS` in `server/core/idempotency.ts`): a
 * request allowed to outlive its own claim can still be running while a second
 * request is told the key is free, which is two concurrent writes under one key,
 * the precise thing the key exists to prevent.
 */
export const maxDuration = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  return pageMetadata(locale, "Booking", "/spaces/event-hall/book", {
    noindex: true,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  return <BookingScreen locale={locale} space="event-hall" />;
}
