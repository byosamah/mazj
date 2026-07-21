/**
 * Every external destination the site links to, in one place.
 * Booking/checkout stays on mazj.sa (live prices + payment run there),
 * so no SAR amounts ever appear in this codebase.
 *
 * mazj.sa restructured in July 2026: it went from six standalone products to
 * FOUR, with duration now a variant picker inside each product rather than a
 * product of its own. The old `dayDesk` and `officeMonth` (mktb-khas-hyz) URLs
 * are gone — mktb-khas-hyz now 404s — so day/month live inside `sharedSeat`
 * and `privateOffice`. Re-check these against mazj.sa before trusting them.
 */
export const BOOKING = {
  /** مقعد في المساحة المشتركة — 1 day / 1, 3, 6 months / 1 year */
  sharedSeat: "https://mazj.sa/subscription/adwyh-almsahh-almshtrkh",
  /** مكتب خاص (حيّز) — 1, 3, 6 days / 1, 3, 6 months / 1 year */
  privateOffice: "https://mazj.sa/subscription/private-office",
  /** غرفة الاجتماعات (الملقى) — by the hour */
  meeting: "https://mazj.sa/reservation/ghrfh-alajtmaaat-almlqa",
  /** قاعة الفعاليات (المعارج) — 2-5 hour slots */
  event: "https://mazj.sa/reservation/qaah-alfaalyat-almaarj",
} as const;

export const SOCIALS = {
  x: "https://twitter.com/mazjorg",
  instagram: "https://www.instagram.com/mazjorg",
  linkedin: "https://www.linkedin.com/company/mazj-%D9%85%D8%B2%D8%AC",
} as const;

/** ZATCA VAT registration number (display copy lives in i18n). */
export const ZATCA_TAX_NUMBER = "310240548700003";
