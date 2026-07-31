import {useTranslations} from "next-intl";

import {Link} from "@/i18n/navigation";
import type {EventView} from "@/app/[locale]/events/_lib/events";

import MediaFrame from "../MediaFrame";
import Reveal from "../Reveal";

/**
 * One announced event, as a poster card.
 *
 * This is the treatment that used to advertise three FABRICATED events carrying
 * an orange "Example" badge, because nothing real could be published without a
 * developer. The badge is gone and the slot it occupied now does honest work:
 * it reports whether you can still get in.
 *
 * 🔴 The card is a Server Component and every string on it arrives already
 * formatted for one locale. Dates in particular are formatted on the server on
 * purpose: `ar-SA` resolves to a different CALENDAR on different engines, so a
 * date formatted in the browser can disagree with the one rendered on the
 * server and take the page down with a hydration mismatch. See
 * `server/domain/events.ts`.
 */
export default function EventCard({
  event,
  index = 0,
}: {
  event: EventView;
  /** Position in the grid. Drives the reveal stagger and eager loading. */
  index?: number;
}) {
  const t = useTranslations("EventsPage");

  const soldOut = event.seats.kind === "full";
  const live = event.phase === "live";

  return (
    <Reveal
      as="li"
      delay={(index % 3) * 90}
      className="reveal-card flex flex-col gap-6"
    >
      <Link
        href={`/events/${event.slug}`}
        // The whole poster is the target, not just the title. A card with one
        // small link inside it is a 20px hit area wrapped in 400px of dead
        // pixels that look clickable.
        className="group flex flex-col gap-6 [transition:opacity_200ms,transform_120ms] active:scale-[0.96]"
      >
        <EventPoster event={event}>
          {/* Exactly ONE badge, and the order is a priority order rather than
              a layout accident: "happening now" outranks "fully booked"
              outranks the price, because a reader standing outside the
              building needs the first far more than the third. */}
          {live ? (
            <Badge tone="live">{t("liveNow")}</Badge>
          ) : soldOut ? (
            <Badge tone="quiet">{t("soldOut")}</Badge>
          ) : event.isTicketed ? (
            <Badge tone="quiet">{t("ticketedLabel")}</Badge>
          ) : (
            <Badge tone="free">{t("freeLabel")}</Badge>
          )}
        </EventPoster>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-6 border-t border-black/10 pt-5">
            {/* dir="ltr" isolates the Latin "V" + numeral: inside an RTL line
                the bidi algorithm can otherwise reorder it against neighbouring
                punctuation. Same treatment the archive rows carry. */}
            <span
              dir="ltr"
              className="eyebrow text-12 text-orange tabular-nums"
            >
              {event.edition ?? ""}
            </span>
            <time
              dateTime={event.when.machine}
              className="eyebrow text-12 text-muted tabular-nums"
            >
              {event.when.date}
            </time>
          </div>

          <h3 className="text-balance font-sans text-24 font-medium leading-[1.1] text-black underline-offset-4 group-hover:underline lg:text-32">
            {event.title}
          </h3>

          {event.host && (
            <p className="text-15 leading-relaxed text-black/70">{event.host}</p>
          )}

          <p className="max-w-[46ch] text-pretty text-15 leading-relaxed text-muted">
            {event.summary}
          </p>
        </div>
      </Link>

      {/* Below the link, not inside it: a nested interactive element inside an
          anchor is invalid HTML and a screen reader announces the whole card
          twice. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-12">
        {!soldOut && event.registrationOpen && (
          <Link
            href={`/events/${event.slug}`}
            className="eyebrow text-orange underline-offset-4 hover:underline [transition:opacity_200ms,transform_120ms] active:scale-[0.96]"
          >
            {t("registerCta")}
          </Link>
        )}
        {/* Only surfaced when it is genuinely close. "24 seats left" of 30 is
            not urgency, it is an empty room announcing itself. The threshold
            scales with the room; see `lowSeatThreshold`. */}
        {event.seats.kind === "running_low" && (
          <span className="eyebrow text-muted tabular-nums">
            {t("seatsLeft", {count: event.seats.left})}
          </span>
        )}
      </div>
    </Reveal>
  );
}

/**
 * The poster, or the quiet texture when there is not one yet.
 *
 * The empty state matters more than it looks: an event can be published the
 * minute it is decided and get its artwork a week later, and a card that shows
 * a broken frame in the meantime is worse than one that never mentions it.
 * `.dot-field` is the same texture the reference routes open with, so an event
 * without a poster still looks designed rather than unfinished.
 */
function EventPoster({
  event,
  children,
}: {
  event: EventView;
  children?: React.ReactNode;
}) {
  if (event.posterUrl) {
    return (
      <MediaFrame
        src={event.posterUrl}
        // The heading sits directly beneath, so describing the poster with the
        // event's own title would announce the same phrase twice. A poster with
        // nothing else known about it is decorative.
        alt=""
        ratio="aspect-[900/844]"
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
      >
        {children}
      </MediaFrame>
    );
  }

  return (
    <div className="relative aspect-[900/844] w-full overflow-clip rounded-[16px] after:pointer-events-none after:absolute after:inset-0 after:rounded-[16px] after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] after:content-['']">
      <div aria-hidden className="dot-field absolute inset-0 opacity-70" />
      {children}
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "live" | "free" | "quiet";
  children: React.ReactNode;
}) {
  const tones = {
    // Full brand coral. Never darkened: the coral's apparent lightness is
    // owner-locked, and a "fix" for contrast here has been rejected before.
    live: "bg-orange text-white",
    free: "bg-black text-beige",
    quiet: "bg-beige/90 text-black backdrop-blur-[8px]",
  } as const;

  return (
    <span
      className={`eyebrow absolute top-4 end-4 rounded-[4px] px-2.5 py-1.5 text-11 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
