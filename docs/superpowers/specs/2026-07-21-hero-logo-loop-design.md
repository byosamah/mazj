# Hero Logo Loop (مزج writes itself) — Design

**Date:** 2026-07-21
**Status:** Design approved; implementation plan pending

## Goal

Give MAZJ a signature logo animation at the craft bar of godaylight.com's hero logo moment: the مزج wordmark writes itself in a loop inside the hero's square media window (over the coral dune video), until the visitor picks a space in the finder, then hands off permanently to the existing photo crossfade.

## Recon facts this design rests on

- Daylight's hero logo animation is an 8.9 KB Rive vector file rendered to canvas and **scrubbed by a GSAP timeline** (autoplay off), then exited via shrink + clip-path. Every other Daylight logo instance is a static SVG. No Lottie, no CSS keyframes, no stroke tricks in their DOM.
- MAZJ owns **no vector logo**. Best asset: `public/logos/mazj-wordmark.png` (559×412, every opaque pixel exactly #111111, monoline ~49 px strokes, 3 letterforms + 2 identical circle dots, ~1 px anti-alias fringe). mazj.sa's live site serves only a 240 px PNG, lower-res than ours.
- **Tool decision:** hand-author the mark as *stroked* SVG paths and choreograph with GSAP (already a project dependency; no plugins needed).
  - Rive/Lottie rejected: authored in GUI editors, add a runtime, and buy nothing over stroked SVG for a monoline mark.
  - Auto-trace (potrace/Adobe vectorize) rejected: produces filled outlines, which cannot do the pen-draw (`stroke-dashoffset`) effect. The mark's geometry (straight segments, quarter-circle corners, U-turn arches, 2 circles, uniform stroke) is simple enough to author by hand with higher fidelity.

## Component: `components/LogoLoop.tsx` (client)

- Props: `dismissed: boolean` (true once a space is selected in the finder).
- Renders one absolutely-positioned decorative layer for inside `.sf-frame`: `absolute inset-0 grid place-items-center`, `pointer-events-none`, `aria-hidden` (the mark is decoration; no text alternative needed).
- Inline `<svg viewBox="0 0 559 412">`, width ≈55% of the square, centered. Contents: 3 stroked `<path>` elements (م، ز، ج) + 2 `<circle>` dots.
- Stroke: `#FFF7E9` (site beige, matching hero type and chips), `stroke-width` ≈49 (measured from the PNG), butt caps, `fill="none"`.
- Paths are authored in **natural pen direction** so the dash-offset draw reads as writing. Dash lengths come from `getTotalLength()` at mount; no hardcoded lengths.

## Choreography (one GSAP timeline, `repeat: -1`)

First cycle delayed ~0.9 s so it starts after the square's own intro reveal. Cycle ≈7.1 s:

1. **Write ≈2.3 s:** م draws (0.75 s, `power2.inOut`) → ز draws (0.6 s, overlapping −0.15 s) → ز's dot pops (0.35 s, `back.out(2)`, like dotting an i) → ج draws (0.7 s) → ج's dot pops (0.35 s).
2. **Hold 2.5 s:** fully drawn mark over the breathing coral video.
3. **Unwrite ≈1.6 s:** dots shrink out (`back.in`, 0.25 s each), then ink retracts in reverse order (ج 0.45 s → ز 0.4 s → م 0.5 s, `power2.in`).
4. **Rest 0.7 s:** empty coral square, then repeat.

Strokes animate `stroke-dashoffset`; dots animate `scale` (transform-origin center).

## Integration (`components/Hero.tsx`)

- Render `<LogoLoop dismissed={selected != null} />` inside `.sf-frame`, **after** the coral `mix-blend-color` overlay (the blend layer repaints everything beneath it, so beige strokes must paint after it to stay beige; established repo stacking rule) and **before** the `.sf-slide` crossfade buffers (a chosen photo covers the logo).
- **Dismissal:** on the first `dismissed === true`, tween the layer to `autoAlpha: 0` (0.4 s) and `kill()` the timeline. It never restarts (matches the requirement: loop *until* a space is chosen).
- No CSS file changes. No i18n changes (the mark contains no copy; both message files untouched). Chips, caption, dropdown, CTA logic untouched.

## Edge cases

- **Reduced motion:** `prefers-reduced-motion` renders the mark fully drawn and static; no timeline is created (`gsap.matchMedia`).
- **Offscreen:** an IntersectionObserver pauses/resumes the timeline when the hero square leaves/enters the viewport.
- **Mobile:** none needed; `.sf-stage` is `hidden lg:block`, so the loop is desktop-only by inheritance and mobile is untouched.
- **RTL:** the mark is identical in both locales and must never be mirrored; the layer is centered, so the stage's logical-prop mirroring doesn't affect it.
- **React StrictMode double-mount:** timeline built in an effect with full cleanup (kill on unmount).

## Fidelity gate (before any animation work)

Render the static SVG at 559×412 via headless Chrome screenshot, binarize (threshold 128), and compare against `mazj-wordmark.png`: **IoU of opaque pixels ≥ 0.97** (the ~1 px AA fringe is excluded by the threshold). Iterate path coordinates until it passes. The animation is only as good as the mark.

## Verification

- `node_modules/.bin/tsc --noEmit` clean; `npm run lint` shows no NEW errors (the pre-existing `react-hooks/set-state-in-effect` error in `Hero.tsx` remains and may shift line numbers).
- Playwright captures on `/en` and `/ar`: with `reducedMotion: 'reduce'` the static drawn mark must show; without it, screenshots at write/hold/unwrite moments.
- A GIF of ~2 full cycles for motion review.
- Manual handoff test: select a space → logo fades out, photo crossfades in, CTA arms; logo never returns.

## Out of scope

- Mobile hero placement, nav/footer logo animation, any exportable MP4/GIF brand asset, and any change to the hero headline/intro choreography or the space-finder mechanics.
