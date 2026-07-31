import { describe, expect, it } from "vitest";

import {
  eventPhase,
  eventYear,
  formatEventWhen,
  formatEventYear,
  isValidSlug,
  lowSeatThreshold,
  registrationIsOpen,
  seatState,
  slugifyTitle,
} from "@/server/domain/events";
import {
  riyadhWallClockToUtc,
  utcToRiyadhWallClock,
} from "@/server/domain/riyadh-time";

/**
 * The rules behind the events programme.
 *
 * Everything here is pure, so it is tested without a database, a network or a
 * clock: `eventPhase` and friends all take `now` as an argument precisely so
 * the transitions can be pinned at their boundaries rather than inferred from
 * whenever the suite happens to run.
 */

const AT = (iso: string) => new Date(iso);

/** A two-hour evening event: 19:00-21:00 Riyadh on 12 August 2026. */
const EVENING = {
  startsAt: "2026-08-12T16:00:00.000Z",
  endsAt: "2026-08-12T18:00:00.000Z",
  datePrecision: "exact" as const,
};

describe("which side of now an event sits on", () => {
  it("is upcoming before it starts", () => {
    expect(eventPhase(EVENING, AT("2026-08-12T15:59:59Z"))).toBe("upcoming");
  });

  it("is live once it has started", () => {
    expect(eventPhase(EVENING, AT("2026-08-12T16:00:00Z"))).toBe("live");
    expect(eventPhase(EVENING, AT("2026-08-12T17:59:59Z"))).toBe("live");
  });

  /**
   * 🔴 The whole "it moves itself down the page" feature is this one assertion.
   * Keying on `startsAt` instead would drop a three-hour workshop into the
   * archive the moment its doors opened, so anybody checking the address while
   * walking to it would find it filed under history.
   */
  it("becomes past at its END, not at its start", () => {
    expect(eventPhase(EVENING, AT("2026-08-12T17:59:59Z"))).toBe("live");
    expect(eventPhase(EVENING, AT("2026-08-12T18:00:00Z"))).toBe("past");
  });

  it("closes registration once it starts, while still running", () => {
    expect(registrationIsOpen(EVENING, AT("2026-08-12T15:59:59Z"))).toBe(true);
    // Live but closed: you cannot book a seat at something already underway.
    expect(registrationIsOpen(EVENING, AT("2026-08-12T17:00:00Z"))).toBe(false);
    expect(registrationIsOpen(EVENING, AT("2026-08-13T00:00:00Z"))).toBe(false);
  });
});

describe("seats", () => {
  it("reports nothing at all when there is no limit", () => {
    expect(seatState(null, 999)).toEqual({ kind: "unlimited" });
  });

  it("stays quiet while the room is comfortably empty", () => {
    const state = seatState(30, 5);
    expect(state.kind).toBe("available");
    expect(state).toMatchObject({ left: 25, showCount: false });
  });

  it("starts counting down only when it is genuinely close", () => {
    // Al-Ma'arij seats 30, so the threshold is 8.
    expect(seatState(30, 21).kind).toBe("available");
    expect(seatState(30, 22).kind).toBe("running_low");
    expect(seatState(30, 22)).toMatchObject({ left: 8, showCount: true });
  });

  it("is full at capacity and stays full past it", () => {
    expect(seatState(30, 30)).toEqual({ kind: "full", left: 0 });
    // Over-subscription cannot happen through `event_claim_seat`, but a manual
    // row would otherwise produce a negative "seats left".
    expect(seatState(30, 34)).toEqual({ kind: "full", left: 0 });
  });

  /**
   * Urgency is a ratio, not a number. Eight left of ten is most of the room
   * still empty and announcing it reads as desperation; eight left of a hundred
   * is genuinely nearly gone.
   */
  it("scales the countdown threshold to the room", () => {
    expect(lowSeatThreshold(10)).toBe(4);
    expect(lowSeatThreshold(30)).toBe(8);
    expect(lowSeatThreshold(100)).toBe(8);
  });
});

describe("dates, as a reader in Al Khobar sees them", () => {
  it("renders an exact event with a weekday and a time, in English", () => {
    const when = formatEventWhen(EVENING, "en");
    expect(when.date).toBe("12 August 2026");
    expect(when.weekday).toBe("Wednesday");
    expect(when.time).toBe("7:00 pm");
  });

  /**
   * 🔴 Arabic must be GREGORIAN with Arabic-Indic digits.
   *
   * `ar-SA` carries region Saudi Arabia, whose ICU default calendar is
   * `islamic-umalqura`. Whether an engine applies it varies by ICU version, and
   * a server and a browser disagreeing inside one `<time>` element is a React
   * hydration mismatch, i.e. a broken page rather than a wrong date. The
   * formatter pins `-u-ca-gregory` so no engine gets to choose.
   */
  it("renders Arabic in the Gregorian calendar, in Arabic-Indic digits", () => {
    const when = formatEventWhen(EVENING, "ar");
    expect(when.date).toContain("أغسطس");
    expect(when.date).toContain("١٢");
    expect(when.date).toContain("٢٠٢٦");
    // A Hijri rendering of this date would land in Safar 1448.
    expect(when.date).not.toContain("صفر");
  });

  it("hides the time when only the day was ever recorded", () => {
    const when = formatEventWhen(
      { ...EVENING, datePrecision: "day" },
      "en"
    );
    expect(when.date).toBe("12 August 2026");
    expect(when.time).toBeNull();
    expect(when.weekday).toBeNull();
  });

  it("shows only the month when only the month was recorded", () => {
    const when = formatEventWhen(
      {
        startsAt: "2024-02-15T06:00:00.000Z",
        endsAt: "2024-02-15T18:00:00.000Z",
        datePrecision: "month",
      },
      "en"
    );
    expect(when.date).toBe("February 2024");
    expect(when.time).toBeNull();
  });

  it("compacts a two-day event inside one month", () => {
    // The real archive entry: "17-18 February" 2023.
    const when = formatEventWhen(
      {
        startsAt: "2023-02-17T06:00:00.000Z",
        endsAt: "2023-02-18T18:00:00.000Z",
        datePrecision: "day",
      },
      "en"
    );
    expect(when.date).toBe("17-18 February 2023");
  });

  it("spells out a range that crosses a month, rather than compacting it", () => {
    // "30 November-2 December" invites a misread of which month is which.
    const when = formatEventWhen(
      {
        startsAt: "2023-11-30T06:00:00.000Z",
        endsAt: "2023-12-02T18:00:00.000Z",
        datePrecision: "day",
      },
      "en"
    );
    expect(when.date).toBe("30 November 2023 - 2 December 2023");
  });

  /**
   * 🔴 The grouping key and the label are different values on purpose. Grouping
   * the Arabic archive on `٢٠٢٣` would work by accident and break the day
   * anything compared two locales' keys.
   */
  it("keeps the archive's grouping key Western in both locales", () => {
    const event = { ...EVENING, datePrecision: "day" as const };
    expect(eventYear(event)).toBe("2026");
    expect(formatEventYear(event, "en")).toBe("2026");
    expect(formatEventYear(event, "ar")).toBe("٢٠٢٦");
  });

  /**
   * A 23:00 Riyadh event is stored at 20:00Z the SAME day, but a 01:00 one is
   * stored at 22:00Z the day BEFORE. Reading the year off the UTC instant would
   * file a New Year's Eve event under the following year.
   */
  it("reads the year at the venue, not in UTC", () => {
    const newYearsEve = {
      startsAt: "2025-12-31T21:00:00.000Z", // midnight on 1 Jan in Riyadh
      endsAt: "2025-12-31T22:00:00.000Z",
      datePrecision: "exact" as const,
    };
    expect(eventYear(newYearsEve)).toBe("2026");
  });
});

describe("slugs", () => {
  it("builds an ASCII URL segment from an English title", () => {
    expect(slugifyTitle("Coffee & Sketch", "V10")).toBe("coffee-sketch-v10");
    expect(slugifyTitle("Loqma w Fayda: Zahra Al-Hussain")).toBe(
      "loqma-w-fayda-zahra-al-hussain"
    );
  });

  it("never leaves a leading or trailing hyphen", () => {
    expect(slugifyTitle("  ...Hello!  ")).toBe("hello");
    expect(slugifyTitle("Design (2024)")).toBe("design-2024");
  });

  it("accepts what the database accepts and rejects what it does not", () => {
    expect(isValidSlug("coffee-sketch-v10")).toBe(true);
    expect(isValidSlug("a")).toBe(false); // under the 2-char minimum
    expect(isValidSlug("Coffee-Sketch")).toBe(false); // uppercase
    expect(isValidSlug("coffee--sketch")).toBe(false); // doubled hyphen
    expect(isValidSlug("-coffee")).toBe(false);
    expect(isValidSlug("قهوة")).toBe(false);
  });
});

describe("the admin form's clock", () => {
  /**
   * 🔴 THE INPUT IS RIYADH TIME, NOT THE MACHINE'S TIME.
   *
   * `<input type="datetime-local">` yields a bare `YYYY-MM-DDTHH:mm` with no
   * zone, and `new Date(value)` reads it in whatever zone the computer is set
   * to. That is correct only while every person creating an event is sitting in
   * Al Khobar. This assertion is absolute, so it fails on a machine whose TZ
   * leaked into the conversion rather than passing everywhere by coincidence.
   */
  it("reads a typed time as Al-Khobar time whatever the machine says", () => {
    expect(riyadhWallClockToUtc("2026-08-12T19:00")).toBe(
      "2026-08-12T16:00:00.000Z"
    );
  });

  it("handles a time that crosses midnight backwards into UTC", () => {
    // 01:00 in Riyadh is 22:00Z the PREVIOUS day.
    expect(riyadhWallClockToUtc("2026-08-12T01:00")).toBe(
      "2026-08-11T22:00:00.000Z"
    );
  });

  it("round-trips through the edit form without drifting", () => {
    const typed = "2026-08-12T19:00";
    const stored = riyadhWallClockToUtc(typed);
    expect(stored).not.toBeNull();
    expect(utcToRiyadhWallClock(stored!)).toBe(typed);
  });

  it("refuses anything that is not a datetime-local value", () => {
    // Returning null rather than an Invalid Date is what lets the action report
    // a field error instead of storing NaN.
    expect(riyadhWallClockToUtc("")).toBeNull();
    expect(riyadhWallClockToUtc("2026-08-12")).toBeNull();
    expect(riyadhWallClockToUtc("tomorrow")).toBeNull();
    expect(riyadhWallClockToUtc("2026-13-45T99:99")).toBeNull();
  });
});
