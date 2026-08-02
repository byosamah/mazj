import {ExternalLink} from "lucide-react";
import {notFound} from "next/navigation";

import {
  Btn,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  Eyebrow,
  Handle,
  Metric,
  PageHead,
  Section,
  Stamp,
  StatusDot,
  Td,
  Th,
  UnknownValue,
} from "@/components/admin";

import {requireAdmin, type AdminUser} from "../../../_lib/auth";
import {readEventOutcome} from "../../../_lib/event-outcomes";
import {
  loadAdminEvent,
  loadRegistrations,
  loadTicketOptions,
  type AdminEventDetail,
  type AdminRegistrationRow,
  type AdminRegistrationsResult,
} from "../../../_lib/events";
import {EventActions} from "../EventActions";
import {EventCrumbs} from "../EventCrumbs";
import {EventLifecycle} from "../EventLifecycle";
import EventForm from "../EventForm";

/**
 * One event: edit it, and see who signed up.
 *
 * Both on one page rather than two, because they are read together. The single
 * most common question about an event is "how many so far", and putting that
 * one click away from the thing you are editing is one click too many for the
 * question that gets asked daily. That is also why the count is now a figure at
 * the top rather than something to be inferred from the length of a table.
 */
export const dynamic = "force-dynamic";

export default async function AdminEventPage({
  params,
  searchParams,
}: {
  params: Promise<{id: string}>;
  /**
   * `?saved=1` is set by `saveEvent`'s own redirect. See P10.
   *
   * `?outcome=…` is set by the status and delete controls beside the title.
   * The two are mutually exclusive by construction: each action's redirect
   * writes its own parameter and drops the other's.
   */
  searchParams: Promise<{
    saved?: string | string[];
    outcome?: string | string[];
    event?: string | string[];
  }>;
}) {
  // 🔴 Above the first data read. This page loads registrations, which are
  // names, mobile numbers and email addresses of members of the public. A
  // layout `redirect()` throws but does not cancel this component, so without
  // this line an anonymous request gets a 307 AND a body full of personal data.
  const admin = await requireAdmin();
  const {id} = await params;
  const query = await searchParams;
  const saved =
    (Array.isArray(query.saved) ? query.saved[0] : query.saved) === "1";
  const outcome = readEventOutcome(query);

  const found = await loadAdminEvent(admin, id);

  // 🔴 Only `missing` is a 404. A database outage used to arrive here as the
  // same `null`, so an unreachable database rendered as "this event does not
  // exist" and the operator's next move is to write it again.
  if (found.status === "missing") notFound();

  const event = found.status === "found" ? found.event : null;
  const extras = event ? await loadExtras(admin, id) : null;
  const heading = event ? headingFor(event) : "Event";

  return (
    <div className="space-y-10 lg:space-y-12">
      <PageHead
        back={<EventCrumbs current={heading} />}
        eyebrow="PROGRAMME · EVENTS"
        title={heading}
        lede={event ? ledeFor(event) : undefined}
        actions={event ? <HeadActions event={event} /> : undefined}
      />

      {event && extras ? (
        <>
          <Glance event={event} />

          <Section
            eyebrow="WHO IS COMING"
            title="Sign-ups"
            subtitle={
              extras.registrations.status === "ok"
                ? countsLine(extras.registrations.rows)
                : undefined
            }
            action={
              extras.registrations.status === "ok" &&
              extras.registrations.rows.length > 0 ? (
                <Btn variant="quiet" size="sm" asChild>
                  <a href={`/admin/events/${event.id}/csv`}>Download CSV</a>
                </Btn>
              ) : undefined
            }
          >
            <SignUps registrations={extras.registrations} event={event} />
          </Section>

          <EventForm
            event={event}
            ticketOptions={extras.tickets.options}
            rekazReachable={extras.tickets.reachable}
            saved={saved}
            outcome={outcome}
          />
        </>
      ) : (
        <ErrorState
          title="This event could not be read"
          message="Nothing on this screen is this event. The database did not answer."
          next="Try again in a minute. The event itself was not changed."
        />
      )}
    </div>
  );
}

/**
 * The Rekaz catalog and the sign-ups, together.
 *
 * Both are only worth asking for once we know the event exists, which is why
 * this is a function rather than two awaits at the top: a database outage
 * should not also spend a live Rekaz call.
 */
async function loadExtras(admin: AdminUser, id: string) {
  const [tickets, registrations] = await Promise.all([
    loadTicketOptions(admin),
    loadRegistrations(admin, id),
  ]);
  return {tickets, registrations};
}

function headingFor(event: AdminEventDetail): string {
  // Both titles empty. "Untitled" once, rather than the slug standing in as a
  // name while it is also printed as the link on the list this came from.
  return event.titleSource === "slug" ? "Untitled" : event.title;
}

function ledeFor(event: AdminEventDetail): string | undefined {
  if (event.status === "draft") {
    return "Not on the site. It appears the moment you set it to published.";
  }
  if (event.status === "cancelled") {
    return "Hidden from the site. Everyone who signed up is still recorded.";
  }
  // Published: the two links beside the title say where it is, and say it in a
  // form somebody can actually press.
  return undefined;
}

/**
 * What sits beside the h1: where this event currently is, and how to move it.
 *
 * A published event gets its two public pages as REAL links: they were plain
 * text before, so previewing what you had just written meant copy-pasting a
 * path by hand. A draft or a cancelled event gets its state instead, because
 * those URLs do not resolve.
 *
 * 🔴 `EventActions` renders LAST and on every status, which is the half of this
 * that changed on 2026-08-01. The state was already stated up here; the only
 * way to CHANGE it was a select near the bottom of a fourteen-field form,
 * applied by rewriting every other column with it. The badge and the control
 * that moves it now sit in the same eyeline.
 */
function HeadActions({event}: {event: AdminEventDetail}) {
  return (
    <>
      {event.status === "published" ? (
        <>
          <PublicLink href={`/en/events/${event.slug}`} label="English page" />
          <PublicLink href={`/ar/events/${event.slug}`} label="Arabic page" />
        </>
      ) : event.status === "cancelled" ? (
        <Chip tone="destructive" fill="hollow">
          Cancelled
        </Chip>
      ) : (
        <Chip tone="quiet">Draft</Chip>
      )}
      <EventActions event={event} scope="detail" />
    </>
  );
}

function PublicLink({href, label}: {href: string; label: string}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="inline-flex min-h-11 items-center gap-2 text-13 underline decoration-border underline-offset-4 hover:decoration-foreground"
    >
      {label}
      <span className="sr-only"> (opens in a new tab)</span>
      <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
    </a>
  );
}

/**
 * The four figures the page's own docstring says are asked for daily, and which
 * it used to throw away: it loaded the seat count and the capacity and then
 * rendered a table with neither.
 */
function Glance({event}: {event: AdminEventDetail}) {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Signed up" value={event.seatsTaken} />

      {event.capacity === null ? (
        <Fact label="Capacity">
          <UnknownValue reason="none">No limit</UnknownValue>
        </Fact>
      ) : (
        <Metric label="Capacity" value={event.capacity} />
      )}

      <Fact label="Ticket">
        {!event.isTicketed ? (
          <span className="text-14">Free</span>
        ) : event.ticketAmount === null ? (
          <UnknownValue reason="unknown">Price not recorded</UnknownValue>
        ) : (
          <>
            <Handle size="sm">{event.ticketAmount} SAR</Handle>
            <span className="mt-1 block text-12 text-subtle-foreground">
              price when picked
            </span>
          </>
        )}
      </Fact>

      <Fact label="Status">
        <EventLifecycle event={event} />
      </Fact>
    </div>
  );
}

/**
 * A labelled fact that is not a number.
 *
 * Deliberately not a `Metric`: that one's `null` renders the words "Not
 * counted", which is the right sentence for a count we could not take and the
 * wrong one for a ticket that is free or a capacity that is deliberately
 * unlimited. The label register and the spacing match it exactly, so the row
 * still reads as one row.
 */
function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Eyebrow size={11}>{label}</Eyebrow>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function countsLine(rows: AdminRegistrationRow[]): string {
  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  const holding = rows.filter((r) => r.holdLive).length;
  const gone = rows.length - confirmed - holding;

  const parts = [`${confirmed} confirmed`];
  if (holding > 0) parts.push(`${holding} holding a seat`);
  if (gone > 0) parts.push(`${gone} lapsed or released`);

  return `${parts.join(", ")}. Times are Al-Khobar time.`;
}

function SignUps({
  registrations,
  event,
}: {
  registrations: AdminRegistrationsResult;
  event: AdminEventDetail;
}) {
  if (registrations.status !== "ok") {
    return (
      <ErrorState
        title="The sign-ups could not be read"
        message="Nothing here is who is coming. The database did not answer."
        next="Try again in a minute. Nobody's sign-up was affected, and the download is off until it works."
      />
    );
  }

  if (registrations.rows.length === 0) {
    return <EmptyState message="Nobody has signed up yet." />;
  }

  return (
    <DataTable caption="Everyone signed up for this event" minWidth="56rem">
      <thead>
        <tr>
          <Th>Name</Th>
          <Th>Mobile</Th>
          <Th>Status</Th>
          <Th priority="md">Language</Th>
          <Th priority="md">Email</Th>
          <Th priority="md">Signed up</Th>
          <Th priority="lg">Rekaz order</Th>
        </tr>
      </thead>
      <tbody>
        {registrations.rows.map((row) => (
          <tr key={row.id} className="transition-colors hover:bg-card">
            <Td className="font-medium">{row.fullName}</Td>
            <Td>
              {/* 🔴 An E.164 string reorders in a bidi-neutral context, and
                  this table is read on a phone while somebody is dialling. */}
              <span dir="ltr">
                <Handle size="sm">{row.phoneE164}</Handle>
              </span>
            </Td>
            <Td>
              <RegistrationStatus row={row} />
            </Td>
            <Td priority="md">
              {/* Loaded, shipped in the CSV, and never shown on screen before.
                  It is what tells whoever answers which language to write in. */}
              <span className="eyebrow text-11">
                {row.locale.toUpperCase()}
              </span>
            </Td>
            <Td priority="md">
              {row.email ?? <UnknownValue reason="none">No email</UnknownValue>}
            </Td>
            <Td priority="md">
              <Stamp iso={row.createdAt} zone={false} />
            </Td>
            <Td priority="lg">
              <RekazReference row={row} isTicketed={event.isTicketed} />
            </Td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}

/**
 * 🔴 FOUR STATES, FOUR TREATMENTS.
 *
 * "Holding" and "expired" are the same `pending_payment` row seconds apart, and
 * `cancelled` is neither: expired means a buyer walked away, cancelled means
 * something on OUR side released the seat. Three of the four used to share one
 * grey chip, which hides a broken ticket product behind what reads as ordinary
 * drop-off.
 *
 * `warn` is exactly right for a live hold: mid-purchase is healthy, and on a
 * clock. The visible expiry also makes a stale server render self-evident
 * rather than silently wrong.
 */
function RegistrationStatus({row}: {row: AdminRegistrationRow}) {
  if (row.status === "confirmed") {
    return <StatusDot tone="ok" label="Confirmed" />;
  }

  if (row.status === "cancelled") {
    return <StatusDot tone="destructive" label="Released by us" />;
  }

  if (row.status === "pending_payment" && row.holdLive && row.holdExpiresAt) {
    return (
      <div>
        <StatusDot tone="warn" label="Holding a seat" />
        <span className="mt-1 block text-12 tabular-nums text-subtle-foreground">
          until {clockAtVenue(row.holdExpiresAt)}
        </span>
      </div>
    );
  }

  if (row.status === "pending_payment") {
    return <StatusDot tone="quiet" fill="hollow" label="Hold lapsed" />;
  }

  if (row.status === "expired") {
    return <StatusDot tone="quiet" fill="hollow" label="Expired" />;
  }

  // The status column is `text` plus a check constraint, so it can gain a value
  // this build has never seen. Rendering the raw string quietly beats inventing
  // a word for it.
  return <StatusDot tone="quiet" fill="hollow" label={row.status} />;
}

/**
 * The clock time only, at the venue.
 *
 * Not a `Stamp`: a hold lapses within thirty minutes, so the weekday, the date
 * and the year are three facts nobody reading this row needs, in the one cell
 * that has to be read at a glance. The zone is stated once, in the section's
 * subtitle above.
 */
function clockAtVenue(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/**
 * A missing Rekaz reference splits by CAUSE.
 *
 * On a free event there was never an order to record, which is not a problem.
 * On a ticketed one an order exists and we have lost the only thread back to
 * it, which is: `event-tickets.ts` records `invoiceId` coming back undefined on
 * a real order, so the subscription id is all there ever was.
 */
function RekazReference({
  row,
  isTicketed,
}: {
  row: AdminRegistrationRow;
  isTicketed: boolean;
}) {
  if (row.rekazReference) {
    return <Handle size="sm">{row.rekazReference}</Handle>;
  }

  return isTicketed ? (
    <Chip tone="destructive">No order found</Chip>
  ) : (
    <UnknownValue reason="none">Not needed</UnknownValue>
  );
}
