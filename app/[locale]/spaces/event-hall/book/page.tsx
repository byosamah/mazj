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
