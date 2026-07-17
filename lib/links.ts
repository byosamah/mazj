/**
 * Every external destination the site links to, in one place.
 * Booking/checkout stays on mazj.sa (live prices + payment run there),
 * so no SAR amounts ever appear in this codebase.
 */
export const BOOKING = {
  dayDesk: "https://mazj.sa/reservation/3a14ba78-df07-bba7-7c23-0c9f637ce6e1",
  meeting: "https://mazj.sa/reservation/ghrfh-alajtmaaat-almlqa",
  event: "https://mazj.sa/reservation/qaah-alfaalyat-almaarj",
  officeDay: "https://mazj.sa/subscription/private-office",
  officeMonth: "https://mazj.sa/subscription/mktb-khas-hyz",
  membership: "https://mazj.sa/subscription/adwyh-almsahh-almshtrkh",
} as const;

export const SOCIALS = {
  x: "https://twitter.com/mazjorg",
  instagram: "https://www.instagram.com/mazjorg",
  linkedin: "https://www.linkedin.com/company/mazj-%D9%85%D8%B2%D8%AC",
} as const;

/** ZATCA VAT registration number (display copy lives in i18n). */
export const ZATCA_TAX_NUMBER = "310240548700003";
