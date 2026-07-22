#!/usr/bin/env python3
"""
Generate the per-locale Open Graph cards (1200x630) into public/og/.

WHY THIS IS A SCRIPT AND NOT `next/og`
--------------------------------------
The obvious implementation is an `app/[locale]/opengraph-image.tsx` route using
`next/og`. It was built, and it is wrong for Arabic: Satori (which powers
`next/og`) has no Unicode bidi engine AND mis-measures connected scripts.

Measured on the real output, not assumed:
  * `direction: "rtl"` on the container and on the text node both produced a
    BYTE-IDENTICAL png. Satori does no bidi reordering at all, so Arabic words
    rendered in reverse order.
  * Reversing the word array fixes order but breaks on wrap (logically-first
    words land on the bottom line).
  * One span per word in `flexWrap` + `row-reverse` fixes order AND wrap, but
    the inter-word gaps came out at 1.23 / 0.92 / 1.63 em against English's
    normal 0.28 em, and UNEVEN.
  * The font is innocent: Thmanyah's U+0020 advance is 0.249 em.
  * The slack scales with letter count (5 letters -> 1.23em, 3 -> 0.92em,
    6 -> 1.63em). Satori draws the joined forms correctly but sizes each word's
    box from unshaped advances, so the surplus piles up at word boundaries.
    That slack is INSIDE the word box; no gap/margin/justify value can remove it.

Real Chrome shapes and measures Arabic correctly, so the cards are rendered
once here and committed as static assets. Two files, no runtime cost, no build
dependency, and perfect typography in both scripts.

USAGE
-----
    python3 scripts/generate-og-cards.py

Re-run it whenever `Meta.title`, `Meta.siteName` or `Meta.city` changes in
messages/*.json. The card copy is read straight from those files, so it can
never silently drift from the site.

Requires: python3 -m playwright (Chromium already installed in this repo's env).
"""

import http.server
import json
import pathlib
import socketserver
import threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "og"
PORT = 8477  # arbitrary high port, only alive for the duration of this script

# Brand tokens, mirrored from tailwind.config.ts. Kept literal because this
# file renders outside the Tailwind pipeline.
CORAL = "#FF5A48"
INK = "#111111"
BEIGE = "#fff7e9"
MUTED = "#a8a29a"


def card_html(locale: str, headline: str, site_name: str, city: str) -> str:
    """One self-contained card. Fonts load from /fonts (served from public/)."""
    is_ar = locale == "ar"
    direction = "rtl" if is_ar else "ltr"
    # Arabic sets wider per character and needs the looser leading the site
    # applies globally via the html[lang="ar"] heading rule in globals.css.
    size = 72 if is_ar else 86
    leading = 1.3 if is_ar else 1.05
    tracking = "0" if is_ar else "-2px"

    return f"""<!doctype html>
<html lang="{locale}" dir="{direction}">
<head>
<meta charset="utf-8">
<style>
  /* The real self-hosted brand face. Both weights carry Latin + Arabic, so
     there is no per-locale font swap, same as the site itself. */
  @font-face {{
    font-family: 'Thmanyah Sans';
    src: url('/fonts/thmanyah-sans-400.woff2') format('woff2');
    font-weight: 400; font-display: block;
  }}
  @font-face {{
    font-family: 'Thmanyah Sans';
    src: url('/fonts/thmanyah-sans-900.woff2') format('woff2');
    font-weight: 900; font-display: block;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    width: 1200px; height: 630px;
    background: {INK};
    font-family: 'Thmanyah Sans', sans-serif;
    padding: 80px;
    display: flex; flex-direction: column; justify-content: space-between;
    /* Chrome mirrors the whole layout off dir, including which edge the
       flex children flush against. No manual RTL branching needed. */
    text-align: start;
  }}
  /* The one brand-owned colour, doing the identifying. */
  .rule {{ width: 120px; height: 8px; background: {CORAL}; }}
  .stack {{ display: flex; flex-direction: column; gap: 28px; }}
  h1 {{
    font-weight: 900;
    font-size: {size}px;
    line-height: {leading};
    letter-spacing: {tracking};
    color: {BEIGE};
    max-width: 1040px;
    text-wrap: balance;
  }}
  .meta {{
    display: flex; align-items: center; gap: 18px;
    font-size: 30px; font-weight: 400; color: {MUTED};
  }}
  .meta .brand {{ color: {CORAL}; font-weight: 900; }}
</style>
</head>
<body>
  <div class="rule"></div>
  <div class="stack">
    <h1>{headline}</h1>
    <div class="meta">
      <span class="brand">{site_name}</span>
      <span>&middot;</span>
      <span>{city}</span>
    </div>
  </div>
</body>
</html>"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    pages = {}

    for locale in ("en", "ar"):
        msgs = json.loads((ROOT / "messages" / f"{locale}.json").read_text("utf-8"))
        meta = msgs["Meta"]
        # `Meta.title` is "MAZJ | Shared workspace in Al-Khobar"; the card
        # already says MAZJ in the meta row, so the headline is the half after
        # the pipe.
        title = meta["title"]
        headline = title.split("|")[1].strip() if "|" in title else title
        pages[locale] = card_html(locale, headline, meta["siteName"], meta["city"])

    # Serve from public/ so the @font-face /fonts/* URLs resolve, and so the
    # pages come over http:// with a real charset (file:// is unreliable for
    # this and mojibakes Arabic).
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(ROOT / "public"), **kw)

        def do_GET(self):  # noqa: N802
            locale = self.path.strip("/")
            if locale in pages:
                body = pages[locale].encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            super().do_GET()

        def log_message(self, format: str, *args: object) -> None:  # noqa: A002
            """Silence per-request logging; this server lives for two hits."""

    socketserver.TCPServer.allow_reuse_address = True
    server = socketserver.TCPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 1200, "height": 630},
                                    device_scale_factor=1)
            for locale in pages:
                page.goto(f"http://127.0.0.1:{PORT}/{locale}")
                # font-display:block + explicit wait, so no card is ever shot
                # mid-fallback-font (which would silently ship wrong metrics).
                page.evaluate("document.fonts.ready")
                page.wait_for_timeout(400)
                dest = OUT / f"{locale}.png"
                page.screenshot(path=str(dest))
                print(f"  wrote {dest.relative_to(ROOT)}")
            browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
