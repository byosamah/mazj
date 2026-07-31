import type {Metadata} from "next";

import {pageMetadata} from "@/lib/metadata";

import BookingScreen from "../../_lib/BookingScreen";

/**
 * Booking for meeting-room.
 *
 * Three lines of route, because everything real lives in `_lib/BookingScreen`.
 * This file owns the URL and the metadata and nothing else.
 *
 * `force-dynamic`: the page renders live Rekaz prices and availability, so a
 * prerendered copy would show yesterday's catalog to today's buyer.
 *
 * `noindex`: a transactional step, not a landing page. `/spaces/meeting-room` is the
 * URL that should rank, and an indexed booking form competes with it for the
 * same query while offering a worse first impression.
 */
export const dynamic = "force-dynamic";

/**
 * ⚠️ Raised from the platform default (10s Hobby, 15s Pro). Route segment config
 * governs the Server ACTIONS dispatched from the route, not only the render, and
 * the render here is the quick part: the booking action chains several sequential
 * Rekaz calls against a tenant measured answering between 1.2 and 10.8 seconds.
 * Sixty buys that chain, it does not buy comfort: the per-call ceilings still sum
 * past it, so a run where every call goes to its limit is killed anyway, and 60
 * is the maximum on the Hobby plan so there is nothing above it to reach for.
 *
 * 🔴 It must stay UNDER the 90-second `STALE_AFTER_SECONDS` in
 * `server/core/idempotency.ts`. A request allowed to outlive its own claim can
 * still be running while a second request is told the key is free, which is two
 * concurrent writes under one key: the precise thing the key exists to prevent.
 * The full reasoning, including what a kill mid-write costs a customer, is on
 * the event-hall route, which is the slowest of the four and the one this number
 * was chosen for.
 */
export const maxDuration = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  return pageMetadata(locale, "Booking", "/spaces/meeting-room/book", {
    noindex: true,
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  return <BookingScreen locale={locale} space="meeting-room" />;
}
