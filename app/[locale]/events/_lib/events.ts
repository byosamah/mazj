import "server-only";

import {listPublishedEvents, getEventBySlug, seatsTakenFor, expireHolds, type EventRecord} from "@/server/db/events";
import {
  eventPhase,
  eventYear,
  formatEventWhen,
  formatEventYear,
  registrationIsOpen,
  seatState,
  type EventPhase,
  type FormattedWhen,
  type SeatState,
} from "@/server/domain/events";
import {log} from "@/server/core/logger";
import {rekazStoreUrl} from "@/server/rekaz/store";
import {chargedAmount} from "@/server/rekaz/types";
import {
  resolveTicketPrice,
  type TicketStock,
} from "@/server/services/event-tickets";
import {posterPublicUrl} from "@/server/storage/event-posters";

/**
 * The `/events` routes' data layer, and a sanctioned crossing into `@/server`.
 *
 * 🔴 It exports PLAIN VIEW MODELS, never a backend module and never a database
 * row. Pages render what is here; nothing above this file knows that Supabase
 * exists. `eslint.config.mjs` permits the import because this is an `app/**\/_lib`
 * folder, and the underscore keeps Next from ever routing it.
 *
 * Everything is already resolved to ONE language by the time it leaves here.
 * That is deliberate: a component receiving `{en, ar}` has to decide, and a
 * component that decides eventually decides wrong on one of the two locales.
 */

export type EventView = {
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  host: string | null;
  location: string | null;
  series: string | null;
  edition: string | null;
  when: FormattedWhen;
  /** Raw ISO instants, for `<time datetime>` and `Event` structured data. */
  startsAt: string;
  endsAt: string;
  /** Grouping KEY for the archive. Western digits in both locales. */
  year: string;
  /** The same year as a LABEL: `2023` in English, `٢٠٢٣` in Arabic. */
  yearLabel: string;
  posterUrl: string | null;
  phase: EventPhase;
  seats: SeatState;
  /**
   * The Rekaz price handle, or null for a free event.
   *
   * ⚠️ Not a secret (it is a catalog identifier, and the admin picks it from a
   * dropdown), but it is the ONLY thing that resolves to a live price, so it
   * stays inside server components. `EventRegistration` never receives it: the
   * browser names an event by slug and the server decides what that costs.
   */
  ticketPriceId: string | null;
  /**
   * ⚠️ DISPLAY-ONLY SNAPSHOT, taken when the admin chose the price. Correct for
   * an admin list; WRONG to show a buyer, because Rekaz rotates price ids and
   * amounts independently of this site. Public pages use `loadTicketOffer`.
   */
  ticketAmount: number | null;
  isTicketed: boolean;
  registrationOpen: boolean;
  /** Whether `/events/<slug>` is worth linking to. See `hasDetailPage`. */
  hasDetail: boolean;
};

export type EventsPageData = {
  upcoming: EventView[];
  past: EventView[];
};

/**
 * Does this event deserve a page of its own?
 *
 * 🔴 Two different failures are being avoided at once, in opposite directions.
 *
 * An UPCOMING event always gets one, whatever it contains, because that page is
 * where registration happens. Gating it on content would produce an event with
 * a register button pointing at a 404.
 *
 * A PAST event gets one only when there is something to read. The 41 imported
 * historical events carry a title, a date and a one-line subtitle and nothing
 * else, and 41 near-empty pages is thin content at a scale Google notices,
 * pointed at from the one page on this route that is actually good. They render
 * as archive rows, exactly as they do today.
 */
function hasDetailPage(record: EventRecord, phase: EventPhase): boolean {
  if (phase !== "past") return true;
  return Boolean(
    record.description.en || record.description.ar || record.posterPath
  );
}

/**
 * Picks one language.
 *
 * 🔴 NO CROSS-LANGUAGE FALLBACK. Returning the Arabic description on the
 * English page is precisely the failure the whole i18n rule in `CLAUDE.md`
 * exists to prevent, and it would arrive silently, as content rather than an
 * error. Absent is rendered as absent.
 */
function pick(
  value: {en: string | null; ar: string | null},
  locale: string
): string | null {
  return locale === "ar" ? value.ar : value.en;
}

function toView(
  record: EventRecord,
  locale: string,
  seatsTaken: number,
  now: Date
): EventView | null {
  const title = pick(record.title, locale);
  const summary = pick(record.summary, locale);

  // A published event is guaranteed both by `events_published_is_bilingual`, so
  // reaching here means somebody wrote around the constraint by hand. Dropping
  // the event is the honest response: a card with a blank heading is worse than
  // one fewer card, and it would be blamed on the layout for a week.
  if (!title || !summary) return null;

  const phase = eventPhase(record, now);

  return {
    slug: record.slug,
    title,
    summary,
    description: pick(record.description, locale),
    host: pick(record.host, locale),
    location: pick(record.location, locale),
    series: record.series,
    edition: record.edition,
    when: formatEventWhen(record, locale),
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    year: eventYear(record),
    yearLabel: formatEventYear(record, locale),
    posterUrl: posterPublicUrl(record.posterPath),
    phase,
    seats: seatState(record.capacity, seatsTaken),
    ticketPriceId: record.rekazPriceImmutableId,
    ticketAmount: record.ticketAmount,
    isTicketed: record.rekazPriceImmutableId !== null,
    registrationOpen: registrationIsOpen(record, now),
    hasDetail: hasDetailPage(record, phase),
  };
}

/**
 * Everything the `/events` list renders.
 *
 * 🔴 ONE clock, and one query. The database is asked for every published event
 * and the upcoming/past split happens here, against a single `now`. Asking it
 * twice ("where ends_at > now" then "where ends_at <= now") uses two different
 * instants, and an event ending in the milliseconds between them lands in both
 * lists or in neither.
 *
 * Uncached, deliberately. Two round trips to a database 39 ms away costs less
 * than a stale seat count is worth, and "4 seats left" that is a minute old is
 * the one number on this page nobody forgives being wrong. If `/events` ever
 * becomes a traffic problem, cache the EVENT list and leave the counts live.
 */
export async function loadEventsPage(locale: string): Promise<EventsPageData | null> {
  const events = await listPublishedEvents();
  if (!events.ok) return null;

  const now = new Date();

  // Counts are only needed where a seat can still be taken. The archive is 41
  // rows and growing, and none of them has a capacity worth reporting.
  const upcomingIds = events.value
    .filter((e) => eventPhase(e, now) !== "past" && e.capacity !== null)
    .map((e) => e.id);

  const counts = await seatsTakenFor(upcomingIds);
  const taken = counts.ok ? counts.value : new Map<string, number>();

  const views = events.value
    .map((record) => toView(record, locale, taken.get(record.id) ?? 0, now))
    .filter((v): v is EventView => v !== null);

  return {
    // Soonest first. A visitor asking "is anything on?" wants the next thing,
    // not the furthest one.
    upcoming: views
      .filter((v) => v.phase !== "past")
      .sort((a, b) => a.when.machine.localeCompare(b.when.machine)),
    // Newest first, already ordered by the query.
    past: views.filter((v) => v.phase === "past"),
  };
}

/**
 * One event, for its own page.
 *
 * Returns `null` for anything that should 404: an unknown slug, a draft, a
 * cancelled event, and a past event with nothing on it (which never had a page
 * to begin with, so a link to one would be a link nobody published).
 */
export async function loadEvent(
  slug: string,
  locale: string
): Promise<EventView | null> {
  const found = await getEventBySlug(slug);
  if (!found.ok || !found.value) return null;

  const record = found.value;
  if (record.status !== "published") return null;

  // A read is a fine moment to let go of seats nobody paid for. Cheap (a
  // partial index serves it exactly), idempotent, and it means the count on
  // this page is honest even for an event nobody is currently registering for.
  // Failure is ignored on purpose: a stale hold makes the page pessimistic,
  // never wrong, and refusing to render an event because a cleanup failed would
  // be the worse trade.
  await expireHolds(record.id);

  const counts = await seatsTakenFor([record.id]);
  const taken = counts.ok ? (counts.value.get(record.id) ?? 0) : 0;

  const view = toView(record, locale, taken, new Date());
  if (!view || !view.hasDetail) return null;

  return view;
}

export type TicketOffer = {
  /** The live figure, in SAR. */
  amount: number;
  /** The product's own page on the Rekaz storefront, absolute. */
  storeUrl: string;
  /**
   * How many are left, straight from Rekaz.
   *
   * 🔴 This is the ONLY inventory signal a paid event has. Our own
   * `event_seats_taken` counts rows in `event_registrations`, and a paid event
   * writes none, so `EventView.seats` is meaningless for one and the page must
   * not read it. A ticketed event with a capacity of 30 and zero sign-ups would
   * otherwise cheerfully report thirty seats free forever.
   */
  stock: TicketStock;
};

/**
 * What a ticketed event costs, and where it is actually bought.
 *
 * 🔴 The amount is NOT `EventView.ticketAmount`, which is a snapshot taken when
 * the admin picked the price and exists only so the admin list can show a figure
 * without a Rekaz round trip. Displaying a stored price while the storefront
 * charges a live one is the exact bug `TONE.md` §6 forbids ("never hardcode a
 * price in copy"): somebody edits the amount in the Rekaz dashboard and this
 * site advertises the old one until a deploy, which is a price dispute waiting
 * to happen.
 *
 * 🔴 The two travel TOGETHER because they come from the same lookup and must
 * describe the same product. Resolving the price here and building the URL
 * somewhere else from a slug held elsewhere is how a page ends up quoting one
 * product's price over another product's link.
 *
 * Returns `null` when Rekaz is unreachable, the price has been deleted, or the
 * product is a type with no storefront path. The page then says so plainly
 * rather than guessing, which is the same shape `/spaces/<space>/book` already
 * uses: an honest "not available right now" beats a button that fails at the
 * last click.
 *
 * ⚠️ Costs a live Rekaz call, which this tenant answers in anywhere from 1.2s
 * to 10.8s. Only ticketed events pay it. Free events, which are most of them,
 * never touch Rekaz at all.
 */
export async function loadTicketOffer(
  priceImmutableId: string,
  locale: string
): Promise<TicketOffer | null> {
  const ticket = await resolveTicketPrice(priceImmutableId);
  if (!ticket.ok) return null;

  const storeUrl = rekazStoreUrl(ticket.value.product, locale);
  if (!storeUrl) return null;

  // 🔴 `chargedAmount`, NOT `price.amount`. This figure is printed beside a
  // button that hands the reader to a storefront MAZJ does not control, so it is
  // the last number they see before somebody else bills them. `chargedAmount`
  // prefers `discountedAmount`, which is what Rekaz actually charges; reading
  // `amount` would advertise 50 while the store takes 40 the moment the owner
  // sets a discount, on the one page whose whole job is stating the price.
  return {
    amount: chargedAmount(ticket.value.price),
    storeUrl,
    stock: ticket.value.stock,
  };
}

/**
 * Slugs that belong in the sitemap.
 *
 * Same rule as `hasDetail`, because a sitemap entry for a page that renders a
 * 404 is a crawl error MAZJ reported to Google itself.
 */
export async function listIndexableEventSlugs(): Promise<
  {slug: string; lastModified: Date}[]
> {
  const events = await listPublishedEvents();

  if (!events.ok) {
    // 🔴 SAY SO. An empty list here is a silently valid sitemap that has quietly
    // dropped every event URL, and nothing downstream can tell it apart from a
    // site with no events. Observed for real: a build without `IP_TRUST_PROXY`
    // makes `env()` throw, the Supabase client with it, and the sitemap shipped
    // 22 URLs instead of 26 with no error anywhere.
    //
    // Still `[]` rather than a throw: failing a deploy because the database
    // blinked is worse than a sitemap that is briefly short, and `revalidate`
    // repairs it within the hour. But it is no longer invisible.
    log.error("sitemap.events_unavailable", {reason: events.error.code});
    return [];
  }

  const now = new Date();
  return events.value
    .filter((record) => hasDetailPage(record, eventPhase(record, now)))
    .map((record) => ({
      slug: record.slug,
      lastModified: new Date(record.createdAt),
    }));
}
