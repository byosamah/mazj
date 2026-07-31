/**
 * Time, as the venue experiences it.
 *
 * Rekaz returns and accepts UTC. MAZJ is in Al Khobar and every human reading
 * the dashboard or picking a booking slot is standing in `Asia/Riyadh`. A
 * timestamp that is off by three hours is not a rounding error on a booking
 * system, it is the wrong day's morning.
 *
 * Saudi Arabia observes no daylight saving and has held UTC+3 since 1947, so a
 * fixed offset would be correct today. `Intl` is used anyway: it costs nothing,
 * it documents the intent at the call site, and a hardcoded `+3` is exactly the
 * kind of assumption that survives right up until the year it does not.
 *
 * Pure, so it is testable without a clock or a network.
 */

export const VENUE_TIME_ZONE = "Asia/Riyadh";

/** Fixed parts of a wall-clock time in the venue's zone. */
export type RiyadhParts = {
  /** `YYYY-MM-DD` as read in Riyadh. */
  date: string;
  /** `HH:mm`, 24-hour, as read in Riyadh. */
  time: string;
  /** Short weekday, e.g. `Sun`. */
  weekday: string;
};

const PARTS_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: VENUE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hour12: false,
});

/**
 * Splits an instant into the wall-clock parts a person in Al Khobar would read.
 *
 * `en-CA` is chosen for its ISO-shaped date output, not for any Canadian
 * connection. It is the shortest route to `YYYY-MM-DD` out of `Intl`.
 */
export function toRiyadhParts(instant: Date | string): RiyadhParts {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const parts = PARTS_FORMAT.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";

  // `hour: "2-digit"` with `hour12: false` yields "24" rather than "00" for
  // midnight in some engines. Normalising here keeps every consumer from
  // rediscovering it.
  const hour = get("hour") === "24" ? "00" : get("hour");

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
    weekday: get("weekday"),
  };
}

/** `HH:mm` in Riyadh. The common case, so it gets a name. */
export function riyadhTime(instant: Date | string): string {
  return toRiyadhParts(instant).time;
}

/** `YYYY-MM-DD` in Riyadh. */
export function riyadhDate(instant: Date | string): string {
  return toRiyadhParts(instant).date;
}

/**
 * The UTC instants bounding a calendar day as lived in Riyadh.
 *
 * 🔴 Do not build this by taking a UTC midnight and adding hours. A "today"
 * computed in UTC starts at 03:00 Riyadh, so between midnight and 3am local the
 * dashboard would show yesterday's bookings and call them today's, and the
 * 21:00-24:00 events-hall slots would land on the wrong date. The offset is
 * derived from the zone rather than assumed.
 *
 * Returns a half-open interval `[start, end)`, which is the only form that
 * neither double-counts nor drops a booking sitting exactly on midnight.
 */
export function riyadhDayRangeUtc(day: string): { start: Date; end: Date } {
  const startUtcGuess = new Date(`${day}T00:00:00Z`);
  const offsetMs = venueOffsetMs(startUtcGuess);
  const start = new Date(startUtcGuess.getTime() - offsetMs);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** The venue's UTC offset in milliseconds at a given instant. */
function venueOffsetMs(at: Date): number {
  // Formatting the same instant as if it were UTC and as if it were Riyadh, then
  // differencing, recovers the offset without hardcoding it.
  const asVenue = new Date(
    at.toLocaleString("en-US", { timeZone: VENUE_TIME_ZONE })
  );
  const asUtc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
  return asVenue.getTime() - asUtc.getTime();
}

/**
 * A wall-clock time as typed at the venue, converted to a UTC instant.
 *
 * 🔴 THE INPUT IS RIYADH TIME, NOT THE BROWSER'S TIME, and that distinction is
 * the whole reason this exists.
 *
 * An `<input type="datetime-local">` yields a bare `YYYY-MM-DDTHH:mm` with no
 * zone, and the obvious `new Date(value)` interprets it in whatever zone the
 * MACHINE is set to. That is correct only while every person who ever creates
 * an event is sitting in Al Khobar. The moment one is travelling, or has a
 * laptop still on another country's zone, an event typed as 7pm is stored three
 * or eight hours out, published, and shared, and nothing anywhere looks wrong
 * until people arrive at the wrong time.
 *
 * "7pm" on this form means 7pm in the room. The offset is derived from the zone
 * rather than assumed, the same way `riyadhDayRangeUtc` does it.
 *
 * Returns `null` on anything not shaped like a datetime-local value, so the
 * caller reports a validation error instead of storing `Invalid Date`.
 */
export function riyadhWallClockToUtc(wallClock: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(wallClock)) return null;

  const withSeconds = wallClock.length === 16 ? `${wallClock}:00` : wallClock;

  // Read the same digits as if they were UTC, then subtract the venue's offset
  // at that moment to recover the real instant.
  const asIfUtc = new Date(`${withSeconds}Z`);
  if (Number.isNaN(asIfUtc.getTime())) return null;

  return new Date(asIfUtc.getTime() - venueOffsetMs(asIfUtc)).toISOString();
}

/**
 * The inverse: a UTC instant as the `YYYY-MM-DDTHH:mm` an edit form expects.
 *
 * Needed so opening an existing event shows the time it actually starts rather
 * than that time shifted into the editor's own zone.
 */
export function utcToRiyadhWallClock(instant: Date | string): string {
  const {date, time} = toRiyadhParts(instant);
  return `${date}T${time}`;
}

/** Today's calendar date in Riyadh, `YYYY-MM-DD`. */
export function riyadhToday(now: Date = new Date()): string {
  return riyadhDate(now);
}

/** Is this instant inside the half-open interval `[start, end)`? */
export function isWithin(instant: Date | string, start: Date, end: Date): boolean {
  const t = (typeof instant === "string" ? new Date(instant) : instant).getTime();
  return t >= start.getTime() && t < end.getTime();
}
