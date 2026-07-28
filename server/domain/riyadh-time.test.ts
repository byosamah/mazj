import { describe, expect, it } from "vitest";

import {
  isWithin,
  riyadhDate,
  riyadhDayRangeUtc,
  riyadhTime,
  riyadhToday,
  toRiyadhParts,
} from "./riyadh-time";

/**
 * Saudi Arabia is UTC+3 with no daylight saving, so every expectation below is
 * a fixed three-hour shift. That is easy to verify by hand, which is the point:
 * a timezone helper whose tests you cannot check mentally is a timezone helper
 * you cannot trust.
 */

describe("toRiyadhParts", () => {
  it("shifts a UTC instant forward three hours", () => {
    const parts = toRiyadhParts("2026-07-27T06:00:00Z");
    expect(parts.date).toBe("2026-07-27");
    expect(parts.time).toBe("09:00");
  });

  it("🔴 rolls the DATE forward for a late-evening UTC instant", () => {
    // 22:00Z is already tomorrow in Riyadh. The events hall books until 24:00
    // local, so this is a real booking time, not a contrived one, and getting
    // it wrong files a reservation under the previous day.
    const parts = toRiyadhParts("2026-07-27T22:00:00Z");
    expect(parts.date).toBe("2026-07-28");
    expect(parts.time).toBe("01:00");
  });

  it("renders midnight as 00:00, never 24:00", () => {
    // `hour: "2-digit"` with hour12:false yields "24" in some engines, which
    // would print "24:00" on the dashboard and sort wrongly as a string.
    expect(toRiyadhParts("2026-07-27T21:00:00Z").time).toBe("00:00");
  });

  it("reports the weekday as read in Riyadh", () => {
    // 2026-07-27 is a Monday.
    expect(toRiyadhParts("2026-07-27T09:00:00Z").weekday).toBe("Mon");
    // 21:00Z Sunday is already Monday 00:00 locally.
    expect(toRiyadhParts("2026-07-26T21:00:00Z").weekday).toBe("Mon");
  });

  it("accepts a Date as readily as a string", () => {
    const iso = "2026-07-27T06:00:00Z";
    expect(toRiyadhParts(new Date(iso))).toEqual(toRiyadhParts(iso));
  });
});

describe("riyadhDayRangeUtc", () => {
  it("🔴 starts a day at 21:00Z the PREVIOUS day", () => {
    // The whole reason this function exists. A UTC-derived "today" starts at
    // 03:00 Riyadh, so between midnight and 3am local the dashboard would show
    // yesterday's bookings and label them today's.
    const { start, end } = riyadhDayRangeUtc("2026-07-27");
    expect(start.toISOString()).toBe("2026-07-26T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-27T21:00:00.000Z");
  });

  it("spans exactly 24 hours", () => {
    const { start, end } = riyadhDayRangeUtc("2026-07-27");
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("produces a range whose every instant reads as that Riyadh day", () => {
    const day = "2026-07-27";
    const { start, end } = riyadhDayRangeUtc(day);

    expect(riyadhDate(start)).toBe(day);
    // The end is exclusive, so one millisecond before it is still the day and
    // the end itself is already the next.
    expect(riyadhDate(new Date(end.getTime() - 1))).toBe(day);
    expect(riyadhDate(end)).toBe("2026-07-28");
  });

  it("gives consecutive days that abut without gap or overlap", () => {
    // A gap loses a booking; an overlap counts it twice. Both are silent.
    expect(riyadhDayRangeUtc("2026-07-27").end.toISOString()).toBe(
      riyadhDayRangeUtc("2026-07-28").start.toISOString()
    );
  });

  it("handles a month boundary", () => {
    const { start } = riyadhDayRangeUtc("2026-08-01");
    expect(start.toISOString()).toBe("2026-07-31T21:00:00.000Z");
  });
});

describe("isWithin", () => {
  const { start, end } = riyadhDayRangeUtc("2026-07-27");

  it("includes the start and excludes the end", () => {
    // Half-open. A booking landing exactly on midnight belongs to one day, not
    // to both and not to neither.
    expect(isWithin(start, start, end)).toBe(true);
    expect(isWithin(end, start, end)).toBe(false);
    expect(isWithin(new Date(end.getTime() - 1), start, end)).toBe(true);
  });

  it("excludes instants outside the range", () => {
    expect(isWithin("2026-07-26T20:59:59Z", start, end)).toBe(false);
    expect(isWithin("2026-07-28T00:00:00Z", start, end)).toBe(false);
  });
});

describe("riyadhTime and riyadhDate", () => {
  it("agree with toRiyadhParts", () => {
    const iso = "2026-07-27T15:30:00Z";
    const parts = toRiyadhParts(iso);
    expect(riyadhTime(iso)).toBe(parts.time);
    expect(riyadhDate(iso)).toBe(parts.date);
    expect(riyadhTime(iso)).toBe("18:30");
  });
});

describe("riyadhToday", () => {
  it("uses the injected clock rather than the wall clock", () => {
    // Injectable so the dashboard's "today" can be tested at all. Without it
    // every test of a date-dependent view would be time-of-day dependent.
    expect(riyadhToday(new Date("2026-07-27T22:00:00Z"))).toBe("2026-07-28");
    expect(riyadhToday(new Date("2026-07-27T06:00:00Z"))).toBe("2026-07-27");
  });
});
