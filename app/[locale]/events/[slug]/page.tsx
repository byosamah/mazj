import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {getTranslations, setRequestLocale} from "next-intl/server";

import {Link} from "@/i18n/navigation";
import CtaButton from "@/components/CtaButton";
import JsonLd from "@/components/JsonLd";
import PageIntro from "@/components/PageIntro";
import Reveal from "@/components/Reveal";
import WordReveal from "@/components/WordReveal";
import EventRegistration from "@/components/events/EventRegistration";
import {ogImage} from "@/lib/metadata";
import {eventSchema} from "@/lib/schema";

import {
  loadEvent,
  loadTicketOffer,
  type EventView,
  type TicketOffer,
} from "../_lib/events";

/**
 * One event, on its own URL.
 *
 * This is the page that makes an event shareable: a link that can go in an
 * Instagram bio and open on something that explains itself and takes a booking,
 * rather than a card buried on a list.
 *
 * `force-dynamic` because the seat count is on it. A cached copy telling
 * somebody there are four seats left when the last one went ninety seconds ago
 * is the one number on this route nobody forgives being wrong. The atomic claim
 * in `public.event_claim_seat` is what actually prevents overselling, but a page
 * that lies before it refuses is still a page that lied.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string; slug: string}>;
}): Promise<Metadata> {
  const {locale, slug} = await params;
  const event = await loadEvent(slug, locale);

  // Nothing to describe. `notFound()` in the page below produces the branded
  // 404; returning bare metadata here just avoids throwing twice.
  if (!event) return {};

  const meta = await getTranslations({locale, namespace: "Meta"});
  const title = `${event.title} | ${meta("siteName")}`;
  const path = `/events/${slug}`;
  const isAr = locale === "ar";

  // The poster IS the share card when there is one: an event's own artwork
  // outperforms the generic site card everywhere these get pasted. Falls back
  // to the locale card only because a link with no image at all renders as a
  // blank grey rectangle in WhatsApp.
  const image = event.posterUrl
    ? {url: event.posterUrl, alt: event.title}
    : ogImage(locale);

  return {
    title,
    description: event.summary,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: {en: `/en${path}`, ar: `/ar${path}`, "x-default": `/en${path}`},
    },
    openGraph: {
      type: "article",
      siteName: meta("siteName"),
      title,
      description: event.summary,
      url: `/${locale}${path}`,
      locale: isAr ? "ar_SA" : "en_US",
      alternateLocale: isAr ? "en_US" : "ar_SA",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: event.summary,
      images: [image.url],
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{locale: string; slug: string}>;
}) {
  const {locale, slug} = await params;
  setRequestLocale(locale);

  const event = await loadEvent(slug, locale);
  if (!event) notFound();

  const t = await getTranslations({locale, namespace: "EventDetail"});

  // Only a ticketed event pays for a Rekaz round trip, and only when somebody
  // could still buy one. A sold-out or finished event does not need a price,
  // and this tenant answers in anywhere from 1.2s to 10.8s, so skipping the
  // call is the difference between a fast archive page and a slow one.
  const canStillRegister = event.registrationOpen && event.seats.kind !== "full";
  const ticket =
    event.ticketPriceId && canStillRegister
      ? await loadTicketOffer(event.ticketPriceId, locale)
      : null;

  const location = event.location ?? t("defaultLocation");

  return (
    <main id="content" tabIndex={-1} className="w-full overflow-x-hidden">
      {/* 🔴 Structured data for a FUTURE event only. A past event earns no rich
          result, and marking one up is a manual-action surface for no gain.
          See the note at the top of `lib/schema.ts`. */}
      {event.phase === "upcoming" && (
        <JsonLd
          data={eventSchema({
            locale,
            name: event.title,
            description: event.summary,
            // The real instants, not the formatted string. Google parses these
            // as ISO 8601 and a localised date would simply be dropped.
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            path: `/events/${slug}`,
            image: event.posterUrl,
            performer: event.host,
            // 🔴 Was never passed, so every event claimed to be at MAZJ no
            // matter what the operator typed into `/admin` and no matter what
            // this page printed a few hundred pixels below. `null` here means
            // "at MAZJ", which is what the field means in the database.
            location: event.location,
            // 🔴 `url` is the STOREFRONT, not this page. An Offer's url is
            // where the offer is transacted, and since 2026-07-30 that is the
            // product's page on the Rekaz store; this page only describes it.
            // The price stays the live figure being displayed, never the
            // stored snapshot.
            offer: ticket
              ? {price: ticket.amount, url: ticket.storeUrl}
              : null,
          })}
        />
      )}

      <PageIntro
        variant="hero"
        // The date leads. On an event page it is the single fact a reader is
        // looking for, and the eyebrow slot is where every other route on the
        // site puts its orienting label.
        eyebrow={[event.when.weekday, event.when.date].filter(Boolean).join(" · ")}
        title={event.title}
        intro={event.summary}
        image={event.posterUrl ?? undefined}
      />

      <section className="relative w-full bg-beige px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid-overlay" aria-hidden="true" />

        <div className="relative z-[2] mx-auto flex w-full max-w-[1400px] flex-col gap-16">
          <Reveal>
            <Link
              href="/events"
              className="eyebrow text-12 text-muted underline-offset-4 hover:underline [transition:opacity_200ms,transform_120ms] active:scale-[0.96]"
            >
              {t("back")}
            </Link>
          </Reveal>

          <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1fr_0.85fr] lg:gap-20">
            <div className="flex flex-col gap-12">
              <div className="flex flex-col gap-6">
                <Facts
                  event={event}
                  location={location}
                  ticket={ticket}
                  locale={locale}
                />

                {/* Only for something that has not happened yet. A calendar
                    file for last year's workshop is a download that makes the
                    reader wonder what it was for.

                    A plain <a>, not the locale-aware `Link`: this is a file
                    download rather than a route, and client-side navigation to
                    it would try to render a calendar as a page. */}
                {event.phase === "upcoming" && (
                  <a
                    href={`/${locale}/events/${slug}/ics`}
                    className="eyebrow self-start text-12 text-orange underline-offset-4 hover:underline [transition:opacity_200ms,transform_120ms] active:scale-[0.96]"
                  >
                    {t("addToCalendar")}
                  </a>
                )}
              </div>

              {event.description && (
                <Reveal className="flex flex-col gap-5 border-t border-black/15 pt-6">
                  <p className="eyebrow text-12 text-muted">{t("aboutTitle")}</p>
                  {/* `whitespace-pre-line` so an admin's paragraph breaks
                      survive. The value is plain text from a textarea and React
                      escapes it, so there is no markup path in here. */}
                  <p className="max-w-[62ch] whitespace-pre-line text-pretty text-15 leading-relaxed text-black/75 lg:text-16">
                    {event.description}
                  </p>
                </Reveal>
              )}
            </div>

            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <RegistrationPanel event={event} slug={slug} ticket={ticket} />
            </Reveal>
          </div>
        </div>
      </section>

    </main>
  );
}

/**
 * The ruled fact row: when, where, who, and what it costs.
 *
 * Same shape the space-detail pages use, so an event reads as part of the site
 * rather than as a page somebody bolted on.
 */
async function Facts({
  event,
  location,
  ticket,
  locale,
}: {
  event: EventView;
  location: string;
  ticket: TicketOffer | null;
  locale: string;
}) {
  const amount = ticket?.amount ?? null;
  const t = await getTranslations("EventDetail");
  const te = await getTranslations("EventsPage");

  const rows: {label: string; value: string}[] = [
    {
      label: t("whenLabel"),
      value: [event.when.weekday, event.when.date, event.when.time]
        .filter(Boolean)
        .join(" · "),
    },
    {label: t("whereLabel"), value: location},
  ];

  if (event.host) rows.push({label: t("hostLabel"), value: event.host});

  rows.push({
    label: t("ticketLabel"),
    // A live amount when we have one. `ticketedLabel` when the event sells a
    // ticket whose price we could not resolve: saying "Ticketed" is honest,
    // where printing the stored snapshot would quote a price that may already
    // have changed in the Rekaz dashboard.
    value: !event.isTicketed
      ? te("freeLabel")
      : amount !== null
        ? formatAmount(amount, locale)
        : te("ticketedLabel"),
  });

  // 🔴 TWO DIFFERENT COUNTERS, and reading the wrong one is silently wrong
  // rather than broken. A free event's seats are rows in our own
  // `event_registrations`. A ticketed event writes NO rows here at all, so
  // `event.seats` would report a capacity of thirty as thirty seats free
  // forever, on an event that may have sold out this morning. Rekaz holds the
  // only inventory a ticket has.
  const stock = event.isTicketed ? ticket?.stock : undefined;

  if (event.isTicketed) {
    if (stock?.kind === "running_low") {
      rows.push({
        label: t("seatsLabel"),
        value: te("seatsLeft", {count: stock.left}),
      });
    } else if (stock?.kind === "sold_out") {
      rows.push({label: t("seatsLabel"), value: te("soldOut")});
    }
  } else if (event.seats.kind === "running_low") {
    rows.push({
      label: t("seatsLabel"),
      value: te("seatsLeft", {count: event.seats.left}),
    });
  } else if (event.seats.kind === "full") {
    rows.push({label: t("seatsLabel"), value: te("soldOut")});
  }

  return (
    <dl className="flex flex-col">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex flex-col gap-1 border-t border-black/10 py-4 sm:flex-row sm:items-baseline sm:gap-8"
        >
          <dt className="eyebrow text-12 text-muted sm:w-[140px] sm:shrink-0">
            {row.label}
          </dt>
          <dd className="text-15 leading-relaxed text-black lg:text-16">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The one interactive block, and its five dead ends.
 *
 * 🔴 Each state is rendered DIFFERENTLY on purpose. "It has finished",
 * "registration closed", "every seat is taken" and "we cannot reach the ticket
 * system" are four different facts leading to four different next actions, and
 * collapsing them into one greyed-out button is how a page stops being useful
 * at exactly the moment somebody needs it to be.
 *
 * 🔴 The fifth is the ticketed one, and it is a LINK rather than a form. Rekaz
 * publishes no write endpoint for a one-time product, so a paid seat is bought
 * on their storefront and this site never takes the money, the name or the
 * number. Owner decision, 2026-07-30. Do not "restore" a form here: the write
 * path behind it is deleted, and `registerForEvent` now refuses a ticketed event
 * outright.
 */
async function RegistrationPanel({
  event,
  slug,
  ticket,
}: {
  event: EventView;
  slug: string;
  ticket: TicketOffer | null;
}) {
  const t = await getTranslations("EventDetail");

  if (event.phase === "past") {
    return (
      <Panel title={t("endedTitle")} body={t("endedBody")} cta={t("upcomingCta")} />
    );
  }

  if (!event.registrationOpen) {
    return (
      <Panel title={t("closedTitle")} body={t("closedBody")} cta={t("upcomingCta")} />
    );
  }

  if (event.seats.kind === "full") {
    return (
      <Panel
        title={t("soldOutTitle")}
        body={t("soldOutBody")}
        cta={t("upcomingCta")}
      />
    );
  }

  if (event.isTicketed) {
    // Rekaz is unreachable, or the price was deleted in their dashboard while
    // this event still pointed at it. Without the live figure there is nothing
    // honest to put on a button, and without the product there is nowhere to
    // send anybody.
    if (!ticket) {
      return <Panel title={t("registerTitle")} body={t("unavailable")} />;
    }

    // 🔴 SOLD OUT IS ITS OWN ANSWER, and it is the reason this branch exists.
    // Until 2026-07-31 an exhausted ticket came back as an ERROR and landed in
    // the panel above, which reads "Registration is not available right now.
    // Message us and we will arrange a seat": an invitation to chase a seat
    // that does not exist, sent to somebody who would then be told no by hand.
    // The sold-out copy is the same one a full free event gets, because it is
    // the same fact.
    if (ticket.stock.kind === "sold_out") {
      return (
        <Panel
          title={t("soldOutTitle")}
          body={t("soldOutBody")}
          cta={t("upcomingCta")}
        />
      );
    }

    return (
      <div className="rounded-[16px] bg-beige-card p-8 lg:p-10">
        <WordReveal
          as="h2"
          className="font-sans text-24 font-bold leading-[1.05] text-brown lg:text-32"
        >
          {t("ticketTitle")}
        </WordReveal>
        {/* 🔴 NO SENTENCE ABOUT THE HAND-OFF, and none may be added. Owner
            ruling, `TONE.md` section 6: a plain link, nothing written about
            leaving. The price is already stated in the fact row above, which is
            what satisfies "nobody pays without seeing a total". `CtaButton`
            detects the external href and opens it in a new tab by itself. */}
        <div className="mt-7">
          <CtaButton href={ticket.storeUrl} variant="onTan">
            {t("ticketCta")}
          </CtaButton>
        </div>
        <p className="mt-4 text-pretty text-12 text-brown/60">{t("vatNote")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-[16px] bg-beige-card p-8 lg:p-10">
      <WordReveal
        as="h2"
        className="font-sans text-24 font-bold leading-[1.05] text-brown lg:text-32"
      >
        {t("registerTitle")}
      </WordReveal>
      <p className="mt-3 max-w-[42ch] text-pretty text-15 leading-relaxed text-brown/85">
        {t("registerIntro")}
      </p>
      <div className="mt-7">
        <EventRegistration slug={slug} />
      </div>
    </div>
  );
}

function Panel({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: string;
}) {
  return (
    <div className="rounded-[16px] bg-beige-card p-8 lg:p-10">
      <h2 className="text-balance font-sans text-24 font-bold leading-[1.05] text-brown lg:text-32">
        {title}
      </h2>
      <p className="mt-3 max-w-[42ch] text-pretty text-15 leading-relaxed text-brown/85">
        {body}
      </p>
      {cta && (
        <div className="mt-6">
          <CtaButton href="/events" variant="onTan">
            {cta}
          </CtaButton>
        </div>
      )}
    </div>
  );
}

/** SAR, in the reader's own numerals. Matches the booking flow exactly. */
function formatAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(amount);
}
