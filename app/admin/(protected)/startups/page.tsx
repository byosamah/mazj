import Link from "next/link";

import {
  Btn,
  Chip,
  Disclosure,
  EmptyState,
  ErrorState,
  Field,
  Handle,
  HealthStrip,
  Metric,
  PageHead,
  RecordList,
  RecordRow,
  Section,
  Stamp,
  StatusDot,
  UnknownValue,
  type HealthItem,
} from "@/components/admin";

import { requireAdmin } from "../../_lib/auth";
import {
  QUERY_MAX,
  SPACE_LABELS,
  STAGE_LABELS,
  loadStartupsQueue,
  type ApplicationSummary,
} from "../../_lib/startups";

/**
 * The startups queue.
 *
 * `force-dynamic` because the page is per-session: it reads the auth cookie and
 * must never be prerendered or shared. The DATA is uncached too, deliberately,
 * which is the opposite call from the Rekaz dashboard; the reasoning is in
 * `_lib/startups.ts`.
 */
export const dynamic = "force-dynamic";

/**
 * Where the decided list stops being a list and starts being a wall.
 *
 * Eight rows is roughly a phone screen. Past that the section a person came
 * here for (the undecided ones, above) starts scrolling off the top under the
 * weight of everything already answered, which is the same weight inversion
 * this redesign fixes inside the rows themselves.
 */
const DECIDED_INLINE_MAX = 8;

export default async function StartupsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  // 🔴 AUTHORISED HERE, not only by the layout, and above the first data read.
  //
  // `redirect()` in the layout throws, but React renders a page CONCURRENTLY
  // with its ancestors rather than after them, so the throw does not stop this
  // component. That was measured on an anonymous `curl /admin`: a correct 307
  // whose body still carried 28KB of rendered dashboard.
  //
  // It matters more here than it did there. This table holds founders' names,
  // email addresses, mobile numbers and written descriptions of unlaunched
  // businesses. Leaking the dashboard leaks room occupancy; leaking this leaks
  // other people's confidences.
  //
  // Belt and braces: `loadStartupsQueue` REQUIRES the `AdminUser` this returns,
  // so forgetting the guard is a compile error rather than a leak a regex has
  // to notice. `test/admin-page-guards.test.ts` is the check for pages that do
  // not happen to read data.
  const admin = await requireAdmin();

  const { q } = await searchParams;
  // Bounded on the way in as well as inside the loader. Nothing longer than a
  // reference or a name can match anything, and the value is echoed back into
  // an input and into a sentence.
  const query = (typeof q === "string" ? q : "").trim().slice(0, QUERY_MAX);

  const queue = await loadStartupsQueue(admin, query);

  // 🔴 Rendered, above everything it invalidates, rather than logged. The cap
  // is what turned the old "Total" figure into a ceiling wearing a count's
  // clothes, and a `log.warn` is not a control.
  const health: HealthItem[] = queue.truncated
    ? [
        {
          tone: "warn",
          text: "This is not the whole list.",
          detail: `The queue reads the newest ${queue.total} applications. Anything older is not on this screen, so every figure below is a floor rather than a total.`,
        },
      ]
    : [];

  return (
    <div className="space-y-10 lg:space-y-12">
      <PageHead
        eyebrow="PROGRAMME"
        title="Startups"
        lede="Applications for the startups and builders offer. Times are Al-Khobar time, wherever you are."
        actions={<SearchForm query={query} />}
        notice={health.length > 0 ? <HealthStrip items={health} /> : undefined}
      />

      {queue.error ? (
        // 🔴 A failed load and an empty queue are DIFFERENT OBJECTS, not the
        // same panel in a different colour. "No applications" and "we cannot
        // reach the database" mean opposite things: one says go home, the other
        // says a founder may have applied an hour ago and nobody can see it.
        // The figures are withheld with the list, because a confident 0 read
        // off a failed query is the same lie in a larger typeface.
        <ErrorState
          title={queue.error.title}
          message={queue.error.message}
          next={queue.error.next}
        />
      ) : (
        <>
          {/* Three tiles, and two of them are usually absent. That is the
              design: a permanent "0 email failures" is a tile the eye learns to
              skip, so on the day it reads 3 it is invisible too. */}
          <div className="grid gap-8 sm:grid-cols-3">
            <Metric
              label="Waiting on you"
              value={queue.pendingCount}
              tone="attention"
            />
            <Metric
              label="Email never sent"
              value={queue.undeliveredCount}
              tone="destructive"
              suppressZero
              note="Decided, and told nothing."
            />
            <Metric
              label="Codes expired unused"
              value={queue.expiredUnusedCount}
              tone="warn"
              suppressZero
              note="Approved, and never used."
            />
          </div>

          {queue.total === 0 ? (
            <EmptyState
              message="Nobody has applied yet."
              hint="The form is on /startups. An application appears here the moment somebody sends it, with no step in between."
            />
          ) : queue.matched === 0 ? (
            <EmptyState
              message={`Nothing here matches ${query}.`}
              hint="The search reads the reference and the two names, and nothing else. A reference looks like MZ-4K7Q2X."
              action={
                <Btn variant="quiet" asChild>
                  <Link href="/admin/startups">Show every application</Link>
                </Btn>
              }
            />
          ) : (
            <>
              <Section eyebrow="WAITING ON YOU" title="Undecided">
                {queue.waiting.length === 0 ? (
                  <EmptyState
                    message={
                      query
                        ? "Nothing undecided matches that."
                        : "Nothing is waiting on you."
                    }
                  />
                ) : (
                  <RecordList>
                    {queue.waiting.map((row) => (
                      <QueueRow key={row.id} row={row} />
                    ))}
                  </RecordList>
                )}
              </Section>

              <Section eyebrow="DECIDED" title="Answered">
                {queue.decided.length === 0 ? (
                  <EmptyState
                    message={
                      query
                        ? "Nothing decided matches that."
                        : "Nothing has been answered yet."
                    }
                  />
                ) : queue.decided.length > DECIDED_INLINE_MAX ? (
                  // Collapsed, but never on a search: hiding the row somebody
                  // just typed a reference to find is the one thing this
                  // section must not do.
                  <Disclosure
                    label="Applications already answered"
                    count={queue.decided.length}
                    defaultOpen={query !== ""}
                  >
                    <RecordList>
                      {queue.decided.map((row) => (
                        <QueueRow key={row.id} row={row} />
                      ))}
                    </RecordList>
                  </Disclosure>
                ) : (
                  <RecordList>
                    {queue.decided.map((row) => (
                      <QueueRow key={row.id} row={row} />
                    ))}
                  </RecordList>
                )}
              </Section>

              {/* 🔴 The old "Total" tile lives here now, as a caption, because
                  it never was a total: it is the length of a capped read. A
                  figure that stops growing at 500 has no business being set in
                  32px beside two figures that mean something. */}
              <p className="text-12 text-subtle-foreground">
                {query
                  ? `Showing ${queue.matched} of ${plural(queue.total, "application")} for ${query}. Pending are hoisted to the top.`
                  : `${plural(queue.total, "application")}, newest first. Pending are hoisted to the top.`}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The lookup, as a plain GET form.
 *
 * 🔴 Never a Server Action. `MZ-XXXXXX` is the handle a founder quotes over
 * WhatsApp, so this is the control somebody uses mid-conversation: a query
 * parameter survives a reload, can be pasted to a colleague, needs no
 * JavaScript, and needs no separate guard on a page that already guards itself.
 *
 * One text input and no submit button is deliberate: a single-field form
 * submits on Enter by itself, and a second control here would compete with the
 * row actions for the eye.
 */
function SearchForm({ query }: { query: string }) {
  return (
    // A fixed track rather than `w-full`: this sits inside a content-sized flex
    // item in PageHead, where a percentage width resolves against a box that is
    // itself being sized by this content.
    <div className="flex flex-wrap items-end gap-2">
      <form method="get" className="w-56 sm:w-64">
        <Field
          id="q"
          name="q"
          label="Find"
          type="search"
          placeholder="MZ-… or a name"
          maxLength={QUERY_MAX}
          defaultValue={query}
        />
      </form>
      {query !== "" && (
        <Btn variant="quiet" size="sm" asChild>
          <Link href="/admin/startups">Clear</Link>
        </Btn>
      )}
    </div>
  );
}

function QueueRow({ row }: { row: ApplicationSummary }) {
  const href = `/admin/startups/${row.id}`;

  return (
    <RecordRow
      mark={<RowMark row={row} />}
      lead={
        <>
          <Link href={href} className="underline-offset-4 hover:underline">
            {row.startupName}
          </Link>
          <span className="mt-0.5 block text-12 font-normal text-subtle-foreground">
            {STAGE_LABELS[row.stage] ?? row.stage} ·{" "}
            {row.teamSize === 1 ? "solo founder" : `${row.teamSize} people`}
          </span>
        </>
      }
      meta={[
        // With the year, and with the weekday. This queue is designed to
        // accumulate, so two applications a year apart used to format
        // identically and the column read as chronological when it is not.
        {
          label: "Applied",
          value: <Stamp iso={row.createdAt} zone={false} />,
        },
        { label: "Founder", value: row.founderName },
        { label: "Wants", value: SPACE_LABELS[row.space] ?? row.space },
        { label: "Code", value: <CodeCell row={row} /> },
      ]}
      action={
        <Btn variant="quiet" size="sm" asChild>
          {/* "Open", not "Decide", once it is decided. The label on a row's one
              control must describe what pressing it does. */}
          <Link href={href}>{row.status === "pending" ? "Decide" : "Open"}</Link>
        </Btn>
      }
    />
  );
}

/**
 * The row's headline state.
 *
 * 🔴 The weight inversion is the point. The finished states get the quietest
 * marks and the unanswered one gets ink, which is the strongest mark in the
 * system, because it is the only row that needs a person.
 *
 * 🔴 An approval whose email never left is NEVER green. "Approved" and
 * "approved but nobody was told" are different states, and the second is the
 * only failure on this screen a human has to act on. It is invisible by
 * construction otherwise: the decision succeeded, the row is correct, the code
 * is real, and a founder is sitting there waiting.
 *
 * The word tracks the status rather than being pinned to "Approved", because a
 * rejection whose email failed is the same failure and printing "Approved" on
 * it would be a false statement about a decision.
 */
function RowMark({ row }: { row: ApplicationSummary }) {
  if (row.emailDelivered === false) {
    return (
      <Chip tone="destructive" fill="solid">
        {row.status === "approved"
          ? "Approved, not emailed"
          : "Rejected, not emailed"}
      </Chip>
    );
  }

  if (row.status === "pending") {
    return <StatusDot tone="attention" label="Waiting on you" />;
  }

  if (row.status === "approved") {
    return <StatusDot tone="ok" label="Approved" />;
  }

  return <StatusDot tone="quiet" fill="hollow" label="Rejected" />;
}

/**
 * The code, and which of its four endings this one reached.
 *
 * 🔴 A redeemed code carries NO strikethrough. It is the success outcome of the
 * entire feature: somebody applied, was approved, walked in, and was served.
 * The old cell struck it through and set it in the same 10px grey as an expiry,
 * so the win and the loss looked identical.
 */
function CodeCell({ row }: { row: ApplicationSummary }) {
  if (!row.code) {
    return <UnknownValue reason="none">No code</UnknownValue>;
  }

  if (row.redeemedAt) {
    return (
      <>
        <Handle size="sm">{row.code}</Handle>
        <span className="mt-1 block">
          <StatusDot tone="ok" size="sm" label="Used" />
        </span>
      </>
    );
  }

  if (row.codeExpired) {
    return (
      <>
        {/* The wrapper carries the colour: `Handle` sets no text colour of its
            own, so a spent code recedes without a second variant existing. */}
        <span className="text-subtle-foreground">
          <Handle size="sm">{row.code}</Handle>
        </span>
        <span className="mt-1 block">
          <StatusDot tone="warn" size="sm" label="Expired unused" />
        </span>
      </>
    );
  }

  return (
    <>
      <Handle size="sm">{row.code}</Handle>
      <span className="mt-1 block">
        {row.codeExpiresAt ? (
          <Stamp iso={row.codeExpiresAt} precision="day" relative />
        ) : (
          <UnknownValue reason="unknown">No expiry recorded</UnknownValue>
        )}
      </span>
    </>
  );
}

/** "1 application" / "2 applications". A count in a sentence has to read. */
function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
