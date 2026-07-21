# Hero Logo Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The مزج wordmark, rebuilt as stroked SVG, writes itself in a GSAP loop inside the hero's square media window until a space is selected, then fades out permanently as the photo crossfade takes over.

**Architecture:** A pure-data module (`components/logo-mark.ts`) holds the hand-authored vector geometry, gated by a pixel-diff fidelity harness against the source PNG. A client component (`components/LogoLoop.tsx`) renders it and owns one repeating GSAP timeline (write → hold → unwrite). `Hero.tsx` mounts it inside `.sf-frame` and feeds it `dismissed={selected != null}`.

**Tech Stack:** Next.js 16 / React 19, GSAP 3.15 core (already a dependency, NO plugins), inline SVG, Python3+Pillow and headless Chrome for the offline fidelity gate (dev tooling only, nothing shipped).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-21-hero-logo-loop-design.md`. Re-read it before starting.
- Stroke color `#FFF7E9` (site beige), `fill="none"`, butt caps. Stroke width comes from measurement (~49 viewBox units).
- viewBox `0 0 559 412` (the source PNG's pixel grid). The mark is NEVER mirrored in RTL.
- Fidelity gate: IoU of opaque pixels vs `public/logos/mazj-wordmark.png` ≥ **0.97** before any animation work.
- GSAP core only. No new npm dependencies. No changes to `app/globals.css`, `messages/*.json`, or any i18n key.
- LogoLoop mounts AFTER the coral `mix-blend-color` overlay and BEFORE the `.sf-slide` buffers (DOM order = paint order; the blend layer repaints everything beneath it).
- `prefers-reduced-motion: reduce` → static fully-drawn mark, no timeline.
- Repo rules: no em-dashes anywhere (comments, commits). Commits end with the Co-Authored-By + Claude-Session trailers. `npm run lint` has ONE pre-existing error (`react-hooks/set-state-in-effect` in Hero.tsx); the bar is "no NEW errors". Typecheck with `node_modules/.bin/tsc --noEmit`. Format-on-save may rewrite files mid-task: re-Read a file before a dependent edit.
- Playwright/browser automation is ALWAYS delegated to a subagent, never run in the main session.
- Scratch tooling lives in the session scratchpad (`$SCRATCH` below), never committed: `SCRATCH=/private/tmp/claude-501/-Users-osamakhalil-dev-mazj/64b77847-2644-4abe-8f93-e795e5ca8d98/scratchpad/logo-trace`

---

### Task 1: The vector mark (`components/logo-mark.ts`) behind a fidelity gate

**Files:**
- Create: `components/logo-mark.ts`
- Tooling (scratchpad only): `$SCRATCH/measure.py`, `$SCRATCH/specimen.mjs`, `$SCRATCH/fidelity.py`

**Interfaces:**
- Consumes: `public/logos/mazj-wordmark.png` (559×412 RGBA, all-#111111 mark).
- Produces: named export `MARK` shaped exactly:
  ```ts
  export const MARK = {
    viewBox: "0 0 559 412",
    strokeWidth: number,
    strokes: [ {id: "meem", d: string}, {id: "zain", d: string}, {id: "jeem", d: string} ], // WRITE order م ز ج, d in natural pen direction
    dots:    [ {id: "zain-dot", cx: number, cy: number, r: number}, {id: "jeem-dot", cx: number, cy: number, r: number} ], // write order
  } as const;
  ```
  Task 2 consumes `MARK` and relies on: strokes[] in write order, path direction = pen direction, dots[] in write order.

- [ ] **Step 1: Write the measurement script**

`$SCRATCH/measure.py` (pure Python + Pillow; no numpy installed):

```python
"""Measure mazj-wordmark.png: connected components, stroke width, ASCII preview."""
import json, sys
from collections import deque
from PIL import Image

SRC = "public/logos/mazj-wordmark.png"
img = Image.open(SRC).convert("RGBA")
W, H = img.size
px = img.load()
solid = [[px[x, y][3] >= 128 for x in range(W)] for y in range(H)]

# connected components (4-neighbour BFS)
label = [[0] * W for _ in range(H)]
comps, nid = [], 0
for y in range(H):
    for x in range(W):
        if solid[y][x] and not label[y][x]:
            nid += 1
            q = deque([(x, y)]); label[y][x] = nid
            minx = maxx = x; miny = maxy = y; area = 0; sx = sy = 0
            while q:
                cx, cy = q.popleft(); area += 1; sx += cx; sy += cy
                minx, maxx = min(minx, cx), max(maxx, cx)
                miny, maxy = min(miny, cy), max(maxy, cy)
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx, ny = cx+dx, cy+dy
                    if 0 <= nx < W and 0 <= ny < H and solid[ny][nx] and not label[ny][nx]:
                        label[ny][nx] = nid; q.append((nx, ny))
            comps.append({"id": nid, "bbox": [minx, miny, maxx, maxy], "area": area,
                          "centroid": [round(sx/area, 1), round(sy/area, 1)]})

# stroke width: median horizontal run length, ignoring runs > 90 (bars/arch tops)
runs = []
for y in range(H):
    x = 0
    while x < W:
        if solid[y][x]:
            x0 = x
            while x < W and solid[y][x]: x += 1
            if x - x0 <= 90: runs.append(x - x0)
        else: x += 1
runs.sort()
stroke = runs[len(runs)//2] if runs else 0

# ASCII preview, ~110 cols
step = max(1, W // 110)
for y in range(0, H, step * 2):
    print("".join("#" if solid[y][x] else "." for x in range(0, W, step)))

report = {"size": [W, H], "stroke_width_median": stroke, "components": comps}
json.dump(report, open(sys.path[0] + "/report.json", "w"), indent=1)
print(json.dumps(report["components"], indent=1), "\nstroke:", stroke)
```

- [ ] **Step 2: Run the measurement**

Run: `mkdir -p $SCRATCH && cd /Users/osamakhalil/dev/mazj && python3 $SCRATCH/measure.py`
Expected: 5 components (3 big letterforms, 2 dots ~1822 px area each), stroke ≈ 48-50, and an ASCII picture of the mark. Keep the ASCII output and `report.json` visible; every path coordinate in Step 5 is derived from them (dots: `cx,cy = centroid`, `r = (area/3.14159)**0.5`; strokes: centerline = bbox edge ± stroke/2).

- [ ] **Step 3: Write the render + compare harness**

`$SCRATCH/specimen.mjs` (regex-parses the TS data file, emits a pixel-exact specimen page):

```js
// Usage: node specimen.mjs  -> writes specimen.html next to itself
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
const here = path.dirname(url.fileURLToPath(import.meta.url));
const src = fs.readFileSync("components/logo-mark.ts", "utf8");
const strokeWidth = src.match(/strokeWidth:\s*([\d.]+)/)[1];
const ds = [...src.matchAll(/d:\s*"([^"]+)"/g)].map((m) => m[1]);
const dots = [...src.matchAll(/cx:\s*([\d.]+),\s*cy:\s*([\d.]+),\s*r:\s*([\d.]+)/g)];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="559" height="412" viewBox="0 0 559 412" fill="none">
${ds.map((d) => `<path d="${d}" stroke="#000" stroke-width="${strokeWidth}" stroke-linecap="butt"/>`).join("\n")}
${dots.map((m) => `<circle cx="${m[1]}" cy="${m[2]}" r="${m[3]}" fill="#000"/>`).join("\n")}
</svg>`;
fs.writeFileSync(path.join(here, "specimen.html"),
  `<!doctype html><meta charset="utf-8"><body style="margin:0">${svg}</body>`);
console.log("specimen.html written");
```

`$SCRATCH/fidelity.py`:

```python
"""IoU of rendered specimen vs source PNG + visual diff. Pass: IoU >= 0.97."""
import sys
from PIL import Image

render = Image.open(sys.path[0] + "/render.png").convert("L")   # black mark on white
src = Image.open("public/logos/mazj-wordmark.png").convert("RGBA")
W, H = src.size
assert render.size == (W, H), f"render is {render.size}, expected {(W, H)}"
rp, sp = render.load(), src.load()
inter = union = 0
diff = Image.new("RGB", (W, H), (255, 255, 255))
dp = diff.load()
for y in range(H):
    for x in range(W):
        a = rp[x, y] < 128          # rendered ink
        b = sp[x, y][3] >= 128      # source ink
        if a and b: inter += 1; dp[x, y] = (40, 40, 40)
        elif a: union += 0; dp[x, y] = (0, 90, 255)    # extra ink (blue)
        elif b: dp[x, y] = (255, 60, 40)               # missing ink (red)
        if a or b: union += 1
iou = inter / union if union else 0.0
diff.save(sys.path[0] + "/diff.png")
print(f"IoU = {iou:.4f}  ({'PASS' if iou >= 0.97 else 'FAIL'}, gate 0.97). diff.png written.")
sys.exit(0 if iou >= 0.97 else 1)
```

Render command (exact-pixel screenshot, used every iteration):

```bash
cd $SCRATCH && node specimen.mjs && \
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --screenshot=$SCRATCH/render.png --window-size=559,412 \
  --force-device-scale-factor=1 --hide-scrollbars --default-background-color=FFFFFFFF \
  "file://$SCRATCH/specimen.html" && cd /Users/osamakhalil/dev/mazj && python3 $SCRATCH/fidelity.py
```

(`specimen.mjs` reads `components/logo-mark.ts` relative to the repo cwd; run node from the repo root as shown.)

- [ ] **Step 4: Prove the gate can fail**

Create `components/logo-mark.ts` with a deliberately wrong stub (one centered square path):

```ts
export const MARK = {
  viewBox: "0 0 559 412",
  strokeWidth: 49,
  strokes: [
    {id: "meem", d: "M 150 100 H 400 V 300 H 150 Z"},
    {id: "zain", d: "M 200 150 H 350"},
    {id: "jeem", d: "M 200 250 H 350"},
  ],
  dots: [
    {id: "zain-dot", cx: 270, cy: 30, r: 24},
    {id: "jeem-dot", cx: 110, cy: 255, r: 24},
  ],
} as const;
```

Run the render command from Step 3.
Expected: `FAIL` with a low IoU (well under 0.5). If it passes, the harness is broken; fix it before continuing.

- [ ] **Step 5: Author the real paths and iterate to the gate**

Replace the stub's `strokes`/`dots`/`strokeWidth` with geometry derived from `report.json` + the ASCII preview. Authoring recipe (all coordinates are CENTERLINES; the 49-unit stroke fills ±24.5 around them):

- `strokeWidth`: the measured median exactly.
- Dots: `cx, cy` = component centroid, `r = sqrt(area/π)` (≈24 each).
- م (rightmost component): an inverted-U arch plus full-height right stem. One path, pen direction = start at the LEFT leg's lower end, up, over the arch (two quarter-circle arcs `A r r 0 0 1 ...` joined by a horizontal segment, r = corner radius read off the ASCII/diff), down the right stem to its bottom end.
- ز (middle): a J. Start at the top of the vertical, down, then a U-turn arc curving left/up (`A` arc), ending at the hook tip.
- ج (leftmost): the P-fold plus tail. Start at the top bar's LEFT end (butt cut at x=0 edge per the bbox), right along the bar, quarter-arc down, back left, then the descender: down and a bottom U-turn arc to the tail tip.
- Butt caps mean every path endpoint sits exactly half-a-stroke inside the source bbox edge it faces; use bbox values from `report.json`, not eyeballing.

Iterate: edit `logo-mark.ts` → rerun the Step 3 render command → open `$SCRATCH/diff.png` (red = missing ink, blue = extra ink) → adjust the offending coordinates. Systematic red/blue along an edge means a centerline is off by a few units; red at a terminal means a path stops short.

Expected end state: `IoU = 0.97xx (PASS)` or better, and `diff.png` shows only a thin fringe at edges (anti-aliasing), no solid red/blue regions.

- [ ] **Step 6: Typecheck**

Run: `node_modules/.bin/tsc --noEmit`
Expected: clean (same as before the task).

- [ ] **Step 7: Commit**

```bash
git add components/logo-mark.ts
git commit -m "feat: MAZJ mark as hand-authored stroked SVG data (fidelity-gated vs wordmark PNG)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Wb2j9Y5oYNzXzwzJSTabHw"
```

---

### Task 2: `components/LogoLoop.tsx`

**Files:**
- Create: `components/LogoLoop.tsx`

**Interfaces:**
- Consumes: `MARK` from `components/logo-mark.ts` (Task 1 shape: `strokes[]` write-ordered with pen-direction `d`, `dots[]` write-ordered, `strokeWidth`, `viewBox`).
- Produces: `export default function LogoLoop({dismissed}: {dismissed: boolean})` — a `pointer-events-none absolute inset-0` layer, `aria-hidden`, root carries `data-logo-loop` (Task 4 asserts on it). Task 3 mounts it.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import {useEffect, useRef} from "react";
import gsap from "gsap";
import {MARK} from "./logo-mark";

/**
 * The مزج mark writes itself in a loop inside the hero media square:
 * write (strokes draw via dash-offset, dots pop) -> hold -> unwrite -> rest.
 * `dismissed` flips true when a space is picked; the layer then fades out
 * for good and the photo crossfade owns the square.
 * Reduced motion renders the mark fully drawn with no timeline.
 * The layer starts opacity-0 so pre-hydration paint shows only the coral video.
 */
export default function LogoLoop({dismissed}: {dismissed: boolean}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);
  const killedRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || killedRef.current) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(root, {autoAlpha: 1});
      return;
    }

    const strokes = Array.from(root.querySelectorAll<SVGPathElement>("[data-stroke]"));
    const dots = Array.from(root.querySelectorAll<SVGCircleElement>("[data-dot]"));
    // +1 over the true length so float rounding never leaks a seam of ink.
    const lens = strokes.map((p) => p.getTotalLength() + 1);
    strokes.forEach((p, i) => gsap.set(p, {strokeDasharray: lens[i], strokeDashoffset: lens[i]}));
    gsap.set(dots, {scale: 0, transformOrigin: "50% 50%"});
    gsap.set(root, {autoAlpha: 1});

    // write ~2.3s -> hold 2.5s -> unwrite ~1.6s -> rest 0.7s (repeatDelay)
    const tl = gsap.timeline({repeat: -1, delay: 0.9, repeatDelay: 0.7, paused: true});
    tl.to(strokes[0], {strokeDashoffset: 0, duration: 0.75, ease: "power2.inOut"})
      .to(strokes[1], {strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut"}, "-=0.15")
      .to(dots[0], {scale: 1, duration: 0.35, ease: "back.out(2)"}, "-=0.1")
      .to(strokes[2], {strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut"}, "-=0.2")
      .to(dots[1], {scale: 1, duration: 0.35, ease: "back.out(2)"}, "-=0.1")
      .to(dots, {scale: 0, duration: 0.25, ease: "back.in(2)", stagger: 0.08}, "+=2.5")
      .to(strokes[2], {strokeDashoffset: lens[2], duration: 0.45, ease: "power2.in"}, "<0.15")
      .to(strokes[1], {strokeDashoffset: lens[1], duration: 0.4, ease: "power2.in"}, "-=0.1")
      .to(strokes[0], {strokeDashoffset: lens[0], duration: 0.5, ease: "power2.in"}, "-=0.1");
    tlRef.current = tl;

    // Run only while the hero square is on screen.
    const io = new IntersectionObserver(([entry]) => {
      if (killedRef.current) return;
      if (entry.isIntersecting) tl.play();
      else tl.pause();
    });
    io.observe(root);
    ioRef.current = io;

    return () => {
      io.disconnect();
      tl.kill();
      gsap.killTweensOf(root);
    };
  }, []);

  useEffect(() => {
    if (!dismissed || killedRef.current) return;
    killedRef.current = true;
    tlRef.current?.kill();
    ioRef.current?.disconnect();
    gsap.to(rootRef.current, {autoAlpha: 0, duration: 0.4, ease: "power2.out"});
  }, [dismissed]);

  return (
    <div
      ref={rootRef}
      data-logo-loop
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 grid place-items-center opacity-0"
    >
      <svg className="w-[55%]" viewBox={MARK.viewBox} fill="none">
        {MARK.strokes.map((s) => (
          <path key={s.id} data-stroke d={s.d} stroke="#FFF7E9" strokeWidth={MARK.strokeWidth} strokeLinecap="butt" />
        ))}
        {MARK.dots.map((d) => (
          <circle key={d.id} data-dot cx={d.cx} cy={d.cy} r={d.r} fill="#FFF7E9" />
        ))}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `node_modules/.bin/tsc --noEmit && npm run lint`
Expected: tsc clean; lint exits 1 with ONLY the pre-existing Hero.tsx `react-hooks/set-state-in-effect` error (component is unmounted so runtime is exercised in Task 3).

- [ ] **Step 3: Commit**

```bash
git add components/LogoLoop.tsx
git commit -m "feat: LogoLoop component, GSAP write/hold/unwrite loop for the MAZJ mark

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Wb2j9Y5oYNzXzwzJSTabHw"
```

---

### Task 3: Mount in `Hero.tsx`

**Files:**
- Modify: `components/Hero.tsx` (import block ~line 7; inside `.sf-frame`, between the coral blend overlay div ~line 244 and the crossfade buffers comment ~line 246; re-Read the file first, format-on-save may have shifted lines)

**Interfaces:**
- Consumes: `LogoLoop` from Task 2; Hero's existing `selected` state (`number | null`).
- Produces: the shipped feature; no new exports.

- [ ] **Step 1: Add the import**

After `import {BOOKING} from "@/lib/links";`:

```tsx
import LogoLoop from "./LogoLoop";
```

- [ ] **Step 2: Mount the layer**

Directly after the coral blend overlay div (`<div aria-hidden className="pointer-events-none absolute inset-0 bg-[#FF5A48] mix-blend-color" />`) and BEFORE the `{/* crossfade photo buffers ... */}` comment, insert:

```tsx
          {/* The مزج mark writes itself over the coral panel until a space is
              chosen, then fades out for good (chosen photos also cover it).
              Sits after the blend overlay so the beige strokes stay beige. */}
          <LogoLoop dismissed={selected != null} />
```

- [ ] **Step 3: Typecheck and lint**

Run: `node_modules/.bin/tsc --noEmit && npm run lint`
Expected: tsc clean; lint shows only the pre-existing Hero.tsx error (line number may shift; same rule, count of errors still 1).

- [ ] **Step 4: Live smoke check (delegate to a subagent)**

Dev server is already on :3000; component edits hot-reload. Dispatch a subagent to capture http://localhost:3000/en with Playwright, `reducedMotion: 'reduce'`, viewport 1440×900, wait for `header` + 1.5s settle, screenshot the full page. (Playwright writes screenshots only inside the repo root; save to `.audit-shots/` then move to the scratchpad.)
Expected: the fully drawn beige مزج mark centered over the coral square (reduced motion = static drawn state).

- [ ] **Step 5: Commit**

```bash
git add components/Hero.tsx
git commit -m "feat: mount LogoLoop in the hero media square, dismissed on space selection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Wb2j9Y5oYNzXzwzJSTabHw"
```

---

### Task 4: Full verification (browser subagent) + user review pack

**Files:**
- No repo changes. Outputs land in the scratchpad: `hero-loop.gif`, motion stills, handoff stills, `/ar` still.

**Interfaces:**
- Consumes: the running dev server (:3000), `data-logo-loop` attribute (Task 2), `.sf-trigger` / `.sf-option` selectors (existing).
- Produces: evidence files for the user; a pass/fail report per spec checklist.

- [ ] **Step 1: Motion capture (subagent, Playwright, NO reducedMotion)**

Dispatch a subagent to run a Playwright script: viewport 1440×900, record video, open `/en`, wait for `header` + 1s, hold 17s (two full ~7.1s cycles + the 0.9s lead-in), close. Convert the saved .webm to a GIF of the square region with ffmpeg two-pass palette:

```bash
ffmpeg -y -i video.webm -vf "crop=iw*0.42:ih*0.62:iw*0.55:ih*0.16,fps=15,scale=480:-1,split[a][b];[a]palettegen[p];[b][p]paletteuse" hero-loop.gif
```

(Adjust the crop rect to frame the square from the recorded video's actual layout before converting.) Also extract 3 stills from the video at a write moment, the hold, and an unwrite moment (`ffmpeg -ss <t> -i video.webm -frames:v 1 ...`).
Expected: strokes draw in م → ز → ج order with dots popping after their letters, hold, ink retracts, ~0.7s empty beat, seamless repeat.

- [ ] **Step 2: Handoff test (same subagent run)**

In a fresh page (no reducedMotion): click `.sf-trigger`, click the first `.sf-option`, wait 1.2s, then screenshot AND evaluate:

```js
const el = document.querySelector('[data-logo-loop]');
({visibility: getComputedStyle(el).visibility, opacity: getComputedStyle(el).opacity})
```

Expected: screenshot shows the day-desk photo filling the square (no mark); evaluate returns `visibility: "hidden", opacity: "0"`. Reopen the dropdown, pick a second space: photo crossfades, logo still hidden (never returns).

- [ ] **Step 3: RTL + reduced-motion matrix (same subagent run)**

Capture `/ar` with `reducedMotion: 'reduce'` (static drawn mark, square mirrored to the left, mark NOT mirrored: م on the right of the mark) and `/en` with `reducedMotion: 'reduce'` (already from Task 3; re-verify post-integration).
Expected: identical mark orientation in both locales.

- [ ] **Step 4: Console + regression sweep**

In the subagent's motion run, collect console errors on `/en` and `/ar` (filter severity error).
Expected: none introduced (hydration warnings, GSAP errors = fail). Main session: `node_modules/.bin/tsc --noEmit` one last time.

- [ ] **Step 5: Send the evidence to the user**

Send `hero-loop.gif`, the three motion stills, the handoff still, and the `/ar` still with a short verdict per spec checklist item. No commit (nothing changed).

---

## Self-Review (done at write time)

- **Spec coverage:** mark rebuild + gate (Task 1), choreography + reduced motion + IO pause + dismissal (Task 2), stacking + mount + no-i18n (Task 3), verification incl. RTL, handoff, GIF (Task 4). Out-of-scope items untouched.
- **Placeholders:** none; every code step ships complete code. Path coordinates are produced by Task 1's measured recipe + executable gate rather than invented at plan time, with the harness proven able to fail (Step 4).
- **Type consistency:** `MARK` shape defined in Task 1 = consumed in Task 2 (`strokes[i].d/id`, `dots[i].cx/cy/r/id`, `strokeWidth`, `viewBox`); `dismissed: boolean` defined in Task 2 = passed in Task 3; `data-logo-loop` defined in Task 2 = asserted in Task 4.
