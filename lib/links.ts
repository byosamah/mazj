/**
 * Every booking destination the site links to, in one place.
 *
 * 🔴 **NOTHING LINKS HERE RIGHT NOW. Read `bookingUrl()` below first.** As of
 * 2026-08-01 these four routes are redirected out to mazj.sa and no control on
 * the site points at them. They are kept, unedited, because they are still the
 * canonical list of which `/book` routes exist: `bookingUrl()` keys off them,
 * `next.config.mjs`'s redirects are built from them, and restoring on-site
 * booking is a revert rather than a rewrite. Everything below this line
 * describes how the site worked until 2026-08-01 and will again.
 *
 * 🔴 **These became INTERNAL paths on 2026-07-27.** They used to point at
 * mazj.sa, the Rekaz-hosted storefront, which meant every buyer left the site
 * at the moment they decided to buy. Booking now happens here, at
 * `/spaces/<space>/book`, against the Rekaz API.
 *
 * That is also what unblocks the launch. The owner intends `www.mazj.sa` to
 * serve THIS app, and the old values were `mazj.sa` store paths: the day the
 * domain moved, every Book button on the site would have 404'd.
 *
 * Because these are now relative, `CtaButton` routes them through the
 * locale-aware `Link` instead of opening a new tab, which is correct: booking is
 * part of the journey, not a departure from it.
 *
 * ⚠️ Payment still leaves. Rekaz exposes no payments API, so the final step
 * redirects to a `platform.rekaz.io` checkout page. That host is unaffected by
 * the domain move. See `docs/rekaz-api-findings.md`.
 */
export const BOOKING = {
  /** مقعد في المساحة المشتركة: 1 day / 1, 3, 6 months / 1 year */
  sharedSeat: "/spaces/coworking/book",
  /** مكتب خاص (حيّز): 1, 3, 6 days / 1, 3, 6 months / 1 year */
  privateOffice: "/spaces/private-office/book",
  /** غرفة الاجتماعات (الملقى): by the hour */
  meeting: "/spaces/meeting-room/book",
  /** قاعة الفعاليات (المعارج): 2-5 hour slots */
  event: "/spaces/event-hall/book",
} as const;

/**
 * The Rekaz storefront paths these links used to point at.
 *
 * 🔴 **"Used to" became "currently do" again on 2026-08-01.** While booking is
 * sent back out to mazj.sa these are not legacy at all: they are the live buy
 * pages, and `bookingUrl()` below builds every Book link on the site from them.
 * The name is left alone deliberately, so the revert is a clean one.
 *
 * ⚠️ **The eight `next.config.mjs` redirects that pointed these INTO the site
 * were removed in the same commit**, and must stay removed while `bookingUrl()`
 * points out here: two rules in opposite directions between the same two URLs
 * is an infinite bounce the moment one host serves both. The reasoning is
 * written out under `bookingUrl()`.
 *
 * Kept, before all of that, because they are still live and still shared: QR
 * codes, ads and anything printed points here.
 *
 * ⚠️ Each exists in TWO shapes. `mazj.sa/subscription/<slug>` answers 308 and
 * redirects to `mazj.sa/ar/subscription/<slug>`, so any redirect map must cover
 * the locale-prefixed form too, and that one collides with this site's own `/ar`
 * prefix.
 */
export const LEGACY_STORE_PATHS = {
  "/subscription/adwyh-almsahh-almshtrkh": "/spaces/coworking/book",
  "/subscription/private-office": "/spaces/private-office/book",
  "/reservation/ghrfh-alajtmaaat-almlqa": "/spaces/meeting-room/book",
  "/reservation/qaah-alfaalyat-almaarj": "/spaces/event-hall/book",
} as const;

/**
 * 🔴 **TEMPORARY, 2026-08-01. BOOKING HAS BEEN SENT BACK OUT TO mazj.sa.**
 *
 * Owner decision: until Rekaz fix their API, no buyer touches the on-site
 * booking flow. Every Book control on the site now opens the product's own page
 * on the Rekaz storefront in a NEW TAB, and the four `/spaces/<space>/book`
 * routes 307 out to the same place so a bookmark or a shared link cannot reach
 * the broken path either.
 *
 * **Nothing was deleted.** `BOOKING` above, every `/book` route file,
 * `components/booking/` and `server/services/booking.ts` are all untouched on
 * disk. Reverting is one commit, and the branch `feature/onsite-booking` holds
 * the pre-change `main` verbatim.
 *
 * 🔴 **The locale MUST be written in.** A locale-less `mazj.sa/subscription/x`
 * answers 308 to `/ar/...`, so an English buyer would silently land in Arabic
 * at the moment of purchase.
 *
 * ⚠️ **The origin is the BARE host, not `www`.** Verified live 2026-08-01: both
 * resolve to the same Cloudflare addresses and all eight product pages answer
 * 200, but `www.mazj.sa/<path>` 301s to `mazj.sa/<path>` every time. Writing
 * `www` costs one redirect on the last click before payment and buys nothing.
 *
 * 🔴 **DO NOT ALSO POINT `next.config.mjs` AT THIS FROM THE STORE PATHS.** The
 * eight `LEGACY_STORE_PATHS` redirects (store URL → our `/book` page) were
 * REMOVED in the same commit precisely because keeping both directions is an
 * infinite bounce the day this app serves `mazj.sa`: their rule sends the buyer
 * in, ours sends them straight back out, and the browser gives up on the
 * revenue path. One direction at a time, always.
 */
const STORE_ORIGIN = "https://mazj.sa";

/**
 * Each product's `/book` route mapped back to the storefront path it came from.
 *
 * Inverted from `LEGACY_STORE_PATHS` rather than retyped, so the two cannot
 * drift: there is exactly one place in this file where a Rekaz slug is spelled.
 * `test/booking-links.test.ts` still writes all eight finished URLs out
 * literally, because a derived map is only as readable as its expected output.
 */
const STORE_PATH_BY_BOOK_PATH = Object.fromEntries(
  Object.entries(LEGACY_STORE_PATHS).map(([storePath, bookPath]) => [bookPath, storePath])
) as Record<(typeof BOOKING)[keyof typeof BOOKING], string>;

/**
 * Where this product is actually bought, today: its page on the mazj.sa store.
 *
 * `CtaButton` reads the `https://` and opens it in a new tab with
 * `rel="noopener noreferrer"` on its own, so most call sites change by swapping
 * the value alone. `Hero.tsx` is the exception: its pill CTA is a hand-written
 * control rather than a `CtaButton`, so it carries the target itself.
 */
export function bookingUrl(
  space: keyof typeof BOOKING,
  locale: string
): string {
  const lang = locale === "ar" ? "ar" : "en";
  return `${STORE_ORIGIN}/${lang}${STORE_PATH_BY_BOOK_PATH[BOOKING[space]]}`;
}

/**
 * The startups & builders offer page.
 *
 * Internal, and centralised here for the same reason `BOOKING` is: the landing
 * band, the footer and the rejection email all point at it, and a path spelled
 * out in three components is a path that gets renamed in two of them.
 *
 * ⚠️ It became a destination on 2026-07-28. Before that the band's only CTA was
 * a WhatsApp link, so the offer had no page, no application and no record of
 * who had asked. `Founding.ctaMsg` (the prefilled WhatsApp message) was removed
 * from both message files in the same change; if you find a reference to it,
 * it is stale.
 */
export const STARTUP_OFFER = "/startups";

/**
 * 🔴 **There is no MAZJ account on X** (owner, 2026-08-01). An `x` entry
 * pointing at `twitter.com/mazjorg` was removed from here, from the footer,
 * from `/contact` and from `lib/schema.ts`'s `sameAs` on that date. The schema
 * one is the reason this note exists: `sameAs` is a machine-readable claim that
 * the profile IS this business, so it told Google MAZJ owns a handle it does
 * not control. Do not restore it from an older doc; `CONTENT-BUILD-PROMPT.md`
 * still lists it, and that file is a stale build brief (it also states the
 * Google rating as 5.0, which is a known shipped bug).
 */
export const SOCIALS = {
  instagram: "https://www.instagram.com/mazjorg",
  linkedin: "https://www.linkedin.com/company/mazj-%D9%85%D8%B2%D8%AC",
} as const;

/** ZATCA VAT registration number (display copy lives in i18n). */
export const ZATCA_TAX_NUMBER = "310240548700003";
