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
 * 🔴 Also deliberately absent: `Event`. See `app/[locale]/events/page.tsx`.
 */

/** Stable @id for the business node, so other nodes can reference it. */
const BUSINESS_ID = `${absoluteUrl("/")}#business`;

/** Geo pin, parsed off the real Google Maps listing in `lib/contact.ts`. */
const GEO = {latitude: 26.302126, longitude: 50.176999} as const;

type LocalBusinessInput = {
  locale: string;
  name: string;
  description: string;
  streetAddress: string;
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
}: LocalBusinessInput) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": BUSINESS_ID,
    name,
    description,
    url: absoluteUrl(`/${locale}`),
    inLanguage: locale === "ar" ? "ar-SA" : "en-US",
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
    // Staffed reception hours. Members hold 24/7 fingerprint access, but that is
    // a membership benefit, not a public opening time, so it is NOT marked up
    // here: `openingHours` means "when can anyone walk in".
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
        opens: "09:00",
        closes: "21:00",
      },
    ],
    sameAs: [SOCIALS.instagram, SOCIALS.x, SOCIALS.linkedin],
    areaServed: {
      "@type": "AdministrativeArea",
      name: locale === "ar" ? "المنطقة الشرقية" : "Eastern Province, Saudi Arabia",
    },
    // The four products, each pointing at its on-site booking page. No `price`
    // is asserted: prices are live from Rekaz and a stale one in schema is worse
    // than none.
    //
    // 🔴 `absoluteUrl` + the locale, because `BOOKING` holds RELATIVE paths since
    // booking moved on-site. A relative `url` in JSON-LD is invalid: Google
    // cannot resolve it without a base, so the offer is dropped or misattributed.
    // Every other URL in this file is already absolute; these were the only ones
    // that silently became relative.
    makesOffer: [
      {name: "Open desk", path: BOOKING.sharedSeat},
      {name: "Private office", path: BOOKING.privateOffice},
      {name: "Meeting room (Al-Malqa)", path: BOOKING.meeting},
      {name: "Events hall (Al-Ma'arij)", path: BOOKING.event},
    ].map((o) => ({
      "@type": "Offer",
      itemOffered: {"@type": "Service", name: o.name},
      url: absoluteUrl(`/${locale}${o.path}`),
      priceCurrency: "SAR",
    })),
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
