import {MAPS_URL, WHATSAPP_NUMBER} from "@/lib/contact";
import {BOOKING, SOCIALS, ZATCA_TAX_NUMBER} from "@/lib/links";
import {absoluteUrl} from "@/lib/site";

/**
 * JSON-LD builders. Every fact here is REAL and verifiable off mazj.sa, the
 * Google Maps listing, or the ZATCA registration. Structured data that
 * describes something the page does not actually offer is a manual-action risk,
 * so nothing in this file is aspirational.
 *
 * 🔴 Deliberately absent: `aggregateRating`. MAZJ's real Google rating is 4.7
 * off a handful of reviews, but self-serving review markup (a business rating
 * itself on its own site) violates Google's structured-data policy and is
 * ineligible for rich results regardless. The rating lives on the Google
 * Business Profile, where it belongs. Do not "add the stars".
 *
 * ⚠️ `Event` markup WAS deliberately absent and is now permitted, under one
 * condition. The old ban existed because `/events` advertised three fabricated
 * entries labelled "Example" with "Date to be announced" and real host names
 * attached, and marking those up would have been invented structured data,
 * which Google penalises site-wide rather than page-by-page. The ban named its
 * own release condition: "revisit ONLY when `upcoming` holds confirmed events
 * with real ISO dates." Since 2026-07-28 events are database rows with real
 * timestamps, so `eventSchema` below is legitimate. It is emitted for
 * PUBLISHED, FUTURE events only, on their own page only.
 */

/** Stable @id for the business node, so other nodes can reference it. */
const BUSINESS_ID = `${absoluteUrl("/")}#business`;

/**
 * Stable @ids for the two named rooms. LOCALE-INDEPENDENT, exactly like
 * `BUSINESS_ID` directly above, and that is the whole point of them.
 *
 * 🔴 They were built as `${absoluteUrl(`/${locale}`)}#al-malqa`, which mints a
 * DIFFERENT identifier per locale, so the site published FOUR room entities
 * where two rooms exist: `/en#al-malqa` and `/ar#al-malqa` are two nodes as far
 * as any consumer is concerned, each describing the same six-seat room in one
 * language. An `@id` is an identity claim, not a URL to visit, which is why
 * `BUSINESS_ID` never carried the locale: MAZJ is one business described in two
 * languages, and Al-Malqa is one room described in two languages. The
 * per-locale `url` field below is where the language-specific page belongs.
 *
 * ⚠️ `makesOffer`'s `areaServed` reference must be built from these same
 * constants. Two `@id` strings that differ by a locale segment do not join two
 * nodes, they silently describe a room nobody can resolve.
 */
const ROOM_ID = {
  meeting: `${absoluteUrl("/")}#al-malqa`,
  event: `${absoluteUrl("/")}#al-maarij`,
} as const;

/** Geo pin, parsed off the real Google Maps listing in `lib/contact.ts`. */
const GEO = {latitude: 26.302126, longitude: 50.176999} as const;

type LocalBusinessInput = {
  locale: string;
  name: string;
  description: string;
  streetAddress: string;
  /**
   * The four product names IN THIS LOCALE, read from `Spaces.cards.<id>.name`
   * so the structured data says what the page says. Required rather than
   * optional on purpose: see the note on `makesOffer`.
   */
  products: {
    sharedSeat: string;
    privateOffice: string;
    meeting: string;
    event: string;
  };
};

/**
 * The sitewide LocalBusiness node. MAZJ is one physical location, which is the
 * exact case this schema exists for: it is the strongest single signal for
 * local-pack and Maps eligibility.
 */
export function localBusinessSchema({
  locale,
  name,
  description,
  streetAddress,
  products,
}: LocalBusinessInput) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": BUSINESS_ID,
    // Points at Wikidata's "coworking space" (Q97307779, label verified live
    // 2026-08-02: "shared workspace encouraging exchanges and openness").
    // schema.org has no coworking subtype, so `LocalBusiness` is as specific as
    // the vocabulary gets and this is how you say the rest. 🔴 It is also the
    // one field here aimed squarely at the measured problem: Google's AI
    // Overview named MAZJ in 0 of 6 category answers while three other
    // assistants named it, which is an entity-recognition failure rather than a
    // content one. Do not spend another hour looking for a better @type; there
    // isn't one.
    additionalType: "https://www.wikidata.org/wiki/Q97307779",
    name,
    description,
    url: absoluteUrl(`/${locale}`),
    // 🔴 `knowsLanguage`, NOT `inLanguage`. This said `inLanguage` until
    // 2026-08-02 and that property is not defined for Organization or Place:
    // schema.org lists it on BroadcastService, CommunicateAction, CreativeWork,
    // Event, LinkRole, PronounceableText and WriteAction only (checked against
    // schema.org/inLanguage, not from memory). An undefined property is
    // silently ignored rather than rejected, which is why it sat here unnoticed.
    // ⚠️ It stays correct on `eventSchema` below, because Event IS in that list.
    //
    // Both languages on both locales, deliberately: the business speaks Arabic
    // and English whichever page you are reading, so there is no branch here.
    knowsLanguage: ["ar", "en"],
    image: absoluteUrl("/images/hero-bg.jpg"),
    logo: absoluteUrl("/logos/mazj-wordmark.png"),
    address: {
      "@type": "PostalAddress",
      streetAddress,
      addressLocality: locale === "ar" ? "الخُبر" : "Al-Khobar",
      addressRegion: locale === "ar" ? "المنطقة الشرقية" : "Eastern Province",
      addressCountry: "SA",
    },
    geo: {"@type": "GeoCoordinates", ...GEO},
    hasMap: MAPS_URL,
    // WhatsApp Business line, E.164. `contact.ts` stores it digits-only for wa.me.
    telephone: `+${WHATSAPP_NUMBER}`,
    vatID: ZATCA_TAX_NUMBER,
    currenciesAccepted: "SAR",
    // Staffed reception hours. Space subscribers hold 24/7 access by QR code or
    // card, but that is a subscription benefit, not a public opening time, so it
    // is NOT marked up here: `openingHours` means "when can anyone walk in".
    // (This comment said "fingerprint" until 2026-07-28. Access is not and has
    // never been biometric; biometric data is PDPL-sensitive and the word was
    // stripped site-wide on 2026-07-23. Corrected here so it is not copied.)
    //
    // 🔴 `closes` was "21:00" until 2026-07-31 and it was WRONG: the team is in
    // the space 9 to 5, never 9 to 9. This is the one place the mistake was
    // machine-readable, so Google would have shown a walk-in "open until 9pm"
    // and sent them to a locked door for four hours a day. Keep it equal to
    // `Location.staffedValue` in both message files; nothing enforces that.
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
        opens: "09:00",
        closes: "17:00",
      },
    ],
    sameAs: [SOCIALS.instagram, SOCIALS.linkedin],
    areaServed: {
      "@type": "AdministrativeArea",
      name: locale === "ar" ? "المنطقة الشرقية" : "Eastern Province, Saudi Arabia",
    },
    // The other language's name for the same business. `sameAs` says "these
    // profiles are me"; this says "this other string is also me", which is what
    // lets an engine reading the English page resolve a query typed as `مزج` to
    // this entity rather than treating them as two businesses.
    alternateName: locale === "ar" ? "MAZJ" : "مزج",
    // Off the FAQ's own payment answer and the six acceptance marks in
    // `public/payments/`. Not aspirational: these are the methods the
    // storefront actually takes.
    paymentAccepted: "Visa, Mastercard, Mada, Tamara, Tabby",
    /**
     * 🔴 EVERY ENTRY BELOW IS QUOTED FROM COPY THAT ALREADY SHIPS, AND THE
     * OMISSIONS ARE AS DELIBERATE AS THE INCLUSIONS.
     *
     * `amenityFeature` is the field an answer engine reads to decide whether a
     * venue MEETS A REQUIREMENT ("somewhere in Khobar with a projector and
     * parking"), so it is the highest-value machine fact this node was missing.
     * It is also the easiest place on the whole site to invent something,
     * because every coworking space in the world plausibly has a printer. This
     * one has not said so anywhere, so it is not claimed here.
     *
     * Verified against `messages/*.json` on 2026-08-02, in BOTH files:
     *   - printing/scanning: `طباعة` scores **0** in Arabic and the English
     *     `print` hits are all inside the word "sprint". NOT CLAIMED.
     *   - parking: real, and narrower than it looks. The FAQ says parking is
     *     available "around the tower", not that MAZJ owns any, so the feature
     *     is worded as nearby rather than on-site.
     *   - Wi-Fi: the Arabic is `إنترنت سريع` (19 occurrences). `واي فاي` scores
     *     **0**, so writing the transliteration here would have introduced a
     *     term the site does not use.
     *   - coffee corner: the copy says `ركن القهوة` (2). `ركن قهوة` without the
     *     article scores **0**. The first draft here coined it.
     *   - lockable office: the copy says `غرفة مغلقة تخصّك` (1). Both `بمفتاح`
     *     and `تُغلق` score **0**. The first draft here coined that too.
     *
     * ⚠️ THOSE LAST TWO SHIPPED WRONG FOR ABOUT AN HOUR ON 2026-08-02, in the
     * commit that added this block, and they are the reason the verification
     * list above now covers all eleven entries rather than the three that were
     * interesting. Three terms were checked, eight were assumed, and two of the
     * eight were invented Arabic. The root `CLAUDE.md` rule is not "check the
     * words you are unsure about", it is `str.count` the existing `ar.json` for
     * every term before writing it.
     *
     * 🔴 24/7 ACCESS IS DELIBERATELY ABSENT FROM THIS LIST, AND THAT IS THE ONE
     * ENTRY MOST LIKELY TO GET "COMPLETED" BY A LATER PASS. It was here, worded
     * `24/7 access for space subscribers`, and it was wrong for a structural
     * reason rather than a factual one: `LocationFeatureSpecification` carries a
     * name and a boolean and has NO field for a condition, so a parser reads the
     * whole entry as "this building offers round-the-clock access, true" and the
     * qualifier in the label is decoration. That is the same defect as the
     * `openingHoursSpecification` eight lines above shipping `closes: 21:00`
     * against a 9-to-5 business: a machine-readable claim that sends a walk-in
     * to a locked door. The fact itself is real and survives where it can carry
     * its condition, in `Faq` "When can I get in?" in both languages, in
     * `Location.subscribersValue`, and in `/llms.txt`, which states it in a
     * sentence that can hold the qualifier.
     *
     * ⚠️ `value: true` on each is required: a `LocationFeatureSpecification`
     * with a name and no value is a feature whose availability is unstated,
     * which parsers are free to ignore. It is also why nothing conditional can
     * live in this array at all.
     */
    amenityFeature: (locale === "ar"
      ? [
          "إنترنت سريع",
          "مشروبات مجانية",
          "مساحات مشتركة وركن القهوة",
          // 🔴 The room names are the SHIPPED forms, byte-identical to
          // `Spaces.cards.<id>.name`, which is what `makesOffer` and
          // `containsPlace` already use. They read `غرفة اجتماعات (الملقى)` and
          // `قاعة فعاليات (المعارج)` until 2026-08-02: parenthesised, and with
          // the definite article dropped. Measured with python str.count over
          // the raw message files, both forms scored **0** occurrences while
          // `غرفة الاجتماعات · الملقى` and `قاعة الفعاليات · المعارج` scored 3
          // each. So one LocalBusiness node named the same room two different
          // ways, and neither of the amenity spellings existed anywhere a
          // reader could see. This is a survivor of the same pass that fixed
          // the identical string in `makesOffer` and missed this array.
          "غرفة الاجتماعات · الملقى",
          "قاعة الفعاليات · المعارج",
          "مكاتب خاصة، غرفة مغلقة تخصّك",
          "شاشة عرض وجدار للكتابة",
          "نظام صوتي",
          "استقبال خلال ساعات العمل",
          "مواقف سيارات حول المبنى",
        ]
      : [
          "Fast Wi-Fi",
          "Free drinks",
          "Shared areas and coffee corner",
          // Same correction as the Arabic above: these are the forms that ship
          // on screen (3 occurrences each), where the parenthesised ones had 0.
          "Meeting room · Al-Malqa",
          "Events hall · Al-Ma'arij",
          "Lockable private offices",
          "Presentation screen and writable wall",
          "Sound system",
          "Staffed reception during opening hours",
          "Parking around the building",
        ]
    ).map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    })),
    /**
     * The two NAMED rooms, as places inside this place.
     *
     * 🔴 `maximumAttendeeCapacity` is the single most useful number MAZJ can
     * publish for AI search, and until now it existed only inside display copy
     * ("Up to 30", "حتى 30"). "Where can I run a workshop for 25 people in
     * Al-Khobar" is a real query that an engine answers by filtering on exactly
     * this field, and a capacity buried in a sentence is a capacity that has to
     * be inferred rather than read.
     *
     * ⚠️ The numbers are LITERALS here rather than parsed out of the message
     * files, and that is the safer of two bad options. The copy strings are
     * `"Up to 6 · by the hour"` in English and `"حتى 6 · بالساعة"` in Arabic,
     * so extracting an integer means parsing prose in two scripts around a
     * middle dot. These are facts about the building, so they sit beside `GEO`
     * with the other structural constants, and `test/schema-facts.test.ts`
     * asserts they still match the `facts` blocks in both message files.
     *
     * ⚠️ The Arabic really does use a WESTERN `6`, not `٦`. An earlier version
     * of this comment claimed Arabic-Indic numerals and used that as half its
     * justification; measured across all 705 Arabic strings, the capacities and
     * every other figure here are Western digits. The reasoning above stands
     * without it, but a rationale nobody checked is exactly the kind this repo
     * has been bitten by, so it is corrected rather than quietly dropped.
     *
     * `MeetingRoom` and `EventVenue` are both real schema.org types, so this is
     * more specific than a bare `Place` without asserting anything extra.
     *
     * 🔴 EACH ROOM CARRIES A STABLE `@id`, AND `makesOffer` BELOW REFERENCES IT.
     * Without that the same room is described twice with nothing connecting the
     * two descriptions: once here as a place seating six, once below as a
     * service called "Meeting room". An extractor listing MAZJ's rooms can then
     * legitimately count four where there are two, and neither entry carries
     * the other's information. The `@id` is what makes them one node.
     */
    containsPlace: [
      {
        "@type": "MeetingRoom",
        "@id": ROOM_ID.meeting,
        name: locale === "ar" ? "الملقى" : "Al-Malqa",
        description:
          locale === "ar"
            ? "غرفة اجتماعات تتسع حتى ستة أشخاص، وتُحجز بالساعة."
            : "Meeting room seating up to six, booked by the hour.",
        maximumAttendeeCapacity: 6,
        // 🔴 The room's DESCRIPTIVE page, not its Book route. `BOOKING.meeting`
        // would have been the obvious reuse and it is wrong here: since
        // 2026-08-01 those four paths 307 straight out to mazj.sa, so a `url`
        // built from them names a redirect rather than a page about the room.
        // `makesOffer` below legitimately still uses them, because an Offer's
        // url IS where the thing is transacted.
        url: absoluteUrl(`/${locale}/spaces/meeting-room`),
      },
      {
        "@type": "EventVenue",
        "@id": ROOM_ID.event,
        name: locale === "ar" ? "المعارج" : "Al-Ma'arij",
        description:
          locale === "ar"
            ? "قاعة فعاليات تتسع حتى ثلاثين شخصاً، مع شاشة ونظام صوتي."
            : "Events hall seating up to thirty, with a screen and sound system.",
        maximumAttendeeCapacity: 30,
        url: absoluteUrl(`/${locale}/spaces/event-hall`),
      },
    ],
    // The four products, each pointing at its on-site booking page. No `price`
    // is asserted: prices are live from Rekaz and a stale one in schema is worse
    // than none.
    //
    // 🔴 `absoluteUrl` + the locale, because `BOOKING` holds RELATIVE paths since
    // booking moved on-site. A relative `url` in JSON-LD is invalid: Google
    // cannot resolve it without a base, so the offer is dropped or misattributed.
    // Every other URL in this file is already absolute; these were the only ones
    // that silently became relative.
    //
    // 🔴 THE NAMES ARE PASSED IN PER LOCALE, AND THEY USED TO BE FOUR ENGLISH
    // LITERALS. Measured 2026-08-02: `Open desk`, `Private office`,
    // `Meeting room (Al-Malqa)` and `Events hall (Al-Ma'arij)` were emitted on
    // all 13 ARABIC routes as well as the English ones, so the machine-readable
    // description of what MAZJ sells was English-only on the exact half of the
    // site that holds the ranking equity, and the two room names never
    // registered in Arabic at all. The literals did not even match the site's
    // own English: schema said `Meeting room (Al-Malqa)` where every visible
    // surface says `Meeting room · Al-Malqa`. They now come from
    // `Spaces.cards.<id>.name`, which is the string on screen in both locales.
    //
    // ⚠️ Which means this function can no longer be called without the `Spaces`
    // namespace. That is the point: an offer named in the wrong language is a
    // silent defect, and a required argument is the only thing that makes it a
    // compile error instead.
    makesOffer: [
      {name: products.sharedSeat, path: BOOKING.sharedSeat, room: null},
      {name: products.privateOffice, path: BOOKING.privateOffice, room: null},
      // The two named rooms ALSO exist as places in `containsPlace` above.
      // `itemOffered` references that node by `@id` rather than restating it,
      // so the room and the thing you can book are one entity rather than two
      // descriptions an extractor has to guess are the same.
      {name: products.meeting, path: BOOKING.meeting, room: ROOM_ID.meeting},
      {name: products.event, path: BOOKING.event, room: ROOM_ID.event},
    ].map((o) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: o.name,
        // The reference is now the ROOM_ID constant itself rather than a
        // locale-prefixed string rebuilt here. Rebuilding it was how the two
        // sides drifted in the first place.
        ...(o.room ? {areaServed: {"@id": o.room}} : {}),
      },
      url: absoluteUrl(`/${locale}${o.path}`),
      priceCurrency: "SAR",
    })),
  };
}

/**
 * The `WebSite` node: says that this site IS the business's site, and that the
 * business publishes it.
 *
 * Small on its own. It exists because the entity signal is where MAZJ measurably
 * loses: on 2026-08-02 Google's AI Overview named MAZJ in **0 of 6** category
 * answers while Gemini, ChatGPT and Perplexity all named it, several in first
 * place. Both Google surfaces read the same Business Profile, so that is a
 * recognition gap rather than a content gap, and `publisher` plus a stable
 * `@id` is the cheapest thing in the vocabulary that addresses it.
 *
 * 🔴 NO `potentialAction` / `SearchAction`, and that omission is deliberate and
 * permanent. The sitelinks-searchbox markup is the single most copy-pasted
 * snippet in SEO and it declares that a site has a search endpoint. **This site
 * has no search of any kind.** Declaring one is invented structured data, which
 * the header of this file records as a site-wide penalty risk rather than a
 * page-scoped one. A later pass will want to add it. Do not.
 *
 * ⚠️ Nor a separate `Organization` node. `LocalBusiness` already descends from
 * `Organization`, so a second one is a duplicate entity claiming to be the same
 * company, which is worse than having none. `publisher` references the existing
 * node by `@id` instead.
 *
 * ⚠️ `foundingDate` was proposed for the business node and REJECTED on
 * 2026-08-02, on the same test. The argument for it was that "since 2022" ships
 * in five strings per language, which is true and was verified. But every one of
 * those says MAZJ has HOSTED EVENTS since 2022, and `foundingDate` is when the
 * COMPANY was founded. A business can be registered a year before it opens its
 * doors. Nothing in this repo knows the incorporation date, so filling that
 * field would be inferring a corporate fact from an operational one, which is
 * exactly what this file refuses to do everywhere else.
 */
export function websiteSchema(locale: string, name: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    url: absoluteUrl(`/${locale}`),
    name,
    alternateName: locale === "ar" ? "MAZJ" : "مزج",
    inLanguage: ["ar", "en"],
    publisher: {"@id": BUSINESS_ID},
  };
}

/**
 * FAQPage, built from the `Faq` namespace's grouped Q&A pairs.
 * Google requires the marked-up answer to be VISIBLE on the page, which it is:
 * the accordion ships every answer in the HTML and only collapses it in CSS/JS.
 */
export function faqPageSchema(items: {q: string; a: string}[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({q, a}) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {"@type": "Answer", text: a},
    })),
  };
}

/**
 * BreadcrumbList for the `/spaces/*` detail pages, which sit three levels deep
 * with no on-page breadcrumb UI to signal the hierarchy.
 */
export function breadcrumbSchema(
  locale: string,
  trail: {name: string; path: string}[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map(({name, path}, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: absoluteUrl(`/${locale}${path}`),
    })),
  };
}

/**
 * One MAZJ event, for its own page.
 *
 * 🔴 EMITTED ONLY FOR A PUBLISHED, FUTURE EVENT. Read the note at the top of
 * this file before relaxing that. Google treats structured data describing an
 * event that does not exist as spam, and the penalty lands on the whole domain
 * rather than the page. A past event earns no rich result anyway, so there is
 * nothing to gain by marking one up and a real penalty available for getting it
 * wrong.
 *
 * `location` references the sitewide LocalBusiness node by `@id` rather than
 * restating the address. One address, described once, in one place: a second
 * copy is a second thing to keep true.
 *
 * `offers` is included ONLY when the event actually sells a ticket, and its
 * `price` is the LIVE Rekaz figure the page is displaying at that moment, never
 * the stored snapshot. Marking up a price the buyer is not charged is the fast
 * route to a Merchant listing suspension.
 */
export function eventSchema({
  locale,
  name,
  description,
  startsAt,
  endsAt,
  path,
  image,
  performer,
  offer,
  location,
}: {
  locale: string;
  name: string;
  description: string;
  /** ISO 8601 with an offset. */
  startsAt: string;
  endsAt: string;
  /** Locale-less, e.g. `/events/coffee-sketch-v10`. */
  path: string;
  image?: string | null;
  performer?: string | null;
  offer?: {price: number; url: string} | null;
  /**
   * Where the event is actually held, IN THIS LOCALE, when it is not at MAZJ.
   * `null` or absent means MAZJ, which is the overwhelmingly common case.
   *
   * 🔴 Passing this is not optional politeness. `/admin` has always let an
   * operator type a venue and the page has always printed it, while this
   * function hardcoded MAZJ regardless. So the first event MAZJ hosts at a
   * partner venue, a university or a hotel would have told Google, Apple Maps
   * and every assistant that it is at Al Hayat Tower, while the page a human
   * reads says otherwise. Dormant today only because no upcoming event exists.
   */
  location?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": absoluteUrl(`/${locale}${path}`),
    name,
    description,
    startDate: startsAt,
    endDate: endsAt,
    // Both are required for a valid Event and both are genuinely true of MAZJ:
    // people turn up to a room in Al-Khobar, and it is scheduled rather than
    // rescheduled or moved online.
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    inLanguage: locale === "ar" ? "ar-SA" : "en-US",
    url: absoluteUrl(`/${locale}${path}`),
    // 🔴 A NAME AND NOTHING ELSE FOR AN OFF-SITE VENUE, DELIBERATELY.
    //
    // `Place` accepts an `address`, and the obvious next step is to fill one
    // in. Do not. MAZJ cannot verify a third party's postal address, and a
    // guessed one is invented structured data, which this file's own header
    // records as a SITE-WIDE penalty risk rather than a page-scoped one. A bare
    // name is honest, is valid, and is what MAZJ actually knows. The reader
    // gets the venue name and can search it; that is strictly better than being
    // sent to the wrong building with confidence.
    //
    // When there is no override the event IS at MAZJ, so it references the
    // sitewide LocalBusiness node by `@id` rather than restating the address.
    // One address, described once.
    location: location
      ? {"@type": "Place", name: location}
      : {"@id": BUSINESS_ID},
    // ⚠️ `organizer` stays MAZJ either way, and that is correct rather than an
    // oversight: MAZJ runs the event, the venue only houses it. A hall rented
    // from someone else does not make them the organiser.
    organizer: {"@id": BUSINESS_ID},
    ...(image ? {image} : {}),
    ...(performer ? {performer: {"@type": "Person", name: performer}} : {}),
    ...(offer
      ? {
          offers: {
            "@type": "Offer",
            price: offer.price,
            priceCurrency: "SAR",
            url: offer.url,
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };
}
