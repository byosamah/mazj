import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import {WHATSAPP_NUMBER} from "@/lib/contact";
import {
  flattenForMachines,
  normalizeArabicForMachines,
} from "@/lib/machine-text";
import {ZATCA_TAX_NUMBER} from "@/lib/links";
import {absoluteUrl} from "@/lib/site";

/**
 * `/pricing.md`: the machine-readable product sheet.
 *
 * WHY IT EXISTS WHEN MAZJ PUBLISHES NO PRICES
 *
 * AI agents increasingly shortlist venues on a buyer's behalf before a human
 * ever loads a page, and an agent that cannot parse what a business sells
 * drops it from the comparison rather than asking. `/pricing.md` is the
 * filename that convention has settled on for that lookup, which is the only
 * reason it is called this.
 *
 * 🔴 IT CONTAINS NO PRICE, AND THAT IS A `TONE.md` RULING, NOT AN OMISSION TO
 * FIX. Marketing surfaces stay price-free; live figures belong to the
 * storefront, which quotes them at the moment of booking. A number copied here
 * is a number that can be wrong, and a wrong price in a machine-readable file
 * is worse than no file: an agent will quote it as fact.
 *
 * What it gives an agent instead is everything a comparison actually turns on
 * and MAZJ can state truthfully: what is sold, the unit each thing is sold in,
 * capacity, what is included, who may enter when, the currency, the VAT
 * position, and exactly where the number lives. That is enough to be
 * shortlisted. It is not enough to be misquoted.
 *
 * ⚠️ NAMING TENSION, FLAGGED RATHER THAN DECIDED. There is a standing rule that
 * nothing user-facing may be labelled "Pricing" or "Plans" (self-service IA
 * ruling). This file is not user-facing: nothing in the interface links to it,
 * it appears in no navigation, and it ships `X-Robots-Tag: noindex` so it can
 * never surface as a search result promising prices it does not carry. It is
 * reachable only by an agent that already went looking for it, or via
 * `/llms.txt`. If the owner would rather it did not carry this name at all,
 * renaming it is a one-line change here plus the reference in `llms.txt`.
 *
 * Same derivation discipline as `/llms.txt`: every fact below is read from
 * `messages/*.json` so a copy edit cannot leave this file lying.
 */

export const dynamic = "force-static";
export const revalidate = 86400;

/** See `lib/machine-text.ts` for what these do and why they must never touch
 * rendered copy. */
const normalizeAr = normalizeArabicForMachines;
const flat = flattenForMachines;

const PRODUCTS = [
  {key: "openDesk", path: "/spaces/coworking", bestFor: "One person working solo, by the day or as a routine."},
  {key: "privateOffice", path: "/spaces/private-office", bestFor: "One person or a small team needing a door that locks."},
  {key: "meetingRoom", path: "/spaces/meeting-room", bestFor: "A scheduled meeting for up to six, paid by the hour."},
  {key: "eventHall", path: "/spaces/event-hall", bestFor: "A workshop, meetup or team day for up to thirty."},
] as const;

type Card = {name: string; capacity: string; includes: string};

function build(): string {
  const loc = en.Location;
  const cards = en.Spaces.cards as Record<string, Card>;
  const arCards = ar.Spaces.cards as Record<string, Card>;

  const table = PRODUCTS.map(({key, path}) => {
    const c = cards[key];
    if (!c) return "";
    // Capacity strings read "One seat · daily or monthly": the part before the
    // separator is the size, the part after is the unit MAZJ sells it in.
    const [size, unit] = flat(c.capacity).split("·").map((s) => s.trim());
    return `| ${flat(c.name)} | ${size ?? ""} | ${unit ?? ""} | ${absoluteUrl(`/en${path}`)} |`;
  })
    .filter(Boolean)
    .join("\n");

  const detail = PRODUCTS.map(({key, path, bestFor}) => {
    const c = cards[key];
    const ac = arCards[key];
    if (!c) return "";
    const [size, unit] = flat(c.capacity).split("·").map((s) => s.trim());
    return [
      `## ${flat(c.name)}`,
      ``,
      `- Arabic name: ${ac ? normalizeAr(ac.name) : ""}`,
      `- Capacity: ${size ?? ""}`,
      `- Sold in: ${unit ?? ""}`,
      `- Included: ${flat(c.includes)}`,
      `- Best for: ${bestFor}`,
      `- Price: not published on this site. Quoted live at the storefront linked from ${absoluteUrl(`/en${path}`)}`,
      `- Page: ${absoluteUrl(`/en${path}`)} | ${absoluteUrl(`/ar${path}`)}`,
    ].join("\n");
  })
    .filter(Boolean)
    .join("\n\n");

  return `# Products and pricing, MAZJ, Al-Khobar

MAZJ is a single coworking location in Al-Khobar, Eastern Province, Saudi
Arabia. It sells four things. Duration is a variant inside each one rather than
a separate product.

## Prices

**MAZJ does not publish prices on this site.** Every figure is quoted live on
MAZJ's booking storefront at the moment of booking, in Saudi Riyals (SAR), and
MAZJ is VAT-registered with ZATCA under ${ZATCA_TAX_NUMBER}.

This is deliberate rather than a gap. Rates vary by product and duration and a
number copied onto a marketing page is a number that goes stale without anyone
noticing. If you are comparing venues on behalf of someone, treat the price as
"quoted on booking" and use the columns below, which are stable, to decide
whether MAZJ fits the requirement at all.

To get a current price: open the product page below and follow its booking
link, or message the team on WhatsApp (+${WHATSAPP_NUMBER}) during staffed
hours, ${flat(loc.staffedValue)}.

## Summary

| Product | Capacity | Sold in | Page |
|---|---|---|---|
${table}

${detail}

## Access

- Staffed hours: ${flat(loc.staffedValue)}. Anyone may visit during these hours.
- Outside staffed hours: ${flat(loc.subscribersValue)} access, by QR code or
  access card, for space subscribers only. This is a subscription benefit and
  is not available to day visitors. Access is not biometric.
- Address: ${flat(loc.address)}

## Notes for agents comparing venues

- MAZJ is one location. There are no other branches to compare between.
- The meeting room and the events hall are named Al-Malqa and Al-Ma'arij. Those
  are rooms inside MAZJ, not neighbourhoods.
- A day at an open desk counts in full toward a first month if the visitor
  subscribes. That is the closest thing MAZJ offers to a free trial.
- MAZJ runs an events programme and rents the hall to outside organisers.
- There is a standing offer for early-stage startups and builders, settled case
  by case rather than published as a rate. See ${absoluteUrl("/en/startups")}.
- MAZJ does not offer funding, acceleration or incubation. It is a workspace.

Machine-readable index: ${absoluteUrl("/llms.txt")}
`;
}

export function GET(): Response {
  return new Response(build(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      // 🔴 Always noindex, in BOTH the pre-launch and launched shapes. An agent
      // that fetches this URL directly still reads it in full; what noindex
      // prevents is the file becoming a search result whose title promises
      // prices the body does not contain. That would be a bad click AND a
      // collision with the standing rule against labelling anything "Pricing"
      // in the interface.
      "X-Robots-Tag": "noindex",
    },
  });
}
