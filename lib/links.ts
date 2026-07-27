/**
 * Every booking destination the site links to, in one place.
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
 * Kept because they are still live and still shared: QR codes, ads and anything
 * printed points here. `next.config.mjs` 301s each one to its replacement above.
 *
 * ⚠️ Each exists in TWO shapes. `mazj.sa/subscription/<slug>` answers 308 and
 * redirects to `mazj.sa/ar/subscription/<slug>`, so the redirect map must cover
 * the locale-prefixed form too, and that one collides with this site's own `/ar`
 * prefix.
 */
export const LEGACY_STORE_PATHS = {
  "/subscription/adwyh-almsahh-almshtrkh": "/spaces/coworking/book",
  "/subscription/private-office": "/spaces/private-office/book",
  "/reservation/ghrfh-alajtmaaat-almlqa": "/spaces/meeting-room/book",
  "/reservation/qaah-alfaalyat-almaarj": "/spaces/event-hall/book",
} as const;

export const SOCIALS = {
  x: "https://twitter.com/mazjorg",
  instagram: "https://www.instagram.com/mazjorg",
  linkedin: "https://www.linkedin.com/company/mazj-%D9%85%D8%B2%D8%AC",
} as const;

/** ZATCA VAT registration number (display copy lives in i18n). */
export const ZATCA_TAX_NUMBER = "310240548700003";
