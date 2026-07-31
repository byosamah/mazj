import {
  STARTUP_EMAIL_COPY,
  fill,
  formatEmailDate,
  type EmailLocale,
} from "./copy";
import type { OutboundEmail } from "./client";

/**
 * The branded MAZJ email, rendered.
 *
 * Written the way email is actually written, which is to say the way the web
 * was written in 2003: nested tables, every style inline, no external
 * stylesheet, no flexbox, no grid, no custom properties. Gmail strips `<style>`
 * blocks in some contexts and Outlook's renderer is Word. This is not a
 * stylistic choice.
 *
 * 🔴 NO WEBFONT. Thmanyah is the site's whole typographic identity and it cannot
 * be relied on in an inbox: `@font-face` is stripped or ignored by most clients,
 * and a font that half-loads renders worse than one that never tried. The stack
 * below degrades to each platform's own UI face, which shapes Arabic correctly
 * everywhere, which matters far more here than matching the site.
 *
 * What DOES carry the brand: the coral rule, the cream ground, the wordmark, and
 * the voice. Those survive every client.
 */

/** Brand tokens, duplicated from `tailwind.config.ts` because email is inline. */
const C = {
  ground: "#f7eed9", // beige-1, the page behind the card
  card: "#fff7e9", // beige
  panel: "#f0e5cf", // beige-card, for the code block
  ink: "#111111",
  muted: "#514E4A",
  coral: "#FF5A48",
  hairline: "#dacab6", // dark-beige
} as const;

/**
 * MAZJ's WhatsApp line, digits only.
 *
 * 🔴 DUPLICATED from `lib/contact.ts`, not imported: `server/` may not reach
 * into `lib/`, and that boundary is what keeps this folder liftable.
 * `test/startup-offer-sync.test.ts` asserts the two never drift.
 */
const WHATSAPP_NUMBER = "966534600488";

/**
 * Escapes text for HTML.
 *
 * 🔴 EVERY interpolated value in this file goes through it, without exception.
 * Two of them are genuinely hostile input: `founderName` and `startupName` are
 * typed by a stranger into a public form, and `reason` is typed by an admin into
 * a textarea. React is escaping neither, because none of this is React. An
 * unescaped `<` here is an HTML injection into a message sent from MAZJ's own
 * verified domain, which is a phishing primitive, not a rendering bug.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped, with newlines preserved as line breaks. Escape first, always. */
function escMultiline(value: string): string {
  return esc(value).replace(/\r?\n/g, "<br />");
}

type Shell = {
  locale: EmailLocale;
  siteOrigin: string;
  /** Preheader: the grey line clients show beside the subject in the list. */
  preview: string;
  body: string;
};

/**
 * The outer chrome every message shares.
 *
 * The `preview` span is the one piece of invisible machinery here: without it,
 * inbox list views pull the first visible text, which is the wordmark's alt
 * attribute, so every MAZJ email would preview as the word "MAZJ".
 */
function shell({ locale, siteOrigin, preview, body }: Shell): string {
  const rtl = locale === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const copy = STARTUP_EMAIL_COPY[locale];

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${esc(copy.brand)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.ground};">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${esc(preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.ground};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${C.card};border:1px solid ${C.hairline};border-radius:16px;overflow:hidden;">
        <tr><td style="height:4px;background-color:${C.coral};line-height:4px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td dir="${dir}" align="${align}" style="padding:32px 32px 8px 32px;">
            <img src="${siteOrigin}/logos/mazj-wordmark.png" width="72" height="54" alt="${esc(copy.brand)}" style="display:block;border:0;outline:none;text-decoration:none;height:auto;" />
          </td>
        </tr>
        <tr>
          <td dir="${dir}" align="${align}" style="padding:8px 32px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Tahoma,Arial,sans-serif;color:${C.ink};">
${body}
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td dir="${dir}" align="${align}" style="padding:20px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Tahoma,Arial,sans-serif;font-size:12px;line-height:1.6;color:${C.muted};">
            ${esc(copy.footerAddress)}<br />
            ${esc(copy.footerWhy)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

const h1 = (text: string) =>
  `<h1 style="margin:0 0 16px 0;font-size:26px;line-height:1.3;font-weight:700;color:${C.ink};">${text}</h1>`;

const p = (text: string) =>
  `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;color:${C.muted};">${text}</p>`;

const label = (text: string) =>
  `<p style="margin:0 0 6px 0;font-size:12px;line-height:1.4;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${C.ink};">${text}</p>`;

/** The signature. Note مزج is feminine throughout the Arabic copy. */
const signature = (locale: EmailLocale) => {
  const copy = STARTUP_EMAIL_COPY[locale];
  return `<p style="margin:24px 0 0 0;font-size:16px;line-height:1.65;color:${C.ink};">${esc(copy.signOff)}<br /><strong>${esc(copy.teamName)}</strong></p>`;
};

/**
 * A pill button.
 *
 * ⚠️ Not a `<button>` and not a styled `<div>`: only an `<a>` with a background
 * on the anchor itself survives Gmail, and the padding has to sit on the anchor
 * rather than a wrapper for the whole pill to be tappable on a phone.
 */
const button = (href: string, text: string) =>
  `<p style="margin:24px 0 0 0;"><a href="${esc(href)}" style="display:inline-block;background-color:${C.ink};color:${C.card};text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:999px;">${esc(text)}</a></p>`;

/** A boxed value: the reference, or the code. */
const valueBox = (text: string, mono: boolean) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;"><tr><td style="background-color:${C.panel};border:1px solid ${C.hairline};border-radius:12px;padding:14px 20px;font-family:${
    mono
      ? "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
      : "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
  };font-size:${mono ? "22px" : "18px"};font-weight:700;letter-spacing:${mono ? "0.12em" : "0.02em"};color:${C.ink};" dir="ltr">${esc(text)}</td></tr></table>`;

// ---------------------------------------------------------------------------
// The four messages
// ---------------------------------------------------------------------------

export type ReceivedEmailData = {
  locale: EmailLocale;
  siteOrigin: string;
  founderName: string;
  reference: string;
};

export function renderReceivedEmail(data: ReceivedEmailData): OutboundEmail {
  const copy = STARTUP_EMAIL_COPY[data.locale].received;
  const body = fill(copy.body, { founder: esc(data.founderName) });

  return {
    to: "",
    subject: copy.subject,
    html: shell({
      locale: data.locale,
      siteOrigin: data.siteOrigin,
      preview: copy.next,
      body: [
        h1(esc(copy.heading)),
        p(body),
        label(esc(copy.referenceLabel)),
        valueBox(data.reference, true),
        p(esc(copy.next)),
        signature(data.locale),
      ].join("\n"),
    }),
    text: [
      copy.heading,
      "",
      fill(copy.body, { founder: data.founderName }),
      "",
      `${copy.referenceLabel}: ${data.reference}`,
      "",
      copy.next,
      "",
      STARTUP_EMAIL_COPY[data.locale].signOff,
      STARTUP_EMAIL_COPY[data.locale].teamName,
    ].join("\n"),
  };
}

export type ApprovedEmailData = {
  locale: EmailLocale;
  siteOrigin: string;
  startupName: string;
  code: string;
  expiresAt: string;
};

export function renderApprovedEmail(data: ApprovedEmailData): OutboundEmail {
  const copy = STARTUP_EMAIL_COPY[data.locale].approved;
  const expiry = formatEmailDate(data.expiresAt, data.locale);
  // Prefilled so the founder does not have to explain themselves twice. Short,
  // warm, first-person, written from the visitor to MAZJ, per TONE.md §8.
  const whatsapp = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    data.locale === "ar"
      ? `مرحباً مزج، وصلني رمز عرض الشركات الناشئة: ${data.code}`
      : `Hi MAZJ, I have my startups offer code: ${data.code}`
  )}`;

  return {
    to: "",
    subject: copy.subject,
    html: shell({
      locale: data.locale,
      siteOrigin: data.siteOrigin,
      preview: copy.howToUse,
      body: [
        h1(esc(copy.heading)),
        p(fill(copy.body, { startup: esc(data.startupName) })),
        label(esc(copy.codeLabel)),
        valueBox(data.code, true),
        // 🔴 The load-bearing sentence in this entire feature. Rekaz has no
        // coupon API, so there is no field anywhere that consumes this code. If
        // this line is ever cut for brevity, every approved founder goes looking
        // for a discount box that does not exist and concludes MAZJ is broken.
        p(esc(copy.howToUse)),
        label(esc(copy.expiryLabel)),
        valueBox(expiry, false),
        p(esc(copy.expiryNote)),
        button(whatsapp, copy.whatsappCta),
        signature(data.locale),
      ].join("\n"),
    }),
    text: [
      copy.heading,
      "",
      fill(copy.body, { startup: data.startupName }),
      "",
      `${copy.codeLabel}: ${data.code}`,
      "",
      copy.howToUse,
      "",
      `${copy.expiryLabel}: ${expiry}`,
      copy.expiryNote,
      "",
      `${copy.whatsappCta}: ${whatsapp}`,
      "",
      STARTUP_EMAIL_COPY[data.locale].signOff,
      STARTUP_EMAIL_COPY[data.locale].teamName,
    ].join("\n"),
  };
}

export type RejectedEmailData = {
  locale: EmailLocale;
  siteOrigin: string;
  founderName: string;
  startupName: string;
  /** Written by an admin, read by the founder, verbatim. Escaped here. */
  reason: string;
};

export function renderRejectedEmail(data: RejectedEmailData): OutboundEmail {
  const copy = STARTUP_EMAIL_COPY[data.locale].rejected;
  const spacesUrl = `${data.siteOrigin}/${data.locale}/spaces`;

  return {
    to: "",
    subject: copy.subject,
    html: shell({
      locale: data.locale,
      siteOrigin: data.siteOrigin,
      preview: copy.openDoor,
      body: [
        h1(esc(copy.heading)),
        p(
          fill(copy.body, {
            founder: esc(data.founderName),
            startup: esc(data.startupName),
          })
        ),
        label(esc(copy.reasonLabel)),
        // The owner's own words, kept as written, line breaks and all. This is
        // the whole point of the rejection email: a "no" with nothing behind it
        // is worse than silence.
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px 0;"><tr><td style="background-color:${C.panel};border-radius:12px;padding:16px 20px;font-size:16px;line-height:1.65;color:${C.ink};">${escMultiline(data.reason)}</td></tr></table>`,
        p(esc(copy.openDoor)),
        button(spacesUrl, copy.spacesCta),
        signature(data.locale),
      ].join("\n"),
    }),
    text: [
      copy.heading,
      "",
      fill(copy.body, {
        founder: data.founderName,
        startup: data.startupName,
      }),
      "",
      `${copy.reasonLabel}:`,
      data.reason,
      "",
      copy.openDoor,
      "",
      `${copy.spacesCta}: ${spacesUrl}`,
      "",
      STARTUP_EMAIL_COPY[data.locale].signOff,
      STARTUP_EMAIL_COPY[data.locale].teamName,
    ].join("\n"),
  };
}

export type AlertEmailData = {
  siteOrigin: string;
  id: string;
  reference: string;
  founderName: string;
  startupName: string;
  email: string;
  phone: string;
  stage: string;
  teamSize: number;
  space: string;
  locale: EmailLocale;
  pitch: string;
};

/**
 * The internal alert.
 *
 * English only, and unbranded on purpose: `/admin` is English only, this goes to
 * one inbox that already knows what MAZJ is, and the job is to be scannable on a
 * phone at the top of a notification. The link is the payload.
 */
export function renderAlertEmail(data: AlertEmailData): OutboundEmail {
  const link = `${data.siteOrigin}/admin/startups/${data.id}`;
  const rows: [string, string][] = [
    ["Startup", data.startupName],
    ["Founder", data.founderName],
    ["Email", data.email],
    ["Phone", data.phone],
    ["Stage", data.stage],
    ["Team", String(data.teamSize)],
    ["Wants", data.space.replace(/_/g, " ")],
    ["Language", data.locale === "ar" ? "Arabic" : "English"],
    ["Reference", data.reference],
  ];

  return {
    to: "",
    subject: `New startup application: ${data.startupName}`,
    html: shell({
      locale: "en",
      siteOrigin: data.siteOrigin,
      preview: `${data.founderName} applied for the startups offer.`,
      body: [
        h1(`New application`),
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px 0;font-size:15px;line-height:1.6;">${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 16px 4px 0;color:${C.muted};white-space:nowrap;">${esc(k)}</td><td style="padding:4px 0;color:${C.ink};font-weight:600;">${esc(v)}</td></tr>`
          )
          .join("")}</table>`,
        label("What they are building"),
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px 0;"><tr><td style="background-color:${C.panel};border-radius:12px;padding:16px 20px;font-size:15px;line-height:1.65;color:${C.ink};">${escMultiline(data.pitch)}</td></tr></table>`,
        button(link, "Open in admin"),
      ].join("\n"),
    }),
    text: [
      `New startup application: ${data.startupName}`,
      "",
      ...rows.map(([k, v]) => `${k}: ${v}`),
      "",
      "What they are building:",
      data.pitch,
      "",
      link,
    ].join("\n"),
  };
}
