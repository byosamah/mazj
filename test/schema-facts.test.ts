import {readFileSync} from "node:fs";

import {describe, expect, it} from "vitest";

import {eventSchema, localBusinessSchema} from "@/lib/schema";

/**
 * The `LocalBusiness` node states machine-readable FACTS. This file pins the
 * ones that can silently stop being true.
 *
 * Structured data is the one surface where being wrong is worse than being
 * absent: a human reading a stale capacity on a page can see the rest of the
 * page and judge it, while an answer engine reads the number alone and repeats
 * it as fact. `lib/schema.ts`'s own header already refuses `aggregateRating` on
 * that reasoning. These tests extend it to the fields added on 2026-08-02.
 *
 * 🔴 THE CAPACITY TEST IS THE POINT OF THIS FILE. `maximumAttendeeCapacity` is
 * hardcoded in `lib/schema.ts` (parsing "Up to 6" and "حتى 6" out of display
 * prose in two scripts is worse), and the comment there said in as many words
 * that nothing enforced agreement with the copy. That sentence is the same
 * shape as the one `openingHoursSpecification` carried on the day it was
 * shipping 9-to-9 against a 9-to-5 business. So: something enforces it now.
 */

type Json = string | number | boolean | null | Json[] | {[k: string]: Json};

const en = JSON.parse(readFileSync("messages/en.json", "utf8")) as Record<string, Json>;
const ar = JSON.parse(readFileSync("messages/ar.json", "utf8")) as Record<string, Json>;

function schemaFor(locale: "en" | "ar") {
  const messages = locale === "ar" ? ar : en;
  const meta = messages.Meta as Record<string, string>;
  const location = messages.Location as Record<string, string>;
  const cards = (messages.Spaces as Record<string, Json>).cards as Record<
    string,
    {name: string}
  >;
  return localBusinessSchema({
    locale,
    name: meta.siteName,
    description: meta.description,
    streetAddress: location.address,
    // Read from the message file exactly as the layout does, so this test
    // exercises the real strings rather than fixtures.
    products: {
      sharedSeat: cards.openDesk.name,
      privateOffice: cards.privateOffice.name,
      meeting: cards.meetingRoom.name,
      event: cards.eventHall.name,
    },
  }) as Record<string, Json>;
}

/** Every `label=value` fact string a namespace publishes. */
function factValues(messages: Record<string, Json>, namespace: string): string[] {
  const ns = messages[namespace] as Record<string, Json>;
  return (ns.facts as {label: string; value: string}[]).map((f) => f.value);
}

describe.each(["en", "ar"] as const)("LocalBusiness (%s)", (locale) => {
  const schema = schemaFor(locale);

  it("🔴 states a room capacity that the copy also states", () => {
    const rooms = schema.containsPlace as {
      name: string;
      maximumAttendeeCapacity: number;
    }[];
    const messages = locale === "ar" ? ar : en;

    // Meeting room: 6. Events hall: 30. Both must appear as a bare integer in
    // that space's own `facts` block, in this locale. Both message files write
    // these in Latin digits today ("Up to 6" / "حتى 6"); if a future Arabic pass
    // moves them to Arabic-Indic (`٦`) this fails, which is the correct
    // outcome, because the schema would then be the only place the Latin
    // numeral survived and nobody would have checked it.
    const expected: [string, number][] = [
      ["SpaceMeeting", 6],
      ["SpaceEventHall", 30],
    ];

    for (const [namespace, capacity] of expected) {
      const room = rooms.find((r) => r.maximumAttendeeCapacity === capacity);
      expect(room, `no room in containsPlace with capacity ${capacity}`).toBeDefined();

      const stated = factValues(messages, namespace).some((v) =>
        new RegExp(`\\b${capacity}\\b`).test(v)
      );
      expect(
        stated,
        `schema says ${namespace} holds ${capacity} but no fact in ${namespace} says so`
      ).toBe(true);
    }
  });

  it("names both rooms in this locale's own script", () => {
    const rooms = schema.containsPlace as {name: string; "@type": string}[];
    const names = rooms.map((r) => r.name);

    expect(rooms.map((r) => r["@type"])).toEqual(["MeetingRoom", "EventVenue"]);
    expect(names).toEqual(
      locale === "ar" ? ["الملقى", "المعارج"] : ["Al-Malqa", "Al-Ma'arij"]
    );
  });

  it("🔴 claims no amenity the site does not mention", () => {
    // The failure mode being guarded is a plausible amenity nobody verified.
    // Printing is the canonical one: every coworking space seems to have a
    // printer, MAZJ has never said it does, and `طباعة` scores 0 in Arabic
    // while every English `print` hit is inside the word "sprint".
    const features = (schema.amenityFeature as {name: string; value: boolean}[]).map(
      (f) => f.name.toLowerCase()
    );

    for (const unclaimed of ["print", "scan", "phone booth", "gym", "shower", "lounge"]) {
      expect(
        features.some((f) => f.includes(unclaimed)),
        `amenityFeature claims "${unclaimed}", which appears nowhere in the copy`
      ).toBe(false);
    }
    // And a canary, so the loop above cannot pass by describing an empty list.
    expect(features.length).toBeGreaterThan(8);
    for (const feature of schema.amenityFeature as {value: boolean}[]) {
      // A feature with no value is a feature whose availability is unstated.
      expect(feature.value).toBe(true);
    }
  });

  it("🔴 still refuses aggregateRating and any price claim", () => {
    // Self-serving review markup violates Google's structured-data policy, and
    // MAZJ's real rating (4.7) lives on its Google Business Profile. `priceRange`
    // would be a price on a marketing surface, which TONE.md forbids, and every
    // real figure is quoted live at the storefront.
    expect(schema.aggregateRating).toBeUndefined();
    expect(schema.priceRange).toBeUndefined();
    expect(schema.review).toBeUndefined();

    for (const offer of schema.makesOffer as Record<string, Json>[]) {
      expect(offer.price, "an Offer asserts a price the site does not show").toBeUndefined();
    }
  });

  it("resolves to the other language's name, so both spellings are one entity", () => {
    expect(schema.alternateName).toBe(locale === "ar" ? "MAZJ" : "مزج");
  });

  it("🔴 names the products in THIS locale, not in English on the Arabic pages", () => {
    // Four English literals shipped on all 13 Arabic routes until 2026-08-02,
    // so the machine-readable description of what MAZJ sells was English-only
    // on the half of the site holding the ranking equity.
    const messages = locale === "ar" ? ar : en;
    const cards = (messages.Spaces as Record<string, Json>).cards as Record<
      string,
      {name: string}
    >;
    const offered = (schema.makesOffer as {itemOffered: {name: string}}[]).map(
      (o) => o.itemOffered.name
    );

    expect(offered).toEqual([
      cards.openDesk.name,
      cards.privateOffice.name,
      cards.meetingRoom.name,
      cards.eventHall.name,
    ]);

    if (locale === "ar") {
      // A cheap, script-level canary: no offer name may be pure Latin.
      for (const name of offered) {
        expect(/[؀-ۿ]/.test(name), `"${name}" carries no Arabic`).toBe(true);
      }
    }
  });

  it("🔴 makes no amenity claim that depends on a condition", () => {
    // `LocationFeatureSpecification` is a name plus a boolean and has NO field
    // for a qualifier, so "24/7 access FOR SUBSCRIBERS" is read as "this
    // building offers 24/7 access, true". That is the openingHoursSpecification
    // 9-to-9 defect in a different field: a machine-readable claim that sends a
    // walk-in to a locked door. The fact lives in the FAQ, where a sentence can
    // hold the condition.
    const names = (schema.amenityFeature as {name: string}[]).map((f) => f.name);

    // ⚠️ The Arabic marker is the PREFIXED form `لمشتركي` / `للمشتركين` ("for
    // subscribers"), never the bare root `مشترك`. That root is a substring of
    // `مشتركة` ("shared"), which is settled, legitimate vocabulary and appears
    // in `مساحات مشتركة وركن القهوة`. Sweeping by the bare root failed this
    // test against correct data on the first run.
    for (const conditional of [
      "24/7",
      "24 / 7",
      "مدار الساعة",
      "subscriber",
      "لمشتركي",
      "للمشتركين",
    ]) {
      expect(
        names.some((n) => n.includes(conditional)),
        `amenityFeature carries the conditional claim "${conditional}"`
      ).toBe(false);
    }
  });

  it("links each named room to the offer that sells it, so it is one entity", () => {
    const rooms = schema.containsPlace as {"@id": string; name: string}[];
    const offers = schema.makesOffer as {
      itemOffered: {name: string; areaServed?: {"@id": string}};
    }[];
    const roomIds = new Set(rooms.map((r) => r["@id"]));

    expect(roomIds.size).toBe(2);
    const referenced = offers
      .map((o) => o.itemOffered.areaServed?.["@id"])
      .filter(Boolean) as string[];

    expect(referenced).toHaveLength(2);
    for (const id of referenced) {
      expect(roomIds.has(id), `offer references ${id}, which no room declares`).toBe(true);
    }
  });

  it("keeps every URL absolute and locale-prefixed", () => {
    // A relative URL in JSON-LD cannot be resolved without a base, so Google
    // drops or misattributes the node. This already bit `makesOffer` once when
    // BOOKING became relative paths.
    const urls = [
      ...(schema.containsPlace as {url: string}[]).map((r) => r.url),
      ...(schema.makesOffer as {url: string}[]).map((o) => o.url),
      schema.url as string,
    ];

    for (const url of urls) {
      expect(url.startsWith("http"), `${url} is not absolute`).toBe(true);
      expect(new URL(url).pathname.startsWith(`/${locale}`), `${url} lacks /${locale}`).toBe(
        true
      );
    }
  });

  it("🔴 keeps opening hours equal to the copy, which is where 9-to-9 once shipped", () => {
    const messages = locale === "ar" ? ar : en;
    const location = messages.Location as Record<string, string>;
    const hours = (schema.openingHoursSpecification as Record<string, Json>[])[0];

    // The staffed-hours string is the human copy; these two fields are what
    // Google reads. They disagreed once, in the direction of sending walk-ins
    // to a locked door for four hours a day.
    expect(hours.opens).toBe("09:00");
    expect(hours.closes).toBe("17:00");
    expect(location.staffedValue).toMatch(/9/);
    expect(location.staffedValue).toMatch(/5/);
    expect(location.staffedValue).not.toMatch(/\b21\b|9\s*pm|٩\s*مساء/);
  });
});

/**
 * Where an event says it is held.
 *
 * 🔴 THIS IS A DORMANT BUG'S TRIPWIRE. `/admin` has always let an operator type
 * a venue and the event page has always printed it, while `eventSchema`
 * hardcoded MAZJ regardless, so the first event held at a partner venue would
 * have told Google, Apple Maps and every assistant that it is at Al Hayat Tower
 * while the page said otherwise. Nothing failed, because no upcoming event
 * exists to expose it. That is exactly the shape of defect that ships.
 */
describe("eventSchema location", () => {
  const base = {
    locale: "en",
    name: "Coffee & Sketch",
    description: "A drawing evening.",
    startsAt: "2026-09-01T18:00:00+03:00",
    endsAt: "2026-09-01T21:00:00+03:00",
    path: "/events/coffee-sketch",
  };

  it("references the MAZJ business node when no venue is given", () => {
    for (const input of [base, {...base, location: null}, {...base, location: ""}]) {
      const schema = eventSchema(input) as unknown as Record<string, Json>;
      const loc = schema.location as Record<string, string>;

      expect(loc["@id"], "an event at MAZJ must reference the LocalBusiness node").toContain(
        "#business"
      );
      expect(loc["@type"]).toBeUndefined();
    }
  });

  it("names an off-site venue instead of claiming the event is at MAZJ", () => {
    const schema = eventSchema({
      ...base,
      location: "King Fahd University of Petroleum and Minerals",
    }) as unknown as Record<string, Json>;
    const loc = schema.location as Record<string, string>;

    expect(loc["@type"]).toBe("Place");
    expect(loc.name).toBe("King Fahd University of Petroleum and Minerals");
    expect(loc["@id"], "an off-site venue must NOT reference MAZJ's node").toBeUndefined();
  });

  it("🔴 asserts NO address for an off-site venue, ever", () => {
    // `Place` accepts an address and filling one in is the obvious next step.
    // MAZJ cannot verify a third party's postal address, and a guessed one is
    // invented structured data, which lib/schema.ts's header records as a
    // SITE-WIDE penalty risk. A bare name is honest and valid.
    const loc = (eventSchema({...base, location: "Some Hotel Ballroom"}) as unknown as Record<
      string,
      Json
    >).location as Record<string, Json>;

    expect(loc.address).toBeUndefined();
    expect(loc.geo).toBeUndefined();
    expect(Object.keys(loc).sort()).toEqual(["@type", "name"]);
  });

  it("keeps MAZJ as the organizer even when the venue is someone else's", () => {
    // MAZJ runs the event; the venue only houses it. Renting a hall does not
    // make the landlord the organiser.
    const schema = eventSchema({...base, location: "Some Hotel Ballroom"}) as unknown as Record<
      string,
      Json
    >;

    expect((schema.organizer as Record<string, string>)["@id"]).toContain("#business");
  });
});
