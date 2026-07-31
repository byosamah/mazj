const RIYADH = "Asia/Riyadh";

export type StampPrecision = "minute" | "day" | "month";

type StampProps = {
  iso: string;
  /** Honours `events.date_precision`, so an event that only records a month never grows an hour nobody chose. */
  precision?: StampPrecision;
  /** Append " Riyadh". Defaults to true for times, false otherwise. */
  zone?: boolean;
  /** Adds a 12px subdued "in 3 days" / "today" sub-line. */
  relative?: boolean;
};

/**
 * ONE date and time grammar for the whole admin, replacing four.
 *
 * What it replaces, all four shipping simultaneously on adjacent screens: a raw
 * ISO `2026-07-29`; `Wed 07-29` with no month name and no year; `15 Jan, 14:32`
 * with no year at all; and a `.replace("T", " ")`.
 *
 * | precision | output                    |
 * |-----------|---------------------------|
 * | minute    | Wed 29 Jul 2026, 14:32    |
 * | day       | Wed 29 Jul 2026           |
 * | month     | February 2023             |
 *
 * 🔴 The YEAR is explicit, and restored deliberately. The startups queue is
 * designed to accumulate, and two applications a year apart currently format
 * identically, so the queue silently loses its own ordering to anyone reading
 * it.
 *
 * ⚠️ It is assembled from three formatters rather than one. A single en-GB
 * formatter given weekday + day + month + year emits "Wed, 29 Jul 2026", and
 * adding the time gives "Wed, 29 Jul 2026, 14:32", i.e. two commas doing two
 * different jobs. The grammar above uses the comma only to separate the day
 * from the time.
 *
 * ⚠️ `hourCycle: "h23"`, not `hour12: false`. In en-GB the latter resolves to
 * the h24 cycle in several ICU versions, which renders midnight as "24:00" on
 * the previous day. On a booking screen that is a wrong answer, not a wrong
 * format.
 */
export function formatStamp(
  iso: string,
  precision: StampPrecision = "minute"
): string {
  // A malformed ISO string is deliberately NOT caught here. Intl throws, the
  // route's error boundary says "This section stopped. Nothing was changed.",
  // and somebody fixes the data. Inventing a fallback string would put a
  // plausible-looking date on screen that nothing in the system stands behind.
  const d = new Date(iso);

  if (precision === "month") {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: RIYADH,
      month: "long",
      year: "numeric",
    }).format(d);
  }

  const weekday = new Intl.DateTimeFormat("en-GB", {
    timeZone: RIYADH,
    weekday: "short",
  }).format(d);

  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: RIYADH,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);

  if (precision === "day") return `${weekday} ${date}`;

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: RIYADH,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);

  return `${weekday} ${date}, ${time}`;
}

/**
 * The calendar day an instant falls on IN RIYADH, as a whole number of days.
 *
 * Subtracting two timestamps and dividing by 86400000 answers a different
 * question (how many 24-hour periods apart they are), which is off by one for
 * most of every day. "Tomorrow" means the next Riyadh date, not 24 hours away.
 * en-CA is used only because it formats as YYYY-MM-DD, which parses without
 * ambiguity.
 */
function riyadhEpochDay(d: Date): number {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: RIYADH,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .split("-")
    .map(Number);
  return Math.floor(Date.UTC(y, m - 1, day) / 86_400_000);
}

function relativeDays(iso: string): string {
  const diff = riyadhEpochDay(new Date(iso)) - riyadhEpochDay(new Date());
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

export function Stamp({
  iso,
  precision = "minute",
  zone,
  relative = false,
}: StampProps) {
  const showZone = zone ?? precision === "minute";
  const body = (
    <>
      <time dateTime={iso} className="whitespace-nowrap tabular-nums">
        {formatStamp(iso, precision)}
      </time>
      {showZone && (
        <span className="text-12 text-subtle-foreground">{" Riyadh"}</span>
      )}
    </>
  );

  if (!relative) return body;

  // The sub-line is a block, so it needs a box of its own. Wrapping only in the
  // relative case keeps the common stamp a plain inline run that a table cell
  // or a sentence can hold without a stray box changing its baseline.
  return (
    <span className="inline-block">
      {body}
      <span className="block text-12 text-subtle-foreground">
        {relativeDays(iso)}
      </span>
    </span>
  );
}
