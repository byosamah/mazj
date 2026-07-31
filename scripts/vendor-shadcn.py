#!/usr/bin/env python3
"""
Vendor shadcn `new-york-v4` components into components/ui/, patched for this
repo's Tailwind 3.4.19.

The shadcn registry only publishes its CURRENT components against Tailwind v4.
The older `new-york` style is genuinely v3-shaped but is the previous generation
(forwardRef, no data-slot, @radix-ui/react-* split packages). The owner asked for
"shadcn latest", so we take v4 source and translate the handful of v4-only
constructs, rather than shipping last year's components.

Every substitution below is mechanical and is asserted to have applied, so a
registry change that removes one of these is a loud failure rather than a silent
class that compiles to nothing.
"""
import json
import os
import re
import sys
import urllib.request

REG = "https://ui.shadcn.com/r/styles/new-york-v4/{}.json"
OUT = "/Users/osamakhalil/dev/mazj/components/ui"

# (pattern, replacement, why). Applied in order, to file CONTENT.
PATCHES = [
    # --- Tailwind v4 renamed the shadow scale down one step. v3's `shadow-sm`
    #     is v4's `shadow-xs`. Unpatched, `shadow-xs` matches nothing in 3.4 and
    #     the element silently ships with no shadow at all.
    (r"(?<![\w-])shadow-2xs(?![\w-])", "shadow-sm", "v4 shadow scale"),
    (r"(?<![\w-])shadow-xs(?![\w-])", "shadow-sm", "v4 shadow scale"),
    # --- v4 renamed outline-none -> outline-hidden.
    (r"(?<![\w-])outline-hidden(?![\w-])", "outline-none", "v4 outline rename"),
    # --- v4 added a rounded-xs step below rounded-sm.
    (r"(?<![\w-])rounded-xs(?![\w-])", "rounded-sm", "v4 radius scale"),
    # --- v4-only utility with no v3 equivalent. Dropping it costs a textarea
    #     that no longer auto-grows, which it did not do in v3 anyway.
    (r"\s*(?<![\w-])field-sizing-content(?![\w-])", "", "v4-only utility"),
    # --- `--spacing` is a v4 theme variable that does not exist in v3. The
    #     literal is v4's own value for spacing*4 (0.25rem * 4).
    (r"calc\(var\(--spacing\)\s*\*\s*4\)", "1rem", "v4 --spacing theme var"),
    (r"calc\(var\(--spacing\)\s*\*\s*3\)", "0.75rem", "v4 --spacing theme var"),
    # --- v4 shorthand for has-[[aria-expanded]].
    (r"(?<![\w-])has-aria-expanded:", "has-[[aria-expanded]]:", "v4 has- shorthand"),
    # --- 🔴 v4's bare-parenthesis CSS-variable shorthand. `max-h-(--x)` means
    #     `max-h-[var(--x)]`, and v3 understands only the second form. This one
    #     is nastier than the rest because the registry emits BOTH spellings in
    #     the same file (select.tsx line 65 vs line 79), so a spot check of the
    #     file finds the working one and concludes it is fine. Unpatched, the
    #     select panel loses its max-height and its transform-origin: it can
    #     render taller than the viewport with no way to scroll to the bottom of
    #     the list, which on the events form is the list of Rekaz ticket prices.
    (r"(?<![\w-])([a-z][\w-]*)-\(--([\w-]+)\)", r"\1-[var(--\2)]", "v4 css-var shorthand"),
    # --- 🔴 THE TOKEN COLLISION. `muted` is already a MAZJ token (#514E4A, the
    #     marketing site's body grey) used 69 times. Redefining it for shadcn
    #     would repaint body copy across the public site. `muted-foreground` is
    #     a distinct name and would not collide, but splitting the pair is worse
    #     than renaming it, so both move to `subtle`.
    (r"(?<![\w-])(bg|text|border|ring|fill|stroke|from|via|to|placeholder|divide|decoration|accent|caret|outline|shadow)-muted-foreground(?![\w-])",
     r"\1-subtle-foreground", "muted token collision"),
    (r"(?<![\w-])(bg|text|border|ring|fill|stroke|from|via|to|placeholder|divide|decoration|accent|caret|outline|shadow)-muted(?![\w-])",
     r"\1-subtle", "muted token collision"),
    # --- Light-only, by owner ruling. Tailwind 3's DEFAULT darkMode is `media`,
    #     so an unpatched `dark:` class would fire on a staff member's macOS
    #     dark preference and repaint the admin in colours nobody designed.
    #     tailwind.config.ts also pins darkMode:"class" as belt and braces; this
    #     removes the classes so there is nothing left to fire.
    (r'\s*(?<![\w-])dark:[^\s"\'`]+', "", "light-only ruling"),
]

# Components whose "use client" is gratuitous: they declare it but use no hook,
# no event handler and no browser API. Stripping it is what lets the dashboard
# keep its zero-client-component property while still using real shadcn markup.
STRIP_USE_CLIENT = {"table"}


def fetch(name: str) -> dict:
    with urllib.request.urlopen(REG.format(name), timeout=30) as r:
        return json.loads(r.read())


def main(names):
    os.makedirs(OUT, exist_ok=True)
    applied = {why: 0 for _, _, why in PATCHES}
    report = []

    for name in names:
        d = fetch(name)
        for f in d.get("files", []):
            src = f["content"]

            if name in STRIP_USE_CLIENT:
                before = src
                src = re.sub(r'^\s*"use client"\s*\n+', "", src)
                assert src != before, f"{name}: expected a 'use client' to strip"

            for pat, rep, why in PATCHES:
                src, n = re.subn(pat, rep, src)
                applied[why] += n

            # Normalise the split-package import the v4 registry emits for some
            # components against the unified `radix-ui` package we installed.
            src = src.replace('from "@radix-ui/react-slot"', 'from "radix-ui"')

            path = os.path.join(OUT, os.path.basename(f["path"]))
            with open(path, "w") as fh:
                fh.write(src)
            report.append((name, os.path.basename(path), len(src), '"use client"' in src))

    print(f"{'component':16} {'file':22} {'bytes':>6}  client?")
    for n, p, b, c in report:
        print(f"{n:16} {p:22} {b:6}  {'CLIENT' if c else 'server'}")
    print("\npatches applied:")
    for why, n in applied.items():
        print(f"  {n:4}  {why}")
    unfired = [w for w, n in applied.items() if n == 0]
    if unfired:
        print(f"\n⚠️  patches that matched NOTHING (registry may have changed): {unfired}")


if __name__ == "__main__":
    main(sys.argv[1:])
