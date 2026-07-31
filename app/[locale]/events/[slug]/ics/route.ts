import {loadEvent} from "../../_lib/events";

/**
 * One event as a calendar file.
 *
 * The smallest thing that turns "I'll remember" into "it's in my calendar",
 * which for a free event is most of what registration is actually for.
 *
 * `nodejs` runtime because it reaches the database through the admin client,
 * and `force-dynamic` because an event's details can change after it is
 * published and a cached `.ics` would keep handing out the old time.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RFC 5545 timestamp: `YYYYMMDDTHHMMSSZ`, always UTC.
 *
 * UTC rather than a `TZID`-qualified local time on purpose. A floating or
 * zoned time needs the calendar client to hold a matching VTIMEZONE definition,
 * and a wrong one silently shifts the event by hours. A `Z` instant cannot be
 * misread, and every client converts it to the reader's own zone anyway, which
 * is the correct behaviour for the one attendee travelling.
 */
function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Escapes an RFC 5545 TEXT value.
 *
 * Order matters: backslash first, or the escapes introduced below get escaped
 * again. An unescaped comma or semicolon does not merely look wrong, it splits
 * the property into multiple values and the rest of the line is dropped.
 */
function text(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Folds a content line to 75 octets, per RFC 5545 section 3.1.
 *
 * 🔴 OCTETS, not characters, and that distinction is the entire reason this
 * function is hand-written rather than a one-line `slice(0, 75)`. Arabic sits
 * at 2 bytes per character in UTF-8, so a 75-CHARACTER fold produces 150-byte
 * lines that strict parsers reject, and worse, slicing a JavaScript string can
 * split a surrogate pair and emit an invalid sequence. Every MAZJ event has an
 * Arabic title, so this is the normal case here, not an edge one.
 *
 * Continuation lines begin with a single space, which the parser strips.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let start = 0;
  // 74 on continuation lines, because the leading space counts toward the 75.
  while (start < bytes.length) {
    const limit = out.length === 0 ? 75 : 74;
    let end = Math.min(start + limit, bytes.length);

    // Never cut inside a multi-byte sequence. Continuation bytes match
    // 0b10xxxxxx, so walk back until the next byte starts a character.
    while (end > start && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) {
      end--;
    }

    out.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }

  return out.join("\r\n ");
}

export async function GET(
  request: Request,
  {params}: {params: Promise<{locale: string; slug: string}>}
) {
  const {locale, slug} = await params;
  const event = await loadEvent(slug, locale);

  if (!event) {
    return new Response("Not found", {status: 404});
  }

  const url = new URL(`/${locale}/events/${slug}`, request.url).toString();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MAZJ//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // Stable and globally unique: re-downloading updates the same entry in the
    // reader's calendar instead of adding a duplicate beside it.
    `UID:${slug}@${new URL(url).hostname}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(event.endsAt)}`,
    `SUMMARY:${text(event.title)}`,
    `DESCRIPTION:${text(event.summary)}`,
    `LOCATION:${text(event.location ?? "MAZJ, Al-Khobar")}`,
    `URL:${text(url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // 🔴 CRLF between lines, not LF. RFC 5545 requires it and several calendar
  // clients (Outlook among them) reject a bare-LF file outright.
  const body = lines.map(fold).join("\r\n") + "\r\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // `attachment` so the browser hands it to the calendar app rather than
      // rendering it as text, and a readable filename because this one IS seen
      // by a human, in their downloads folder.
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
