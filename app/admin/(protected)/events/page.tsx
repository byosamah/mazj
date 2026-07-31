import Link from "next/link";

import {
  Ar,
  Btn,
  Chip,
  Disclosure,
  EmptyState,
  ErrorState,
  Handle,
  HealthStrip,
  PageHead,
  RecordList,
  RecordRow,
  Section,
  Stamp,
  UnknownValue,
  type HealthItem,
  type StampPrecision,
} from "@/components/admin";

import {requireAdmin} from "../../_lib/auth";
import {loadAdminEvents, type AdminEventRow} from "../../_lib/events";
import {EventLifecycle} from "./EventLifecycle";

/**
 * Every event, drafts included.
 *
 * `force-dynamic` because the page is per-session: it reads the auth cookie and
 * must never be prerendered or shared. Unlike the dashboard this data is NOT
 * cached: an owner who has just published something and does not see it would
 * publish it twice. The right answer to slowness here is the loading boundary
 * next door, never a cache.
 */
export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function AdminEventsPage() {
  // 🔴 AUTHORISED HERE TOO, not only by the layout. `redirect()` in the layout
  // throws, but React renders the page concurrently with its ancestors rather
  // than after them, so the throw does not stop this component. Measured on the
  // dashboard: a correct 307 to /admin/login whose body still carried 28KB of
  // rendered data. The check belongs where the data is READ.
  //
  // Belt and braces: `loadAdminEvents` REQUIRES the `AdminUser` this returns,
  // so forgetting the guard is a compile error rather than a leak a regex has
  // to notice. `test/admin-page-guards.test.ts` also fails if it is missing.
  const admin = await requireAdmin();
  const result = await loadAdminEvents(admin);

  const health: HealthItem[] = [];
  if (result.status === "ok" && !result.seatsCounted) {
    health.push({
      tone: "warn",
      text: "Nobody's sign-ups are counted on this page.",
      detail:
        "The seat count did not run, so every row reads Not counted. The events themselves are correct, and no sign-up has been lost.",
    });
  }

  return (
    <div className="space-y-10 lg:space-y-12">
      <PageHead
        eyebrow="PROGRAMME"
        title="Events"
        lede="Published events appear on the site and move into the archive by themselves once they finish."
        actions={
          <Btn variant="solid" asChild>
            <Link href="/admin/events/new">New event</Link>
          </Btn>
        }
        notice={health.length > 0 ? <HealthStrip items={health} /> : undefined}
      />
      {result.status === "unavailable" ? (
        /* 🔴 A failed load and an empty list are different OBJECTS, not the
           same panel in a different colour. "No events yet" says write one;
           this says something is broken. And the sentence is chosen HERE:
           until 2026-07-29 this printed the database's own prose, which named
           our table and column names to somebody who can act on neither. */
        <ErrorState
          title="The programme could not be read"
          message="Nothing below is the list of events. The database did not answer."
          next="Try again in a minute. No event was changed."
        />
      ) : (
        <EventSections events={result.events} />
      )}
    </div>
  );
}

function EventSections({events}: {events: AdminEventRow[]}) {
  if (events.length === 0) {
    return (
      <EmptyState
        message="No events yet."
        hint="Create one and it goes live on the site the moment you set it to published."
      />
    );
  }

  const {attention, ahead, archive} = triage(events);

  return (
    <>
      {attention.length > 0 && (
        <Section
          eyebrow="NEEDS ATTENTION"
          title="Look at these first"
          subtitle="Drafts whose date has passed, events inside seven days with nobody signed up, and anything at or over capacity."
          ruled={false}
        >
          <EventRows events={attention} />
        </Section>
      )}

      <Section
        eyebrow="COMING UP"
        title="Still to come"
        subtitle="Everything ahead, drafts included."
        ruled={attention.length > 0}
      >
        {ahead.length === 0 ? (
          <EmptyState message="Nothing is coming up." />
        ) : (
          <EventRows events={ahead} />
        )}
      </Section>

      {archive.length > 0 && (
        <Section eyebrow="ARCHIVE" title="Past and cancelled">
          {/* Closed by default: 41 imported rows would otherwise be most of
              this page, above the four events anybody came here to read. The
              count in the summary is what makes it worth opening. */}
          <Disclosure label="Show the archive" count={archive.length}>
            <EventRows events={archive} />
          </Disclosure>
        </Section>
      )}
    </>
  );
}

/**
 * The three lists, split once against ONE reading of the clock.
 *
 * ⚠️ A plain function rather than something the component does inline, and the
 * clock is why. Reading it during a component's render is what
 * `react-hooks/purity` refuses, because a client re-render would silently move
 * an event between lists. Here the page is `force-dynamic`, so this runs once
 * per request on the server and the answer is as fresh as the request; taking
 * the time twice (once per filter pass) is the thing that would actually be
 * wrong, since an event could then land in two lists or in neither.
 *
 * Precedence is attention, then archive, then ahead. A draft whose date has
 * passed is both "needs attention" and "past", and burying it in a closed
 * disclosure is exactly how it stayed invisible.
 */
function triage(events: AdminEventRow[]): {
  attention: AdminEventRow[];
  ahead: AdminEventRow[];
  archive: AdminEventRow[];
} {
  const now = Date.now();

  const attention: AdminEventRow[] = [];
  const ahead: AdminEventRow[] = [];
  const archive: AdminEventRow[] = [];

  for (const event of events) {
    if (needsAttention(event, now)) attention.push(event);
    else if (isArchived(event)) archive.push(event);
    else ahead.push(event);
  }

  return {attention, ahead, archive};
}

/**
 * The operator's daily triage, derived from data already loaded.
 *
 * Each rule is a thing somebody has to do something about, which is why a past
 * event that filled up is NOT here: it is history, and a queue that fills with
 * history is a queue nobody reads.
 */
function needsAttention(event: AdminEventRow, now: number): boolean {
  const startsAt = new Date(event.startsAt).getTime();

  // Written, dated, and never published. Nothing else on this page would ever
  // surface it: it sorts by date into the archive, inside a closed disclosure.
  if (event.status === "draft" && startsAt <= now) return true;

  if (event.phase === "past" || event.status === "cancelled") return false;

  // 🔴 `null` is "we could not count", so neither rule below may fire on it.
  // Reading an unknown as zero would put every event in the programme into this
  // queue on the one day the seat count fails, which is the same collapse the
  // null exists to prevent.
  if (event.seatsTaken === null) return false;

  if (
    event.status === "published" &&
    event.seatsTaken === 0 &&
    startsAt - now <= WEEK_MS
  ) {
    return true;
  }

  // Reachable by lowering the seat limit below the people already signed up,
  // and it had no rendering at all before this page was rebuilt.
  return event.capacity !== null && event.seatsTaken >= event.capacity;
}

function isArchived(event: AdminEventRow): boolean {
  return event.phase === "past" || event.status === "cancelled";
}

function EventRows({events}: {events: AdminEventRow[]}) {
  return (
    <RecordList>
      {events.map((event) => (
        <RecordRow
          key={event.id}
          mark={<EventLifecycle event={event} />}
          lead={<TitleCell event={event} />}
          meta={[
            {label: "Starts", value: <StartsCell event={event} />},
            {label: "Seats", value: <SeatsCell event={event} />},
            {label: "Ticket", value: <TicketCell event={event} />},
            {label: "Poster", value: <PosterCell event={event} />},
          ]}
        />
      ))}
    </RecordList>
  );
}

function TitleCell({event}: {event: AdminEventRow}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <Link
        href={`/admin/events/${event.id}`}
        className="underline-offset-4 hover:underline"
      >
        {event.titleSource === "ar" ? (
          <Ar>{event.title}</Ar>
        ) : event.titleSource === "slug" ? (
          // Both titles are empty. "Untitled" once, rather than the slug
          // printed as the name AND again beneath it as the link.
          "Untitled"
        ) : (
          event.title
        )}
      </Link>
      {event.titleSource === "ar" && <Chip tone="warn">No English title</Chip>}
      <Handle size="sm">{event.slug}</Handle>
    </div>
  );
}

/** `events.date_precision` in the grammar `Stamp` speaks. */
function stampPrecision(precision: AdminEventRow["datePrecision"]): StampPrecision {
  return precision === "exact" ? "minute" : precision;
}

function StartsCell({event}: {event: AdminEventRow}) {
  return (
    <div>
      <Stamp
        iso={event.startsAt}
        precision={stampPrecision(event.datePrecision)}
      />
      {/* 🔴 An imported archive row records a month, or a day, and nothing
          finer. The admin used to print the stored hour anyway, which invented
          a fact and disagreed with the public archive rendering the same row. */}
      {event.datePrecision !== "exact" && (
        <span className="mt-1 block">
          <UnknownValue reason="unknown">
            {event.datePrecision === "month" ? "Month only" : "Day only"}
          </UnknownValue>
        </span>
      )}
    </div>
  );
}

function SeatsCell({event}: {event: AdminEventRow}) {
  if (event.seatsTaken === null) {
    return <UnknownValue reason="unknown">Not counted</UnknownValue>;
  }

  if (event.capacity === null) {
    return <span className="tabular-nums">{event.seatsTaken} signed up</span>;
  }

  const over = event.seatsTaken - event.capacity;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="tabular-nums">
        {event.seatsTaken} / {event.capacity}
      </span>
      {over > 0 ? (
        <Chip tone="destructive">{`Over by ${over}`}</Chip>
      ) : over === 0 ? (
        <Chip tone="warn">Full</Chip>
      ) : null}
    </div>
  );
}

function TicketCell({event}: {event: AdminEventRow}) {
  if (!event.isTicketed) return <>Free</>;

  if (event.ticketAmount === null) {
    return <UnknownValue reason="unknown">Price not recorded</UnknownValue>;
  }

  return (
    <div>
      <Handle size="sm">{event.ticketAmount} SAR</Handle>
      {/* 🔴 A snapshot taken when the price was picked, not what a buyer is
          charged: that is resolved live from Rekaz at purchase, by immutable
          id. Saying so is the difference between a figure and a promise. */}
      <span className="mt-1 block text-12 text-subtle-foreground">
        price when picked
      </span>
    </div>
  );
}

function PosterCell({event}: {event: AdminEventRow}) {
  if (!event.posterUrl) return <UnknownValue reason="none">None</UnknownValue>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={event.posterUrl}
      alt="Poster"
      className="size-8 rounded object-cover"
    />
  );
}
