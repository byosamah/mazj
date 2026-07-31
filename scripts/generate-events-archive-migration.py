#!/usr/bin/env python3
"""
Turns the hand-typed `EventsPage.archive` in messages/{en,ar}.json into a
migration that seeds public.events.

Run it once, commit the output, and never run it again: after the import the
database is the source of truth and the message-file arrays are deleted. This
script survives so the conversion is auditable and reproducible from the commit
that removed them, not so it becomes part of a build.

    python3 scripts/generate-events-archive-migration.py

🔴 The two files are matched BY INDEX, which is only safe because the i18n rule
in CLAUDE.md requires both message files to keep every array the same length in
the same order. The script asserts that rather than trusting it.

Dates. The source records a year plus a free-text day string ("1 February",
"17-18 February", or just "February"). None of the 41 records a TIME. So:

  * a day is parsed  -> date_precision 'day',   anchored 09:00-21:00 Riyadh
  * only a month     -> date_precision 'month', anchored to the 15th

The anchor hours are a storage convention and are never rendered: the formatter
keys off date_precision, so a 'day' event shows a date and a 'month' event shows
a month. Inventing 19:00 and then printing it would be publishing a fact nobody
recorded.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "supabase" / "migrations" / "20260728120100_events_archive_import.sql"

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

# Day precision: 09:00 and 21:00 Riyadh (UTC+3) as a "sometime that day" span.
DAY_START_UTC = "06:00:00+00"
DAY_END_UTC = "18:00:00+00"


def sql(value: str | int | None) -> str:
    """A SQL literal. Single quotes doubled; nothing else is ever interpolated."""
    if value is None:
        return "null"
    if isinstance(value, int):
        return str(value)
    return "'" + value.replace("'", "''") + "'"


def slugify(title: str, edition: str | None) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    if edition:
        base = f"{base}-{edition.lower()}"
    return base[:80].strip("-")


def parse_when(day_text: str, year: int) -> tuple[str, str, str]:
    """(starts_at, ends_at, precision) from an English date string and a year."""
    lowered = day_text.lower().strip()

    month = next((n for name, n in MONTHS.items() if name in lowered), None)
    if month is None:
        raise ValueError(f"no month in {day_text!r}")

    days = [int(d) for d in re.findall(r"\d+", lowered)]

    if not days:
        # Only a month was recorded. Anchored mid-month so it sorts inside its
        # own month rather than ahead of every dated event in it.
        return (
            f"{year:04d}-{month:02d}-15 {DAY_START_UTC}",
            f"{year:04d}-{month:02d}-15 {DAY_END_UTC}",
            "month",
        )

    first, last = days[0], days[-1]
    return (
        f"{year:04d}-{month:02d}-{first:02d} {DAY_START_UTC}",
        f"{year:04d}-{month:02d}-{last:02d} {DAY_END_UTC}",
        "day",
    )


def main() -> int:
    en = json.loads((ROOT / "messages" / "en.json").read_text("utf-8"))["EventsPage"]
    ar = json.loads((ROOT / "messages" / "ar.json").read_text("utf-8"))["EventsPage"]

    a_en, a_ar = en["archive"], ar["archive"]
    if len(a_en) != len(a_ar):
        print(f"archive length mismatch: en={len(a_en)} ar={len(a_ar)}", file=sys.stderr)
        return 1

    rows: list[str] = []
    seen: set[str] = set()

    for e, a in zip(a_en, a_ar):
        year = int(e["y"])
        starts, ends, precision = parse_when(e["d"], year)

        slug = slugify(e["t"], e.get("v"))
        if slug in seen:
            slug = f"{slug}-{year}"
        n = 2
        while slug in seen:
            slug = f"{slugify(e['t'], e.get('v'))}-{year}-{n}"
            n += 1
        seen.add(slug)

        # `h` is mapped to SUMMARY, not to host. In the source it is whatever the
        # card's second line said, which is a person for some rows ("Asma Habib")
        # and a descriptor for others ("a one-day design sprint"). Splitting those
        # apart would mean guessing, and a guess written into a database reads
        # afterwards exactly like a recorded fact.
        rows.append(
            "  ("
            + ", ".join(
                [
                    sql(slug),
                    "'published'",
                    sql(e["t"]),
                    sql(a["t"]),
                    sql(e["h"]),
                    sql(a["h"]),
                    f"timestamptz {sql(starts)}",
                    f"timestamptz {sql(ends)}",
                    sql(precision),
                    sql(e.get("s")),
                    sql(e.get("v")),
                ]
            )
            + ")"
        )

    body = ",\n".join(rows)
    OUT.write_text(
        f"""-- MAZJ's event archive, 2022 to 2025: {len(rows)} events.
--
-- GENERATED by scripts/generate-events-archive-migration.py from the
-- `EventsPage.archive` arrays that used to live in messages/en.json and
-- messages/ar.json. Those arrays are deleted in the same change, because two
-- sources of truth for one list is a guarantee that somebody eventually edits
-- the wrong one.
--
-- Every row is historical, so every `ends_at` is already in the past and they
-- land in the archive by the same rule that will move a future event there.
-- There is no special case for "old" anywhere in the application.
--
-- 🔴 `date_precision` is doing real work here. Four of these record only a
-- month, and NONE records a time. The timestamps below carry anchor hours so
-- the column can be sorted; the formatter never renders them.
--
-- `summary_*` holds what the source called `h`: the card's second line, which
-- is a person on some rows and a descriptor on others. It was NOT split into a
-- host field, because that split would have been a guess, and a guess written
-- into a database is indistinguishable afterwards from a recorded fact.

insert into public.events
  (slug, status, title_en, title_ar, summary_en, summary_ar,
   starts_at, ends_at, date_precision, series, edition)
values
{body}
on conflict (slug) do nothing;
""",
        encoding="utf-8",
    )

    print(f"wrote {OUT.relative_to(ROOT)} with {len(rows)} events")
    by_precision: dict[str, int] = {}
    for r in rows:
        key = "month" if "'month'" in r else "day"
        by_precision[key] = by_precision.get(key, 0) + 1
    print(f"  precision: {by_precision}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
