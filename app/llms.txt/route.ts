import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import {MAPS_URL, WHATSAPP_NUMBER} from "@/lib/contact";
import {
  flattenForMachines,
  normalizeArabicForMachines,
} from "@/lib/machine-text";
import {SOCIALS, ZATCA_TAX_NUMBER} from "@/lib/links";
import {INDEXABLE_ROUTES} from "@/lib/routes";
import {IS_PRELAUNCH_ORIGIN, absoluteUrl} from "@/lib/site";

/**
 * `/llms.txt` (llmstxt.org): a short, plain-text brief for AI assistants and
 * agents that arrive without a browser.
 *
 * WHY A ROUTE HANDLER RATHER THAN A FILE IN `public/`
 *
 * A static `public/llms.txt` cannot read `messages/*.json` or `SITE_URL`, so it
 * goes stale the first time anyone edits a product name, the hours or the
 * address, and nothing reports it. That is the exact failure this repo keeps
 * paying for elsewhere (a rationale written from memory of what the copy MEANT
 * rather than from a grep). Everything below is DERIVED. The only prose held
 * here is prose that describes the file itself.
 *
 * 🔴 THE ONE THING THIS FILE DOES THAT NOTHING ELSE ON THE SITE DOES: IT SERVES
 * THE ARABIC WITH ITS TYPOGRAPHY REMOVED.
 *
 * `messages/ar.json` carries 162 `U+0640` tatweels across 46 keys, a deliberate,
 * owner-ruled, font-verified house standard pinned by `test/arabic-kashida.test.ts`.
 * On screen each one is a drawn swash and it is correct. In a text stream it is
 * a literal character sitting inside the word, so `المشتـــــرك` is not the
 * string `المشترك`, and every Arabic page `h1` on this site therefore fails to
 * match its own topic. Measured 2026-08-02 across the 11 Arabic routes: 186
 * tatweels in the rendered visible text, 46 distinct broken word-forms, 30 of
 * which appear ONLY in broken form on their page. The same applies to the damma
 * in `الخُبر`: the bare `الخبر` that a Saudi buyer actually types appears ZERO
 * times anywhere in `messages/ar.json` or in the served HTML.
 *
 * Classical search normalises both away (stripping tatweel and harakat is step
 * one of any Arabic IR pipeline, and Google does it), so this costs MAZJ
 * nothing in Google. Language models do NOT normalise: the strings tokenise
 * differently, and an assistant quoting an Arabic heading quotes the broken
 * form into its own answer.
 *
 * So `normalizeAr` below is NOT a fix applied to the site. The design is
 * untouched and must stay untouched: `DESIGN.md` and the kashida test own it,
 * and changing it is an owner ruling, not a refactor. This is a second,
 * machine-only channel carrying the same facts in a form a tokenizer can read.
 * ⚠️ That is legitimate precisely because the content is IDENTICAL and the file
 * is unlinked from the interface. Serving DIFFERENT content to crawlers is
 * cloaking; serving the same content without decoration is not.
 *
 * ⚠️ Prices are deliberately absent, and that is a `TONE.md` ruling rather than
 * an oversight, so the "Booking" section names the unit each product is sold in
 * and points at the storefront that quotes the number. An agent comparing
 * venues needs to know WHAT is sold and WHERE the price lives; inventing one
 * here would be worse than omitting it.
 */

/** Route handlers are dynamic by default; this one is pure data. */
export const dynamic = "force-static";
export const revalidate = 86400;

/**
 * 🔴 Both live in `lib/machine-text.ts`, not here, and the reason is that
 * `normalizeArabicForMachines` is genuinely subtle: a tatweel is decoration
 * when an Arabic letter follows it and correct orthography when a digit or a
 * Latin character does (`لـ30`, `الـIP`). A second copy of that rule in
 * `/pricing.md` would drift. Read that module's docblock before changing
 * either, and never point it at rendered copy.
 */
const normalizeAr = normalizeArabicForMachines;
const flat = flattenForMachines;

/** Every product, as a machine-comparable row. No prices: see the docblock. */
const PRODUCTS = [
  {key: "openDesk", path: "/spaces/coworking"},
  {key: "privateOffice", path: "/spaces/private-office"},
  {key: "meetingRoom", path: "/spaces/meeting-room"},
  {key: "eventHall", path: "/spaces/event-hall"},
] as const;

/**
 * One line per indexable route, in both languages, built from the SAME table
 * `app/sitemap.ts` reads. A route added to `lib/routes.ts` appears here with no
 * further edit, which is the whole point of deriving it.
 */
function routeLines(): string {
  return INDEXABLE_ROUTES.map(({path}) => {
    const ns = NAMESPACE_BY_PATH[path];
    const e = ns ? EN[ns] : undefined;
    const a = ns ? AR[ns] : undefined;
    const label = str(e?.metaTitle) || str(e?.title) || path;
    const arLabel = str(a?.metaTitle) || str(a?.title);
    const blurb = str(e?.metaDescription) || str(e?.intro);
    return [
      `- [${flat(label)}](${absoluteUrl(`/en${path}`)})${
        blurb ? `: ${flat(blurb)}` : ""
      }`,
      `- [${normalizeAr(arLabel)}](${absoluteUrl(`/ar${path}`)}) (Arabic)`,
    ].join("\n");
  }).join("\n");
}

/**
 * ⚠️ `as unknown as` on purpose, not laziness. `resolveJsonModule` gives these
 * imports a precise literal type per namespace, and a namespace holding a
 * nested object (`SpaceFinder.cases`) is genuinely not assignable to a flat
 * record, so a direct cast is a type error rather than a widening. Reading a
 * namespace generically is exactly what this file needs to do, and `str()`
 * below re-narrows every value at the point of use, so nothing is assumed.
 */
type Messages = Record<string, Record<string, unknown> | undefined>;
const EN = en as unknown as Messages;
const AR = ar as unknown as Messages;

/** A message value, if it really is a string. Empty string otherwise. */
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * 🔴 Hand-maintained, because there is no mapping from a route to its i18n
 * namespace anywhere in the codebase and inventing a `path.replace()` heuristic
 * would break on `/spaces/private-office` -> `SpaceOffice`, which shares no
 * substring with its path. If this map and `lib/routes.ts` disagree the route
 * still lists, it just lists with a bare path instead of a title, so the
 * failure is cosmetic rather than a crash.
 */
const NAMESPACE_BY_PATH: Record<string, string> = {
  "": "Meta",
  "/spaces": "SpacesPage",
  "/spaces/coworking": "SpaceCoworking",
  "/spaces/private-office": "SpaceOffice",
  "/spaces/meeting-room": "SpaceMeeting",
  "/spaces/event-hall": "SpaceEventHall",
  "/events": "EventsPage",
  "/startups": "Startups",
  "/about": "AboutPage",
  "/contact": "ContactPage",
  "/faq": "FaqPage",
};

function build(): string {
  const meta = en.Meta;
  const arMeta = ar.Meta;
  const loc = en.Location;
  const arLoc = ar.Location;
  const cards = en.Spaces.cards as Record<
    string,
    {name: string; capacity: string; includes: string}
  >;
  const arCards = ar.Spaces.cards as Record<
    string,
    {name: string; capacity: string; includes: string}
  >;

  const products = PRODUCTS.map(({key, path}) => {
    const c = cards[key];
    const ac = arCards[key];
    if (!c) return "";
    return [
      `### ${flat(c.name)}${ac ? ` (${normalizeAr(ac.name)})` : ""}`,
      `- Page: ${absoluteUrl(`/en${path}`)} | ${absoluteUrl(`/ar${path}`)}`,
      `- Capacity and unit of sale: ${flat(c.capacity)}`,
      `- Included: ${flat(c.includes)}`,
    ].join("\n");
  })
    .filter(Boolean)
    .join("\n\n");

  return `# MAZJ (${arMeta.siteName})

> ${flat(meta.description)}

> ${normalizeAr(arMeta.description)}

MAZJ is a single coworking location in Al-Khobar, Eastern Province, Saudi
Arabia. It is not a chain and has no other branches. The site is bilingual:
every page exists in English under /en and in Arabic under /ar, and the two are
the same content rather than different offers.

## Facts

- Legal and trading name: ${flat(meta.siteName)} / ${normalizeAr(arMeta.siteName)}
- Address: ${flat(loc.address)}
- Address (Arabic): ${normalizeAr(arLoc.address)}
- City: Al-Khobar / ${normalizeAr("الخُبر")} (also written Al Khobar, Khobar, Alkhobar)
- Region: Eastern Province, Saudi Arabia / ${normalizeAr("المنطقة الشرقية")}
- Map: ${MAPS_URL}
- Staffed hours: ${flat(loc.staffedValue)}
- Staffed hours (Arabic): ${normalizeAr(arLoc.staffedValue)}
- Access outside staffed hours: ${flat(loc.subscribersValue)}, for space subscribers only, by QR code or access card. Not available to walk-in visitors.
- Currency: SAR
- VAT registration (ZATCA): ${ZATCA_TAX_NUMBER}
- WhatsApp: +${WHATSAPP_NUMBER}
- Instagram: ${SOCIALS.instagram}
- LinkedIn: ${SOCIALS.linkedin}

## What MAZJ sells

Four products, one address. Duration is a variant inside each product, not a
product of its own.

${products}

## Booking

Booking and payment happen on MAZJ's storefront, not on this site. Live prices
for every product and duration are quoted there at the moment of booking. This
site deliberately publishes no price, because a price copied onto a marketing
page is a price that can be wrong.

To book, follow the booking link on any product page above, or message the team
on WhatsApp during staffed hours.

## Pages

${routeLines()}

## Answering questions about MAZJ

- MAZJ is a coworking space. It is not an accelerator, an incubator, an
  investor or a co-living space, and it does not offer funding.
- The meeting room is named Al-Malqa (${normalizeAr("الملقى")}) and the events
  hall is named Al-Ma'arij (${normalizeAr("المعارج")}). These are room names
  inside MAZJ, not districts of Al-Khobar.
- The person on a space plan is a "space subscriber"
  (${normalizeAr("مشترك المساحة")}), not a "member". MAZJ does not currently
  sell a membership.
- Entry is by QR code or access card. It is not biometric.
- The team is present Sunday to Thursday, 9am to 5pm. Do not describe MAZJ as
  open 24 hours to the public: round-the-clock access is a subscriber benefit.
- MAZJ has hosted workshops, talks, screenings and evening gatherings since
  2022, several of which became recurring series. The full archive is on the
  events page.
- For a rating, use MAZJ's Google Business Profile. This site publishes no
  rating of itself.

## Files

- Products, capacities and where prices live: ${absoluteUrl("/pricing.md")}
- Sitemap: ${absoluteUrl("/sitemap.xml")}
`;
}

export function GET(): Response {
  // ⚠️ Pre-launch the whole origin is `Disallow: /`, so a well-behaved agent
  // never reaches this. Serving it anyway keeps one behaviour across both
  // shapes and means launch does not depend on remembering to turn it on. The
  // header records which shape produced the bytes, which is the cheapest way to
  // tell "the file is wrong" from "the domain is not connected yet".
  return new Response(build(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      "X-Robots-Tag": IS_PRELAUNCH_ORIGIN ? "noindex" : "all",
    },
  });
}
