# `components/`: UI, RTL, typography, motion, media

Scope: how things **look and behave** on screen, and how to prove a visual change
actually worked. This is the densest file in the repo because it is where the
expensive mistakes live.

- Routing, layout, metadata, SEO, `globals.css` location → [`../app/CLAUDE.md`](../app/CLAUDE.md)
- Copy rules and the i18n both-file rule → [`../CLAUDE.md`](../CLAUDE.md)
- Backend → [`../server/CLAUDE.md`](../server/CLAUDE.md)
- 🔴 **How it should LOOK is [`../DESIGN.md`](../DESIGN.md)** (colour, type, space, shape, motion, component form). Read it before any visual change and keep it in sync when a token or idiom changes. It is a strict Google `design.md` file (lints 0/0 against `npx @google/design.md lint`), so it is the machine-readable contract too: `npx @google/design.md export DESIGN.md --format tailwind|dtcg` regenerates a theme or a `tokens.json`.
- How it should SOUND is [`../TONE.md`](../TONE.md).

---

## RTL

- `<html dir="rtl">` is set for Arabic. Prefer **logical** Tailwind utilities
  (`ps-`/`pe-`, `start-`/`end-`, `text-start`/`text-end`) over physical
  (`pl-`/`left-`) so layouts mirror correctly.
- Physical *inline* values that logical utilities cannot reach (clip-path insets,
  the absolutely-positioned hero chips, the nav pill's asymmetric padding) are
  flipped in-component via `useLocale() === "ar"`. Mirror any new ones.
- 🔴 Tailwind **directional** utilities are physical and do NOT mirror
  (`bg-gradient-to-r`, `rotate-*`, etc.). Branch on locale
  (`rtl ? "bg-gradient-to-l" : "bg-gradient-to-r"`), with **both** class names
  written literally so the JIT emits them.

### 🔴 A HYPHENATED NUMBER RANGE IN ARABIC COPY RENDERS BACKWARDS

`9-5` inside an Arabic sentence displays on screen as **`5-9`**, and nothing
errors. Measured and fixed 2026-08-02, on the one string where it mattered most:
`SpaceCoworking.facts[2].value` said `الخميس 9-5` and rendered the staffed hours
as 5 to 9, which is the exact misreading the 9-to-5 correction exists to
prevent. The same fault put `فترات 2-5 ساعات` on **five** routes as 5 to 2.

**Why.** After an Arabic letter, Unicode bidi rule W2 retypes the digits from
European to Arabic numbers. Rule W4 then cannot absorb the `-`, because it joins
**European** numbers only, so W6 makes it a neutral and N1 resolves it to R
between two AN runs. The two numbers end up on opposite sides of the separator
from where they were typed. A space around the hyphen does not help, and neither
does an en dash: both are neutrals.

**The fix is the site's own construction, not punctuation:** `من 9 إلى 5`,
`من 2 إلى 5 ساعات`. Leave the English twin alone; it is an LTR paragraph and was
never affected. `24/7` is safe (a solidus between two ANs stays an AN run).

✅ **BUT AN `Intl` DATE RANGE IS NOT THIS BUG, AND IT WILL BE FILED AS ONE.**
`/ar/events` renders `١٧-١٨ فبراير ٢٠٢٣` with the same transposition, and it is
CORRECT: `Intl.DateTimeFormat(...).formatRange()` for `ar-SA` produces that
string byte for byte (verified in this repo's Node), so it is CLDR's canonical
Arabic range format rather than anything this codebase chose. ⚠️ The obvious fix
is also measured and does **nothing**: `dir="ltr"` returns the identical output,
because Arabic-Indic digits are class AN and stay RTL-ordered regardless of the
paragraph direction. Do not touch it.

**Verify a bidi claim against a real implementation, never by reasoning.**
`python-bidi` (`from bidi.algorithm import get_display; get_display(s,
base_dir='R')`) and the `fribidi` CLI are both installed and agree.
⚠️ `get_display` returns VISUAL order, so read its output as screen order, and
check whether a reader parsing a numeric range left-to-right would get the
number the copy meant.

## 🔴 Arabic typography and the clipping rule

This is the single most expensive area in the repo. Read it before touching any
display heading.

**Arabic display glyphs clip at the BOTTOM** (descenders past the baseline)
inside the hero's `.intro-mask` (`overflow: clip`), NOT at the top. **BOTH
locales clip**, and Arabic is the worse case: AR descenders run ~2x Latin's.

Two separate, both-load-bearing mitigations:

1. `html[lang="ar"] h1,h2,h3 { line-height: 1.35 }` gives multi-line Arabic
   headings room so adjacent lines don't collide.
2. The mask's own `padding-bottom` plus a matching negative margin (0.15em EN,
   0.23em AR) is what actually saves the descender.

**1.35 alone does NOT fix the clip.** Measured: AR `اعمل في` still lost 4.35px at
85px and 2.16px at 40px while EN cleared. Keep both.

🔴 **ARABIC IS THE WORSE CASE, NOT THE RESCUED ONE.** This was documented
backwards for a while and shipped that way. Measured AR `اعمل في` clipped **+4.35px
at 85px** and **+2.16px at 40px**, while EN `good company.` was **clean** (0.51px
spare at 85px, 1.19px at 40px). Confirmed two independent ways that agreed:
canvas `TextMetrics` with a 0×0 `vertical-align:baseline` probe span, and a
pixel-diff A/B toggling `overflow:clip`→`visible` (ar-1440 restored 4.33px across
367 changed pixels; en-1440 and en-390 both returned bbox `None`, **zero** pixels
changed). Visually it is the two dots under the final ي of `في` flattened into
trapezoids. **Check AR first, then EN**: EN's 0.51px margin is one weight or
leading change from breaking too.

**The cause is the BASELINE, not ink height.** The right test is
`descent > (lineBox − baselineOffset)`. "Ink > line box" wrongly reports OK: the
hero h1 at Sans 900/85px has ink of 78.8px which *fits* the 83.3px box, yet the
baseline sits 73px down, leaving 10.3px for a 19.5px descender. Clipping is
bottom-only; top overflow is 0. **Fix by enlarging the clip box** (padding-bottom
plus matching negative margin), never by loosening leading. See the comment at
`globals.css` `.intro-mask`.

**The mask padding has a hard ceiling.** `.intro-line` animates in from
`translateY(120%)`, so padding must stay ≤ **0.2em** of the line-height or the
incoming line shows before it animates. Arabic needs ~0.051em, so it fits, but
verify at **both** the 85px desktop and 40px mobile sizes (the ceiling is relative
to line-height, and the two differ).

🔴 **The `h1,h2,h3` rescue cannot reach a `<span>` or a `<p>`.** Arabic display
text in a non-heading tag needs an explicit `leading-[1.35]` at the call site.
Measured live in `WhyMazj.tsx` (`Reveal as="span"`, `lg:text-45 leading-tight`):
at 1024 AR the ink is **71.24px inside a 56.25px line box**, a −14.99px gap, i.e.
adjacent lines' glyph ink physically collides. EN clears by +5 to +11px at every
size. Note that Arabic words render in the EN build too, where the
`html[lang="ar"]` rule never fires at all.

**So make big display headings real heading tags.** WhyMazj's two card statements
render via `WordReveal as="h2"` for exactly this reason. Every `as="h2"` in the
repo is a `WordReveal`; a bare `Reveal as="h2"` exists nowhere. WhyMazj's three
risk lines are deliberately `Reveal as="span"` (one continuous statement, not a
heading) and therefore carry an explicit `leading-[1.35]`: never drop it.

## Fonts

Self-hosted **Thmanyah** (خط ثمانية, Sans only) in `public/fonts`
(`thmanyah-sans-{400,500,700,900}.woff2`). Each file carries **both** Latin and
Arabic, so there is no per-locale font swap. `app/globals.css` `:root` sets
`--font-sans` / `--font-mono` (both = Thmanyah Sans).

- **All 45 `font-mono` classes were deleted**: it was a no-op alias for the sans
  face.
- The label register is `.eyebrow` in `globals.css` (weight 500 + uppercase +
  `var(--eyebrow-tracking)`); colour and size stay as Tailwind utilities at the
  call site so they never fight it on specificity. It is keyed on **WEIGHT**
  because `uppercase` and `letter-spacing` are **both** no-ops in Arabic, so
  weight is the only signal that survives either writing system.
- **The whole page is Sans.** Every heading (hero, USP, Steps intro, the Why
  statements, Network, StepInto, Footer) is `font-sans`; the large section
  statements are `font-sans font-bold` (700): Steps intro, `WhyMazj.tsx`,
  `Network.tsx`, `StepInto.tsx`. Don't "restore" these to `font-medium`: 500 was
  the old serif-era weight, deliberately raised to 700. 700 is a real self-hosted
  weight, so Arabic gets true bold, never synthetic.
- The **Serif Display** family was fully removed: the woff2 files are deleted and
  the `@font-face` blocks plus `--font-serif` var are gone. Tailwind's
  `font-serif` now just falls back to `Georgia`, and nothing uses it. The
  `html[lang="ar"]` block only neutralizes Latin letter-spacing and bumps heading
  line-height (no family remap; Tajawal/Aeonik/Feature/Social retired, and those
  woff2s are also unused).
- Hero headline (`Hero.tsx`) is `font-sans font-black` (900), subtitle
  `font-normal`.

🔴 **Kashida swashes on Arabic headings are a house standard, and the font caps
them at 5.** Thmanyah ships 690 hand-drawn elongation glyphs (138 letter shapes ×
runs of 1-5, all four weights); there is no sixth, so a 6th tatweel silently
degrades to six generic `U+0640` glyphs.

⚠️ **That degrade was described here as "a thin flat rule that does not match the
stroke weight", and the WEIGHT half of that is wrong.** Measured from rendered
pixels 2026-07-30: the 6-run is the **same** thickness as its neighbours
(13.33 CSS px at 85px, matching the letters' 12.67-13.33). What actually breaks is
the SHAPE. A drawn swash modulates 178-220% of its median thickness and its
centreline **rises 16-28 CSS px** across the run; the 6-run is dead constant (2%)
and perfectly flat (0.17px rise). So it reads as a ruled line because it is
STRAIGHT, not because it is light, and **a thickness check alone will never catch
it.** It is also materially WIDER, not narrower: at 85px/700 the totals jump
+51.4px (`خاصة`) and +52.2px (`للمبدعين`) going from 5 to 6. The cheapest tell of
all needs no pixels: at six the elongation measures **113.2px regardless of which
letter precedes it**, because generic tatweels no longer know, while a real drawn
run differs per letter (40.9 vs 32.7 at three). The rule,
the legal joins and the verification recipe live in [`TONE.md`](../TONE.md) §8.1,
and `test/arabic-kashida.test.ts` pins the inventory. Don't hand-tune a heading's
tatweel count here without reading both.

🔴 **THE FONTS ARE DELIBERATELY NOT PRELOADED. This was built, measured, and
taken back out — do not "fix" the missing `rel=preload` from an audit.** The
observation behind it is real (the four woff2 files are requested **last**, at
169ms, because a `@font-face` URL cannot be discovered until `globals.css` has
been fetched, parsed and matched against laid-out text). But `font-display: swap`
means they were never blocking paint: text renders in the fallback immediately.
So preloading only puts 152 KB of font bytes ahead of the render-blocking
stylesheet, which they win, because a preload sits above it in the head.
Measured on the same build with one variable changed: `/en/about` FCP **2.0s with
the preload versus 0.9s without**, `/en/spaces` the same, and the two routes that
had been fastest on the site were the ones it hurt most. The full reasoning is
in a comment in `app/[locale]/layout.tsx`.

⚠️ **If a preload is ever wanted (to kill the swap flash, not to chase a metric),
SUBSET FIRST.** Split by `unicode-range` the faces are **11.4 KB Latin + 43.2 KB
Arabic** against 75.7 KB combined. That was built and verified during the
2026-07-31 audit: zero codepoints lost across all four weights.

🔴 **The naive subset silently drops 140 of the 690 kashida glyphs (690 → 550),
and nothing errors.** `pyftsubset`'s layout closure fails to reach the
`*.calt4*` contextual alternates, so the swash inventory this repo depends on
comes out quietly incomplete. Retaining them needs an explicit `--glyphs-file`
listing every Arabic and kashida glyph BY NAME alongside `--unicodes`. Verify by
counting `'kashida' in glyphname` before and after, never by file size. It was
not shipped because English pages render Arabic too (14-32 characters on the
routes measured), so both subsets load and the real saving is ~63 KB rather than
the ~190 KB it first appears to be.

**Adding or verifying a font:** `fonttools` (Python) is installed. Check a woff2's
glyph coverage (Arabic `U+0627` plus Latin present) before wiring it, and check
any SPECIAL character before shipping it (`U+0640` tatweel was confirmed in all
four weights before the hero kashida went in). External font CDNs (e.g.
`framerusercontent.com`) aren't in the sandbox network allowlist, so curl font
binaries with the sandbox disabled (`github.com` and `raw.githubusercontent.com`
ARE allowed). Standalone HTML font specimens need `<meta charset="utf-8">` or
Arabic mojibakes, and Playwright MCP can't open `file://` (serve over 127.0.0.1
with a UTF-8 charset).

🔴 **`h1`/`h2`/`h3` carry `letter-spacing: -0.02em` in `globals.css`, so CHANGING
A TAG TO A HEADING RESTYLES THE COPY.** The FAQ questions moved from `<dt>` to
`<h3>` (the `<dl>` was invalid HTML — the accordion's `<input>` cannot legally
sit inside one) and silently picked up **-0.32px** of tracking at 16px. Nothing
errored and the page looked fine; it was caught only by diffing the computed
`letterSpacing` against the previous build. `.acc-label` now resets it to
`normal`, and the rendered question measures 258.63px on both, byte for byte.
The ramp is for DISPLAY headings; a question marked up as a heading for rotor
navigation is still body-register text. **Check computed tracking after any
tag change into `h1`-`h3`.** English only: `html[lang="ar"] *` already forces
`letter-spacing: normal`.

## Type scale

🔴 **The Tailwind `fontSize` scale is sparse above 40** (`tailwind.config.ts`):
only **45, 50, 70, 85** exist. No 55/60/65/75/**80**. A missing token like
`text-80` is a DEAD class: it silently falls back to the base size, with no
error. Confirm the `text-NN` key exists before using it (`lg:text-80` shipped as
45px this way). A full audit on 2026-07-26 found **4 more, in 2 files, both big
display headings rendering as inherited 16px on phones**: `StepInto`
(`text-44 sm:text-64`) and `FoundingBand` (`text-34 xl:text-52`), fixed to
45/70/85 and 32/40/50. **Re-run the detector before adding any display size:**
match `(?:[a-z]+:)?text-(\d{1,3})\b` across `components/` and `app/`, and reject
anything outside the scale set.

**`text-wrap` is applied site-wide:** `text-balance` on section headings,
`text-pretty` on body copy. Section titles carry hand-placed line breaks and
render via `whitespace-pre-line`; `balance`/`pretty` coexist with it (the hard
breaks win, so `balance` only evens the soft wraps). **Exception: the hero H1**
(manual `.intro-line` split) must never get `text-balance`.

## `PageIntro`, the shared sub-page opener (~9 routes)

`WordReveal` h1 + ruled meta row + optional route media, or the `dot-field`
texture when `image` is omitted (reference routes faq/privacy/terms deliberately
stay quiet). **Keep its `<h1>` a real `<h1>`** for the Arabic clip rule.

It takes `variant`:

- `"panel"` (default), as above.
- `"hero"`, a FULL-BLEED photo opener (photo `absolute inset-0 object-cover`
  behind a scrim, copy bottom-start in OPAQUE beige, h1 `lg:text-85`), opted into
  on the 8 photo routes (about/contact/events/spaces + 4 space-details).
  faq/privacy/terms stay `panel`; the landing is untouched.

AA over bright photos needs BOTH the bottom-heavy inline scrim AND `.hero-x-scrim`
(a start-side scrim flipped by `[dir="rtl"]`, since AR copy mirrors onto the
photo's opposite side).

## Design reference: godaylight.com

The visual system is reskinned from **Daylight Energy**; its canonical tokens are
published at `godaylight.com/brand`. Match Daylight's system EXCEPT keep three
MAZJ-owned things: **coral `#FF5A48`** (never Daylight's orange `#F66F00`), the
**مزج wordmark**, and **Thmanyah**. Wherever Daylight uses orange, MAZJ
substitutes coral.

What to match: crisp radii `2/4/6/16`; UPPERCASE eyebrows tracked `+0.05em` at
12/16px (Daylight's own published spec is `+5%` at 12/16px too, verified on
`/brand` 2026-07-26, i.e. we agree with them; their live homepage renders
`-0.02em` only because their compiled `.text-12` bakes in a negative default their
eyebrows never override, which is an implementation slip on their side, and their
labels are set in a MONO face whose wide sidebearings absorb negative tracking, so
do NOT copy that number without the typeface); two-tone headlines with the last
phrase in the accent; **straight-slide** CTA sweep; word-by-word statement reveals
via `WordReveal`; the `.sf-spectrum` hero wash.

Daylight's own hero logo "draw" is a Rive `.riv` scrubbed by a GSAP timeline
(their stack is Next.js + GSAP + Lenis + Rive, NOT Framer); MAZJ reproduces the
effect with stroked-SVG `stroke-dashoffset`, no Rive runtime.

✅ **RESOLVED 2026-07-26: the "straight-slide" rule is OUR deliberate divergence,
not a description of Daylight.** Daylight ships TWO sweeps. Its **default** boxed
CTA is ROTATED: `translateY(200%) rotate(15deg) scale(1.8)` →
`translateY(0) rotate(8deg)`, 1000ms `cubic-bezier(.16,1.08,.38,.98)`, dropping to
100ms on exit. That is 11 instances across `/` and `/brand`, declared three
independent ways. Its **full-width** CTA is the lone exception, and `/brand`
captions that one "straight vertical slide" in words. MAZJ is straight everywhere
at 120ms, on purpose: crisper, and it doesn't throw a rotating rectangle behind
Arabic. Keep it straight; the rule stands, the rationale was just wrong.

🔴 **The grep trap that made this look unverifiable, and it will bite again:**
Daylight is Tailwind v4, which emits the STANDALONE `rotate:` / `scale:`
properties, not a `transform` shorthand. So `grep "transform: rotate("` over
their compiled CSS returns only the spinner keyframe and appears to prove nothing
on the site rotates. Grep `rotate:` and `scale:` as well, and read the MARKUP, not
just the stylesheet. Full evidence lives in `DESIGN.md`.

🔴 **Daylight is Tailwind v4, this repo is Tailwind 3, and `backdrop-blur-sm`
means different things in each** (v4 = 8px, v3 = 4px). Copying Daylight's class
verbatim silently halves the blur, hence the explicit `backdrop-blur-[8px]`.
Check this on any other class ported straight from their markup.

🔴 **User-approved exception: the hero `.qualify-pill` is NO LONGER Daylight's
glass**, it is rebuilt on Apple's Liquid Glass. Daylight has **no** liquid glass:
verified zero `feDisplacementMap` / `feTurbulence` / `backdrop-filter:url()` /
inset shadows across all 102k chars of their CSS. Theirs is just
`blur(6px) saturate(110%)` + 5% white fill + a 1px `rgba(255,255,255,.22)` rim
(PURE WHITE, not beige; beige only on `:focus-within`) + 12px radius, inner button
8px. Those exact values were shipped here and measured, and they failed: a
blur-led material *borrows* its look from the backdrop, and ours is dark flat
video (luma ~22 / structure std ~3, versus their 49 / 28), so it read as an
outlined box, with rim luma spread 2.7% across top/bottom/left. Apple's model
*generates* its optics (specular gradient rim, bezel, refraction insets) and so
survives a dead backdrop: spread 2.7% → ~56%. Per Apple's HIG the material tracks
its backdrop ("appears darker when there is a dark background beneath it"), so the
tint stays near-black: **lightening the fill to force visibility is a documented
anti-pattern** and reads as milky plastic. Don't "restore" Daylight's numbers; see
the full comment on `.qualify-pill` in `globals.css`.

## Motion

**`ScrollFX.tsx`** (client) registers GSAP ScrollTrigger and drives pinned, clip
and scale reveals via `data-fx` / `data-pin-*` attributes on section elements.
`data-fx="clip"` is wired on `/about`'s chapter media and ends at `round 16px`,
**not** Daylight's `round 2px`: theirs grows full-bleed to the viewport edge where
a radius would be wrong, ours is always an inset 16px frame.

🔴 **ScrollFX arms ONCE per hard load.** Its `useEffect(..., [])` sits in the
persistent `[locale]` layout, so a client-side `<Link>` navigation never re-scans
for `data-fx` elements and `ctx.revert()` never runs for the route you left (the
same layout persistence that forced `ScrollReset` to exist). Two consequences: a
`data-fx` you add to a sub-page only fires on a HARD load of that route, and
soft-navigating TO the landing drops its signature motion entirely (the
USP/WhyMazj pins and the hero clip and chip intros are never created). Only the
GSAP layer is lost; `Reveal`'s CSS base still fires. **Hard-reload before judging
any motion work.**

🔴 **GSAP, ScrollTrigger and Lenis are DYNAMICALLY imported, inside the effects
of `ScrollFX` and `motion/SmoothScroll`.** Both are mounted in the locale layout,
so a static import (and the module-scope `gsap.registerPlugin` that used to sit
in `SmoothScroll`) put ~141 KB of animation runtime into the initial JavaScript
of all 26 routes — including `/faq`, `/privacy` and `/terms`, which declare no
scrubbed motion, and including the reduced-motion path, which returns before
touching any of it. ⚠️ `SmoothScroll` keeps `import type Lenis` and it must stay
a TYPE-only import: a value import of the same name puts the library straight
back in the initial bundle while every type still checks out. Both effects guard
the async gap with a `cancelled` flag, so a Strict-Mode double-invoke cannot tear
down before the setup it is undoing.

🔴 **`Reveal` and `WordReveal` take an `immediate` prop, and it is what keeps the
openers paintable.** Both rest at `opacity: 0` and are restored only by the
`.is-visible` class their IntersectionObserver adds — which cannot run until
React has hydrated. That made every sub-page h1 and intro paragraph unpaintable
until ~250 KB of JavaScript had landed, on content that is on screen from the
first frame. Lighthouse measured **1291ms of element render delay** on `/en/faq`,
whose LCP was 8.2s despite the page carrying no photography at all.

`immediate` swaps the observer for a pure CSS animation
(`.reveal--immediate` / `.word-reveal--immediate` in `globals.css`), so the
opener paints from the stylesheet with no JS involved. It is applied at
`PageIntro`'s four opener call sites and nowhere else.

⚠️ **Do not use it below the fold**: it fires on page load, so the block would
finish animating long before anyone scrolls to it and arrive static. And note the
delay travels as `--rv-delay` in immediate mode rather than `transition-delay`,
because an animation ignores the latter.

**`Reveal.tsx`** (client) is the base IntersectionObserver reveal.

🔴 **It is NOT no-JS-safe.** `.reveal`, `.reveal-list > *` and
`.word-reveal .wr-word` all rest at `opacity:0`, restored only by the JS-added
`.is-visible`, and there is no `<noscript>` or `@media (scripting: none)`
anywhere, so every revealed block renders BLANK with JS off (the same failure mode
as the 404). Keep these hook attributes intact when editing sections.

🔴 **`Reveal` caps its IO threshold by element height**
(`min(amount, innerHeight*0.5/offsetHeight)`): an element taller than the viewport
can never reach a fixed intersection ratio (max = viewportH/elementH), so the 0.2
default permanently hid the 29-row 2023 events archive at phone heights (3.3k px
tall, max ratio 0.16, rendered as blank scroll in BOTH locales). **Keep the cap
when touching Reveal**; a "raise `amount` for drama" edit reintroduces the bug on
every tall list.

**`.reveal-list` / `.reveal-card` only work ON a `Reveal`, and they fail in
OPPOSITE ways.** `.reveal-list` sets its CHILDREN to `opacity: 0` and restores
them under `.is-visible`, which only `Reveal` adds, so on a plain element the
content is permanently invisible. `.reveal-card` is the opposite: its selector is
`.reveal.reveal-card` and it sets transform only (a card's `opacity:0` comes from
`.reveal` itself), so on a plain element it matches nothing, silently does
NOTHING, and you get a static card with no error. `Reveal` forwards arbitrary
props, so `data-fx` / `data-parallax` can sit on it (it silently dropped them
until that was fixed).

**`WordReveal.tsx`** (client) is a word-by-word reveal used for the big display
headings (Steps, StepInto, the WhyMazj statements, Network). Those call sites pass
`as="h2"` so Arabic headings stay real heading tags (see the clipping rule); its
own default is `as="div"`.

🔴 **`ScrollReset.tsx`** (client, mounted in the layout beside `SmoothScroll`)
resets scroll to top on forward navigation: Lenis owns window scroll and keeps the
PREVIOUS route's scroll as its target, so Next's scroll-to-top gets reverted and a
footer link left you parked at the bottom. It resets Lenis
(`scrollTo(0,{immediate,force})`) or native scroll under reduced motion, and
DELIBERATELY skips back/forward (popstate restores position), `#hash` targets, and
language switch (next-intl `usePathname` is locale-stripped). **Don't remove it.**

🔴 **A "retry" must change something the effect DEPENDS on.** The booking flow's
availability retry called `setLoaded(null)` and never refetched: the effect is
keyed on price/space/flow and a retry changes none of them, so no request was
issued, and clearing the state also unmounted the error box and left a permanent
"checking what is free" line. Use a `retryNonce` in the dep array. **Test the
DEPENDENCY LIST, not a render:** a render test with a mocked fetch passes against
the broken version, because the defect is that the effect never re-runs.

## A11y and responsive primitives

Added in the 2026-07 audit pass. **Reuse these, don't recreate them.**

`useMediaQuery.ts` exports `useIsDesktop()` and `usePrefersReducedMotion()`
(SSR-safe via `useSyncExternalStore`; false on the server and first client
render).

🔴 **`MotionToggle.tsx` is DEAD CODE**, like `Proof.tsx`. The WCAG 2.2.2 pause
control was **unmounted at the owner's request** (see the comment at `Footer.tsx`),
a known and ACCEPTED 2.2.2 gap, so it renders on **no** route. **Do NOT re-add it
from an audit.** If it ever returns it belongs in the footer's bottom chrome row
in normal flow, never as a `fixed` floating chip (that one occluded the ZATCA
line). The machinery still works if remounted (the `Motion` namespace is live in
both message files): it pauses every `<video>` and stamps
`html[data-motion="paused"]`, which `globals.css` turns into
`animation-play-state:paused`. Since nothing stamps that attribute today, the
whole `globals.css` pause block is unreachable.

🔴 **Two rules follow from that.** `<video autoplay>` IGNORES CSS
`prefers-reduced-motion`, so a gate has to be JS (`usePrefersReducedMotion()`),
never the `@media` block, and a Playwright `reducedMotion: 'reduce'` context will
NOT freeze an ungated one.

⚠️ **That gate now EXISTS for five of the six ambient loops, since 2026-07-31.
This paragraph used to say nothing gated any of them; that is no longer true, and
the distinction matters because the exceptions are not arbitrary.**

| Loop | Gated under reduced motion? |
|---|---|
| Hero background (`mazj-hero.mp4`) | ✅ `AmbientVideo` |
| Hero clip window (`hero.mp4`) | ✅ explicit `!reduceMotion` in `Hero.tsx` |
| WhyMazj x3, footer dune, FoundingBand | ✅ `AmbientVideo` |
| Nav CTA (`mazj-button.mp4`) | ❌ **still plays** |

The hero's two loops are gated **together on purpose**: freezing the background
while the square window kept moving read as a broken page rather than a calmer
one. Never split that pair.

The nav CTA is the one deliberate holdout. It is 40 KB, it is the header button's
*fill* rather than a background, and this file records that the always-on loop IS
the effect (ported 1:1 from Daylight, which has no hover state). Gating it is a
brand decision, not a technical one, so it was left for the owner. **It means the
site is NOT fully reduced-motion-safe: say "five of six", never "all".**

And `hidden lg:block` still **DOWNLOADS** its media on mobile:
conditionally render desktop-only media with `useIsDesktop()` to actually stop the
fetch (656 KB of hero media was hitting phones).

**Rect-only tap-target audits false-positive across this repo.** Interactive
controls carry `before:` pseudo hit-pads (footer links a 44px band, header
wordmark 44x44, LocaleSwitcher `inset-x-[-4px]`, LocationHours WhatsApp,
SpaceOffers detail links), so `getBoundingClientRect()` reports 18-24px on targets
whose real hit area is 44px. A 2026-07 audit flagged ~10 of these as too small;
all but two were already padded. Measure with `elementFromPoint` or the computed
`::before` box, never the anchor rect alone.

**Image alt convention: describe the PHOTOGRAPH via `photoAlt` i18n keys, never
`t("title")` or the h1** (the same-phrase-announced-twice bug shipped twice). When
one page shows the same photo twice (PageIntro hero + SpaceDetail), only the lower
instance carries the alt; the hero keeps `alt=""`.

## Media

### 🔴 Every photo goes through `next/image`, and `sizes` is the load-bearing prop

Added 2026-07-31. There were **zero** `next/image` call sites and 23 raw `<img>`
tags, so every phone downloaded the desktop JPEG at desktop dimensions. Measured
on the landing page at a 390px viewport: **566 KB of pure oversizing**, on top of
the format penalty (`usp-control.jpg` is a 1066x1333 file painted into a 403x503
box). `next.config.mjs` now negotiates AVIF then WebP and carries a 390 entry in
`deviceSizes`, because without it the smallest candidate is 640 and every phone
over-fetches by ~2.7x in area.

⚠️ **A wrong `sizes` is SILENTLY expensive, never broken.** It is what picks the
srcset candidate, so a value that overstates the box makes every phone fetch a
desktop-width file and look perfectly correct doing it. Pass the real rendered
width per breakpoint at every call site; `MediaFrame`'s default
(`(min-width: 1024px) 640px, 100vw`) is the common media column, not a universal
truth.

- **`fill` everywhere**, because each call site draws into an aspect-ratio box it
  does not know the pixel dimensions of. `fill` needs a positioned ancestor;
  every one of these boxes was already `relative`.
- **`priority` only where the image is in the OPENING viewport** —
  `PageIntro`'s hero photo (the LCP element on all eight photo routes) and the
  nav wordmark. As a raw `<img loading="eager">` the opener still went out at
  **Low** fetch priority, queued behind every below-fold photo; `priority` is
  what emits the preload that gets it DISCOVERED early.
  - 🔴 **`priority` does NOT imply `fetchPriority`, and this line said it did
    until 2026-08-02.** They are independent props in Next 16: `priority` sets
    `meta.preload`, while the attribute is built from
    `imgAttributes.fetchPriority`, so an undefined value emits nothing. Measured
    across the 26 rendered production pages: **370 `<img>`, 48 image preloads,
    and ZERO carrying `fetchpriority`**, including the LCP element on 20 of 26
    routes. `PageIntro` and `AmbientVideo` now pass **both**. Verify by grepping
    the rendered HTML for the lowercased attribute (`fetchpriority="high"`),
    never by reading the JSX, since the prop name and the attribute differ.
- **`location-map.png` is `unoptimized` on purpose.** It is a hand-tuned PNG-8 at
  256 colours (41 KB, effectively lossless against the styled map's 464 distinct
  colours). A lossy AVIF re-encode bands the flat cream fields and rings the
  street labels, which is the exact artifact PNG-8 was chosen to avoid.
- **SVGs stay raw `<img>`.** Routing one through the optimizer needs
  `dangerouslyAllowSVG`, and a 1.3 KB vector cannot be made smaller as AVIF. They
  carry explicit `width`/`height` instead, so the row reserves its box.
- Event posters come from Supabase Storage, so `next.config.mjs` derives a
  `remotePatterns` entry from `NEXT_PUBLIC_SUPABASE_URL` rather than hardcoding
  the ref (the project already moved region once, which changed it).

🔴 **Verifying a `sizes` value: `naturalWidth` LIES. Read the `w=` parameter.**
It can report a stale decode that does not match `currentSrc`, so a correct
srcset pick looks like a 2x under-fetch. Measured 2026-07-31: `naturalWidth` 390
while `currentSrc` was `w=828`, on a 390px box at DPR 2 (828 is the right pick).
That reading nearly shipped as "49 images render soft on retina". The
authoritative check is
`new URLSearchParams(img.currentSrc.split('?')[1]).get('w')` against
`cssWidth × devicePixelRatio`; confirm by fetching the chosen URL and reading the
delivered file's real dimensions.

🔴 **AN INSET `box-shadow` ON A MEDIA BOX RENDERS NOTHING, AND HERE IS THE
NUMBER.** `MediaFrame`'s docblock asserts it; measured 2026-08-02 with an isolated
probe (same markup twice, one box carrying the 1px ink-at-10% ring on itself and
one on an `after:` pseudo-element, opaque image inside `overflow:clip`):
first-pixel-vs-second ratios of **1.000** and **0.898**. Inset shadows paint above
the background but below content, so an absolutely-positioned `<Image fill>`
covers the ring completely.

`HostEvent`, `SpaceDetail` and `FoundingBand` each carried that dead ring PLUS the
banned drop shadow until 2026-08-02. All three now use the `after:` idiom and
measure 0.900 against `MediaFrame` controls at 0.900 / 0.905 / 0.914, so **every
media box on the marketing site now draws its hairline the same way.**

### 🔴 `AmbientVideo` — `preload="none"` DOES NOT SURVIVE `autoPlay`

Six background loops each carried `preload="none"` and a comment claiming that
kept them off the critical path. It does not: a muted autoplaying video is a
video the page has asked to start, so the browser fetches it regardless. Measured
on one cold mobile load of `/en`: `mazj-hero.mp4` transferred **3.0 MB**,
`why-onehouse` 437 KB, `footer-dune` 323 KB, `step-into` 199 KB, `why-mazj`
182 KB — every one requested inside the first 80ms, all competing with the fonts
the headline was waiting on.

`components/motion/AmbientVideo.tsx` is now the single container. It withholds
the `src` until three gates open, and paints an optimized `next/image` poster
underneath in the meantime:

1. **In view**, via IntersectionObserver with a 300px margin.
2. **`desktopOnly`**, used only for the hero background. `hidden lg:block` is a
   paint concern, not a fetch concern — the same trap `useMediaQuery.ts` already
   documents. A phone drew 4.7 MB of 720p behind a scrim, a wash and the
   headline. It now gets `hero-bg.jpg`, which IS that video's frame 0, so the
   still and the first frame are the same picture.
3. **Motion not reduced.** ⚠️ This is a deliberate, reversible behaviour change:
   `<video autoplay>` ignores the CSS `prefers-reduced-motion` block, and with
   `MotionToggle` unmounted nothing gated these loops at all. This file already
   said the fix "has to be JS … never the `@media` block". It does **not**
   reinstate the removed toggle and is invisible to anyone who has not opted in.

🔴 **`ScrollFX` reads `[data-ambient]` BEFORE `video`, and that order is
load-bearing.** The `pin-scale` effect grabbed the `<video>` directly; that
element no longer exists at mount, so the lookup would return `null` and the
scale would silently never run. The wrapper is always in the DOM and holds both
layers, so scaling it is also the better effect — the still scales too, instead
of snapping when the clip arrives.

**Re-encoding:** only `mazj-hero.mp4` was worth it (60fps → 30fps, 4734 KB →
3220 KB at SSIM 0.9888, frame 0 preserved so the poster stays valid). `hero.mp4`
and `step-card.mp4` are also 60fps but already efficiently encoded — a CRF 30
pass made both **larger**. Measure before replacing.

**`MediaFrame.tsx` is the ONE media container:** a hairline `after:` ring directly
on the surface, no white card, no drop shadow (the landing's USP idiom). Sub-pages
each used to ship `bg-white rounded-[16px] shadow-[0_10px_32px_rgba(0,0,0,0.08)]`,
a string that appears **nowhere** on the landing page and is what made them read
as a generic card grid. **Don't reintroduce it.** The shared sub-page vocabulary is
`MediaFrame`, `WordReveal`, `.grid-overlay`, `.reveal-card`, `.reveal-list`. Note
that an inset `box-shadow` paints UNDER an opaque `<img>` in an `overflow-clip`
box (invisible), hence the `after:` pseudo-element.

**The visible "brand orange" is mostly video, not CSS** (`footer-dune.mp4`,
`step-card.mp4`, the hero clip-window's `hero.mp4`, and the header CTA's
`mazj-button.mp4`). Changing the `orange` token or the CSS won't recolor those:
the videos must be hue-shifted or replaced.

**The header CTA's fill is ambient, not a hover reveal** (`Navigation.tsx`).
Ported 1:1 from godaylight.com's header button, which has **no hover state at
all**: the effect is `mazj-button.mp4` looping always-on behind a permanent
`backdrop-blur(8px)`, which collapses the dune ripples into a near-solid coral
that subtly breathes and keeps the white label legible. **Don't "fix" the missing
`group-hover:`: the always-on loop *is* the effect.** `mazj-button.mp4` is
Daylight's own button crop (byte-identical, 124×70, framed for a ~127×45 box), so
don't swap it back to the hero-sized `hero.mp4`. MAZJ keeps
`active:scale-[0.96]` here on purpose (Daylight has no press feedback); that is
the one deliberate divergence.

**Video `poster`s must be the video's own first frame.** The hero bg
(`mazj-hero.mp4` → `hero-bg.jpg`) and the desktop clip-window (`hero.mp4` →
`hero-video.jpg`) each poster a still shown until the heavy video decodes (the bg
is ~4.8 MB, re-encoded down from ~12.8 MB), so a mismatched poster (several were
stale solar-template leftovers) flashes a wrong image on hard refresh. When
swapping any section video, regenerate its poster from frame 0 at the video's
native res (1280×720, not higher, or the sharper poster pops when the video takes
over): `ffmpeg -y -i public/videos/X.mp4 -frames:v 1 -q:v 2 public/images/X.jpg`.
`ffmpeg` and `ffprobe` are installed.

**`public/images/` top-level `.jpg`s are mostly VIDEO POSTERS** (frame-0 of the
loop videos: `hero-bg`, `hero-video`, `footer-dune`, `why-{mazj,risks,onehouse}`,
`step-into-video`, that last one postering `step-into.mp4` in `FoundingBand.tsx`,
NOT `StepInto.tsx`). Don't swap them for a non-frame-0 image (it flashes on load).
`process-bg.jpg` is NOT one of them: there is no `process-bg.mp4`, it is a
2000x1120 static background `<img>` in `Steps.tsx` (a section currently commented
out of the landing), so treat it as a swappable content photo.

The editable **CONTENT** photos are `spaces/*`, `usp-{save,protect,control}`,
`network-bg`, `step-into`, `contact-welcome`, `about-{blend,address,community}`,
`events/*`, `startups`
(`location-map` is a **custom-styled map still**, not a photo: see the recipe
below). 🔴 `spaces/office-day` and
`office-month` are LEGACY names from when daily and monthly were separate
products: they now hold the pod interior and the row of glass rooms respectively,
so don't read the filenames as descriptions or "correct" the mapping. Crop a
content photo to its slot's exact dims with
`ffmpeg -i SRC -vf "scale=W:H:force_original_aspect_ratio=increase,crop=W:H" -q:v 3 DEST`
(spaces 1200×800, usp-* 1066×1333, network-bg 1013×1333, step-into 1000×1333,
events 900×844, about-blend 1600×1066, about-address/about-community 1200×800,
startups 1600×1066).

🔴 **`/about` is the route most exposed to photo reuse, because every visitor who
reaches it has already scrolled the landing page.** All three of its chapters
originally ran on frames that ship elsewhere, and all three were replaced for
that reason (the hero on 2026-07-28, the two chapters the same day). Before
putting ANY frame on `/about`, grep the repo for the filename first: `day-desk`
and `spaces/event` are the two most-reused images on the site (5 and 7 live call
sites), so they are the two most likely to be picked and the two worst to pick.

🔴 **`~/Downloads/Photos from Mazj` is the whole shoot: 28 frames, and 19 are
already spent.** Before adopting a "new" photo, check this table rather than
trusting a filename or your eye: several frames are near-duplicates of each other
(8118/8119, 8208/8212) and several rooms were shot repeatedly from different
angles, so a fresh-looking frame can be a crop of one already on screen.

| Source | Where it already ships |
|---|---|
| `DSC_7830` | `spaces/meeting.jpg` |
| `DSC_7938` / `DSC_7947` | `spaces/office-day.jpg` / `office-month.jpg` (🔴 private office ONLY, see below) |
| `DSC_7854` | `about-address.jpg` (the `/about` "One address" chapter) |
| `DSC_8011` | `events/women-design.jpg` **and** `about-community.jpg` (re-cut from the ORIGINAL, not from the 900×844 crop) |
| `dsc_8062` | `network-bg.jpg` |
| `dsc_8077` | `events/loqma-fayda.jpg` |
| `DSC_8088` | `events/brand-factory.jpg` |
| `dsc_8103` | `events/coffee-sketch.jpg` |
| `dsc_8119` | `usp-save.jpg` (and `DSC_8118` is the same setup one frame apart) |
| `DSC_8125` | `usp-protect.jpg` |
| `DSC_8134` | `spaces/event.jpg` **and** `process-bg.jpg` |
| `DSC_8139` | `step-reserve.jpg` **and** `usp-control.jpg` |
| `DSC_8182` | `about-blend.jpg` (the `/about` hero) |
| `dsc_8212` | `step-into.jpg` (and `DSC_8208` is the same stair moment) |
| `DSC_8218` | `spaces/day-desk.jpg` |
| `DSC_8224` | `spaces/membership.jpg` |
| `DSC_8272` | `contact-welcome.jpg` |
| `DSC_8020` | `startups.jpg` (the `/startups` hero, taken 2026-07-28) |

**Still unused and safe to take:** `DSC_7871, 8058, 8157, 8162, 8236,
8242`. ⚠️ `DSC_8320` (the مزج sign) is unused but **unusable**: it was shot from
behind the glass, so the wordmark reads mirrored. `DSC_8162` is the red-cap focus
booth, free for general use but 🔴 **never** as a private office (owner ruling,
see the `office-day`/`office-month` note above).

**How that table was derived, and how to redo it after the next shoot:** OpenCV
`matchTemplate` / `TM_CCOEFF_NORMED` on greyscale, sliding each site image over
each source at scales 1.0 down to 0.17, taking the best score per pair. Anything
at or above ~0.80 is the same photograph; below ~0.65 is noise. Two traps: the
frame-0 VIDEO POSTERS (`hero-*`, `footer-dune`, `why-*`, `step-into-video`) are
not from this folder at all and will still return 0.5-0.7 false hits, so exclude
them first; and a tight crop of an 8000px original legitimately matches at a
scale as small as 0.33, so a low `frac` alone does not mean a false positive.

**Changing a video's speed: set `defaultPlaybackRate` too, not just
`playbackRate`.** The media load algorithm resets the live rate to the default on
load completion, so a `playbackRate`-only ref works in dev (file already cached)
then silently snaps back to 1× on a cold production load. The header CTA runs at
`CTA_VIDEO_SPEED = 2` in `Navigation.tsx`.

**Black bars in a card are probably baked into the asset, not an `object-fit`
bug.** `step-reserve.jpg` shipped 133px of pure black top and bottom *inside the
JPEG* (a squarish photo padded onto a 3:4 canvas), so `object-cover` was correct
all along and the CSS was innocent. Check the file's edge rows before touching
CSS. When trimming such bars, the codec smears the hard black→photo edge, so the
first surviving row is half-black and renders as a dark hairline: trim **+1px**
past the detection threshold, and re-cut from the **original** file rather than
one you already re-saved (double JPEG compression).

**`mazj-hero.mp4` is trimmed at 55.85s** (66.42s → 55.87s) to cut the promo's
branded outro: a red MAZJ wordmark + `مساحة عمل مشتركة` overlay hard-cuts in at
**55.86s**, followed by contact details (`احجز الآن` / `www.mazj.org` /
`013 3300 337`) and trailing black. It loops as the hero bg, so the outro was
surfacing on every cycle. If you ever re-pull the YouTube promo, re-trim it:
`ffmpeg -i src.mp4 -t 55.85 -c copy mazj-hero.mp4` (stream copy = lossless, and
frame 0 is preserved so `hero-bg.jpg` stays a valid poster). Keep the MAZJ logo at
~52s: that's real signage on the glass, not the outro.

**Real MAZJ media sources** (for replacing leftover or template imagery):

- *Photos* come from mazj.sa's rekaz store: fetch its space pages
  (`/reservation/*`, `/subscription/*`, sandbox OFF), grep
  `cdn.rekaz.io/tenants/3a14a1b1-1f18-24e9-bfb1-a77ce84ff72a/<id>`, then get a
  real JPEG at any size via
  `img.rekaz.io/cdn-cgi/image/quality=90,width=N,f=jpeg/<raw-cdn-url>` (raw CDN
  URLs are extensionless and not always JPEG).
- *Video B-roll:* the official YouTube promo `wAAxwPWoRtI` ("Mazj Space - Al
  Khobar", clean, no captions or talking heads).
- *Instagram @mazjorg:* yt-dlp's extractor is **broken**, and the grid is
  **virtualized** (scrolling replaces rows, so hand-scraping silently
  under-reports: it found 6 of 42 events). Use claude-in-chrome plus the feed API
  from page context:
  `fetch('/api/v1/feed/user/mazjorg/username/?count=33',{headers:{'x-ig-app-id':'936619743392459'}})`,
  paginating on `next_max_id`. Captions live on `/mazjorg/p/<code>/`, not the
  profile. Post date ≠ event date (parse the caption's 🗓 line).

**Seamless background-video loops:** cut ONE clean B-roll shot (no mid-cut, no
burned-in captions), then boomerang it
(`[0]split[a][b];[b]reverse[r];[a][r]concat`) so the loop never jumps; `setpts=N*PTS`
to slow it. Ken Burns (zoompan + boomerang) off a still is the fallback when
there's no clean footage.

## The location map still (`public/images/location-map.png`)

Restyled 2026-07-30 (owner request). It is a **custom-styled Google map**, not a
screenshot of Google's default styling, and the style lives in
`scripts/mazj-map-style.json` in Snazzy Maps / Google `featureType` format.

🔴 **The reason it was restyled is worth keeping: the old still named FIVE other
businesses on MAZJ's own visit-us card**, one of them a hotel (Aloft by Marriott,
LEGO Store, JOE & THE JUICE, Hazel Coffee, Regal Burger). `poi` visibility off is
therefore load-bearing, not decoration. `poi.park` geometry is turned back ON
after it, which is the one ordering dependency in the file.

**Regenerating it** (pin moved, or the palette changed). There is **no Google
Maps API key in this project**, and Static Maps 403s without one, so the route is
Snazzy Maps' own editor, which loads the Maps JS API under *their* key:

1. Resolve the pin. `MAPS_URL` in `lib/contact.ts` is a shortlink; `curl -sL` it
   and read `!3d<lat>!4d<lng>`. Currently **26.302126, 50.176999**.
2. Size the browser to the CSS size the card renders at, NOT an arbitrary one.
   Measured at a 1440 viewport the card is **745×559**, so 760×570 is captured
   and the DPR-2 screenshot lands at 1520×1140, i.e. exactly 2×. Capturing wider
   bakes labels that are then downscaled to unreadable.
3. Open `snazzymaps.com/editor`, then in the console build your own map on their
   page: wipe `document.body`, append a div with **explicit px width/height**
   (`inset:0` silently gives it height 0 on that page), and
   `new google.maps.Map(div, {styles, disableDefaultUI:true, …})`. Await the
   `idle` event plus ~2s. The coral pin is a `google.maps.Marker` with an SVG
   path symbol in `#FF5A48`, anchored at the path's tip.
4. Zoom **18** gives ~407m across at 760px, which is the agreed "destination not
   region" frame. `road.local` labels are OFF: Google repeats a long street's
   name once per screen-length, so at this frame it printed "21 St" four times.
5. Save as **PNG-8, 256 colours**. Measured: the styled map holds 464 distinct
   colours, so 256 is effectively lossless (max channel error 4) at **41KB**,
   against 203KB for the JPEG it replaced at a LOWER resolution. JPEG also rings
   around the street labels.

**The scrim colour and the scrim POSITION are two different decisions, and only
one of them is yours to change.**

🔴 **The colour is measured and must not be reverted.** It was
`from-black/70 via-black/20`, which was right while the map was mid-toned Google
styling (a dark fade reads as a shadow, and Google's attribution renders white on
dark so it stayed legible). Against the cream styled map the same fade read as
DIRT and turned the bottom half of the card muddy grey, measured in situ at 1440.
It is now a cream fade with ink text: 17.4:1 for the label, 7.77:1 for the arrow.

⚠️ **The position is an owner instruction, taken with its cost stated.** The fade
sits across the BOTTOM and therefore hides the "Google" wordmark and the
"Map data ©…" line baked into the still. I moved it to the top for exactly that
reason and the owner asked for it back at the bottom, over the logo, on
2026-07-30. Recorded, not re-litigated. It pushes the asset further into the grey
area it already occupied (a self-hosted capture rather than a Static Maps API
call, because this project holds no Maps key).

🔴 **A MAPS API KEY WAS OFFERED TWICE AND DECLINED, 2026-07-30. Do not propose it
again.** The owner's reasoning: anyone who wants the real map taps the card and
lands in Google Maps, so this is a picture of where MAZJ is rather than a map
product. That also settles the older note in
[[mazj-location-map-still]] that called the Static Maps API "offered for launch,
not yet wired": it is now declined, not pending. The only remaining lever is
easing the gradient so the last ~24px stay clear. **Do not change it silently in
either direction.**

For reference, with the fade at the top the baked attribution measured **10.47:1**
(wordmark) and **21:1** (map data), so legibility was never the blocker, only
placement. ⚠️ Separately, the card's `rounded-[16px]` clips a few pixels of
"Terms" at 390px; that predates all of this.

## Recoloring baked-orange video to an exact hex

Overlay a solid `bg-[#hex]` div with `mix-blend-mode:color` over the `<video>`,
wrapped in `isolate` (which scopes the blend to the video). **Not
`filter:hue-rotate()`**: browsers under-rotate saturated orange, so it misses the
exact hue. blend:color keeps the source's luminosity, so dim brighter videos first
with `[filter:brightness(0.x)]`. Live in `Hero.tsx`, `Footer.tsx`, `Steps.tsx`
(SubscribeCard) and `Navigation.tsx` (CTA fill, always-on). `orange` token =
`#FF5A48`.

- **Derive the dim, never guess it.** blend:color takes lightness from the video,
  so the dim *is* the final lightness. Measure mean luma:
  `ffmpeg -v error -i v.mp4 -vf "fps=1,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null -`.
  `hero` and `step-card` are the same dune re-cropped (Y≈138) and take
  `brightness(0.78)`. Matching luma is what makes two elements read as the same
  coral.
  - 🔴 **`footer-dune` is Y≈78, and it is the case that proves a dim is NOT always
    the right tool.** Because blend:color takes luminosity from the VIDEO, a clip
    darker than the coral's own 137.5 drags the result down: the footer rendered
    `rgb(186, 34, 17)` at lightness **39.8%** against the brand's 64.1%, hue
    perfect. A **de-facto darkened coral**, the exact thing the coral rule below
    forbids, reached through the luma channel instead of through a hex. The owner
    read it as "red-ish" on 2026-07-30 and asked for the brand orange.
  - ✗ **`brightness(1.77)` was the obvious fix, it is WRONG, and it was built and
    rejected on sight.** The factor is correct arithmetic (137.52 ÷ measured mean
    luma) and it does land the colour: 62.4% lightness, 0.0° hue error, nothing
    clipping. But `footer-dune.mp4` is **1280x720 at 0.52 Mbps**, a very low
    bitrate for 720p, so multiplying a dark heavily-compressed source magnifies
    its blocking and banding. Measured high-frequency artifact energy went
    5.2 → **9.2**, nearly double what shipped before, and a pale band blew across
    the end-side column where both locales put the 50px `h2`, dropping that
    heading to **1.9:1**. 🔴 **You cannot brighten your way out of a dark
    low-bitrate source.** Check `bit_rate` with `ffprobe` before reaching for a
    lift.
  - ✓ **The fix is to stop asking the video for the colour at all.** Paint the
    coral FLAT on the isolating wrapper and ride the clip on top at **15%
    opacity**. Measured: lightness **60.6%** against the 64.1% target, hue error
    0.0°, and artifacts drop to **0.8**, roughly 6x cleaner than the site shipped
    before rather than worse. Nothing is brightened so nothing is over-exposed.
    ⚠️ The `bg-orange` on that wrapper is load-bearing: `isolate` scopes the blend
    to the group, so without a coral base inside it the 15% video composites
    against transparency and the blend has no luminosity to take.
  - **The general rule: a low-opacity clip over a FLAT token beats any filter when
    the source is dark or noisy.** A brightness factor is only appropriate for a
    clip that is too BRIGHT (`hero`/`step-card` at Y≈138, dimmed 0.78). For a dark
    one, dilute rather than amplify.
  - ⚠️ Any brand-correct footer costs contrast, because cream on flat `#FF5A48` is
    **2.72:1** and that is the ceiling. Cream sits at ~2.79:1 here. Below AA, and
    the same brand-over-metric call already accepted elsewhere (see the coral rule
    below). The old 5.57:1 existed only because the colour was wrong. Do not "fix"
    it by re-darkening the video, which is how this got here.
- 🔴 **Exception: the header CTA (`mazj-button.mp4`) takes NO dim** (2026-07-23).
  The owner flagged the 0.78-dimmed coral as "darker than ours", and since the
  clip's own luma (~136) already equals `#FF5A48`'s blend-Lum (137.5), undimming
  lands the button on true brand (measured hue 6.0°, Lum ~140 both locales). It
  deliberately no longer luma-matches hero/step-card: the header button reads
  brighter, on purpose. There is also NO black scrim on it anymore.
- **Stack the overlay BELOW white content in DOM order.** blend:color repaints
  everything beneath it: the subscribe card's white wordmark and the CTA's white
  label stay white only because they paint *after* the overlay. Put it above them
  and they turn coral.
- **Verify by HUE, not RGB.** Recolored reads ≈6°, raw baked orange ≈25-30°. RGB
  means legitimately drift ~15/255 between elements (different `object-cover` crops
  of the same gradient), so a channel delta proves nothing; hue is the
  discriminator.

## The hero

**Space-finder (`Hero.tsx`, client):** a square media window plus a facility
dropdown. `FACILITIES[]` (config, not copy) is **4 entries on 4 `BOOKING` URLs**,
ids matching `SpacesGrid`'s (`openDesk`, `privateOffice`, `meetingRoom`,
`eventHall`), each with its own photo (`public/images/spaces/*.jpg`, pulled from
mazj.sa's rekaz.io CDN, optimized with `sips`). Picking one crossfades its photo
into the window and aims the CTA at that page. Copy = `SpaceFinder` namespace.

⚠️ **It was SIX entries fanned onto those same four URLs until 2026-07-29, and
this file used to say "don't dedupe it". That instruction is RETIRED, by owner
ruling, and here is why so nobody restores it from a diff.** The duplication was
a leftover of mazj.sa's own 6→4 restructure and was defensible only while the
hero linked OUT to the storefront. Booking moved on-site on 2026-07-27, and the
booking page takes no duration: no route under `app/[locale]/spaces/*/book/`
reads `searchParams`, and `BookingFlow` always opens on `prices[0]`, which is
**"One day"** for both coworking and the private office (verified against the
live catalog). So `membership` and `officeMonth` opened a page pre-set to a
single day, i.e. the next screen **contradicted** the label rather than merely
ignoring it. Duration on the booking page is a price; in the hero it was a
promise. `membership.jpg` and `office-month.jpg` left the picker but are live in
`SpaceOffers` and on the private-office page: **do not delete them.**

🔴 **The ORDER is load-bearing and is not alphabetical, by price, or by
frequency.** The labels are the visitor's own thought, and the grammar sorts
them: rows 1-2 open `أريد` / "I want" (where I work, for myself), rows 3-4 open
`لديّ` / "I have" (an occasion I am hosting). Interleave them and the split
renders as want/have/have/want and the idea disappears. It is also SpacesGrid's
order, which is the second reason to keep it.

**Each option is TWO lines** (`.sf-option-text` + `.sf-option-sub`): the sentence,
then a quiet 12px spec line carrying the room's real name and its capacity
(`الملقى · حتى 6 أشخاص`). 🔴 **That second line is not decoration, and it cannot
be replaced by the chips.** `chipBase` in `Hero.tsx` resolves to `chipsDefault`
until something is picked, and that chip reads **"Location / Al-Khobar"**, so
while the list is OPEN the capacity chip is showing a city. Below `lg` the chips
do not render at all, and `.sf-facts` needs BOTH a selection and a 600px-tall
viewport. The sub line is the only surface that states "up to 30" at the moment
the choice is actually being made, and it is in the option's accessible name.

The window is a CSS square: `.sf-stage` (aspect-ratio box, anchored
`inset-inline-end`) → `.sf-frame` (clipped: video + `.sf-slide` photo buffers +
`.sf-caption`); feature chips `.sf-chip*` anchor to its edges, all via **logical**
props so RTL mirrors automatically (styles in `globals.css`).

**Logo loop (`LogoLoop.tsx` + `logo-mark.ts`):** the مزج mark writes itself (GSAP
dash-offset, write→hold→unwrite, ~6.7s cycle) inside `.sf-frame` until a space is
picked, then fades for good (`dismissed={selected != null}`, a one-way latch).
🔴 `logo-mark.ts` is the brand's ONLY vector logo (hand-authored stroked paths,
fidelity-gated 0.9875 IoU versus the wordmark PNG): strokes in WRITE order
`[م, ز, ج]`, `d` in pen direction. The animation depends on both. **Reuse this
file for any logo work, never re-trace the PNG.** Mount order is load-bearing:
after the coral `mix-blend-color` overlay (so strokes stay beige), before
`.sf-slide` (photos cover it). Reduced motion renders it fully drawn (early
return, no dash setup); mobile no-ops inside the `hidden lg:block` stage
(`getTotalLength()` is layout-independent, correct even in `display:none`).

**The dropdown is portaled to `document.body`** (JS-positioned below the pill):
the hero `<section>` is `overflow-clip` and the next section (`USP`) is
`relative z-10` on cream, so an in-tree `.sf-panel` gets clipped or painted behind
the cream. **Preserve the portal, the `panelRef` outside-click check, and the
scroll/resize reposition** when editing it.

**`.sf-panel` repositioning must ignore the panel's own scroll.** The
capture-phase window scroll listener also hears the panel's internal overflow
scroll, and re-running `place()` on it clears `maxHeight`, which snapped
`scrollTop` to 0 and made the clamped panel's scroll dead on short viewports
(options 5-6 unreachable at 320x568). `schedule()` skips events originating inside
the panel and `place()` restores `scrollTop` across the re-measure; **both guards
are load-bearing.**

🔴 **Once a space IS selected the CTA is a locale-aware `Link`, in the SAME TAB.**
It was a raw `<a target="_blank" rel="noopener noreferrer">` until 2026-07-29,
which was right only while `BOOKING` held mazj.sa URLs. Those became internal
paths on 2026-07-27, so the old markup opened a new tab on a path with NO locale
prefix: `/spaces/coworking/book` answers **307** to `/en/...` on a bare request
(verified), and an Arabic visitor only landed back in Arabic because next-intl
happened to read their `NEXT_LOCALE` cookie. `lib/links.ts` says it in its own
header: booking is part of the journey, not a departure from it. Its label is
`احجز الآن` / "Book now" since the same day, which also widens the trigger's
label box by 36px in EN and 54px in AR at 448px and up.

**Hero pill CTA is always SOLID and opens the picker** when nothing is selected
(`.sf-cta-disabled` was deleted: opacity `.45` dropped its internal contrast to
2.90x versus the reference's 14.53x and made the whole glass control read as
broken; it was the biggest visual gap, far more than the glass itself). Its label
shortens below **448px** (`max-w-[400px]` + `px-6` = the width where the pill stops
shrinking) so the question doesn't truncate: derived, don't round it to `sm:`.
Focus-into-panel gates on `open` ALONE, and that is correct NOW: positioning is
imperative, so the panel mounts in the same commit that flips `open` and the
option refs are already attached when the effect runs. `place()` (a rAF-coalesced
layout effect keyed on `open`) writes width/left/top/max-height/overflow-y straight
onto the portaled node, so no positional STATE exists at all; the old
`panelReady = open && panelPos !== null` gate is gone along with `panelPos` itself.
🔴 **Never reintroduce a per-tick object into that dependency list:** `panelPos`
was a fresh object every scroll and would yank focus back into the list on every
scroll.

**Mobile facts row (`.sf-facts`)**: after a space is picked, sub-lg viewports
render a text-only row of the three desktop chip facts (same `SpaceFinder` keys,
zero media bytes), restoring the parity the hidden `.sf-stage` costs phones. Its
display is gated in `globals.css` to
`(max-width:1023.98px) and (min-height:600px)`: at 320x568 the row's ~88px pushed
the bottom-anchored h1 under the floating nav pill (h1 top 163.6 → 55.6 versus nav
bottom ~90, measured). **Keep the height gate.**

**`.sf-chip-r` has a ~93px copy budget at vw1024** (`0.11*vw − 20px` of room to the
hero clip edge; "AL KHOBAR" clears by ~11px) and its `white-space:nowrap` cannot
simply be dropped: an abspos element offset past its containing block's edge
shrink-wraps to min-content and stacks every word. Longer chip values clip silently
at 1024-1300 viewports; keep values ≤ ~11 uppercase chars or re-anchor the chip
first.

## 🔴 The hover rule: a hover must ADD presence, never remove it

Owner ruling 2026-07-31, after the whole site's hover states were measured and
most of them failed. **Two properties, both checkable, both non-negotiable:**

1. **The control keeps a visible SILHOUETTE in BOTH states (≥2:1 fill against
   the surface behind it).**
2. **The label clears AA (≥4.5:1) in BOTH states.**

**What was wrong, and it was not taste.** `.cta`'s sweep was set to the colour of
the page it sits on, so hovering did not recolour the button, it DELETED it:

| control | rest silhouette | hover silhouette (before) |
|---|---|---|
| `dark` on cream | 17.74:1 | **1.00:1** — the fill *was* the page |
| `onTan` on tan | 15.12:1 | **1.17:1** |
| `onLavender` | 7.39:1 | **1.89:1** |
| `.qualify-pill-btn` (hero) | **1.08:1** at REST | 16.35:1 |

The fix, and the reasoning behind each choice, is in `CtaButton.tsx`'s docblock.
Summary: **every solid button sweeps to coral on hover** (2.90:1 silhouette,
6.12:1 ink label); the ghost variant was already correct and is untouched; the
hero pill is **cream at rest** (16.35:1 inside the dark glass, against the
1.08:1 the ink fill scored) and sweeps coral like the rest.

⚠️ The pill was briefly coral at rest on the same day, which also cleared the
rule at 5.64:1. The owner moved it to cream because the hero already carried
coral three times over (header CTA, accented headline word, logo card) and a
fourth was too much in one view. Both values pass; this one is the aesthetic
call, so do not "restore" the coral as an improvement.

⚠️ The pill's label no longer changes colour on hover. It was brown, which is
12.23:1 on the old cream sweep and **4.22:1 on coral, below AA**. Ink holds both
states on one value (17.74:1 cream, 6.12:1 coral) and the fill carries the change.

🔴 **`--cta-sweep` MAY NEVER BE THE COLOUR OF THE SURFACE BEHIND THE BUTTON.**
That one mistake is the entire bug, and cream is the *right* sweep inside the
dark hero pill (16.35:1) while being the *wrong* one on a cream page (1.00:1).
Same value, opposite outcome. Always check against what is BEHIND.

⚠️ **Coral is not the universal answer, and measuring is what proves it.** Coral
on the lavender band is **1.63:1**, WORSE than the 1.89:1 it would have replaced,
so `onLavender` sweeps to ink (9.99:1) instead. The consistent-looking fix was
the wrong one on exactly one surface.

⚠️ **The sweep must carry NO `border-radius` of its own.** `.cta` already clips
with `overflow: clip` at 4px; a matching radius on the sweep puts two antialiased
curves on the same pixels with `--cta-bg` painted underneath, which rendered as a
faint dark tick at all four corners of every hovered button. Same for
`.qualify-pill-btn-overlay` at 8px.

**Links follow the same rule, and `hover:opacity-*` breaks it.** Eleven links
faded to 60-70% on hover, i.e. became harder to read at the moment of intent. All
replaced 2026-07-31:

| shape | hover signal |
|---|---|
| plain ink link (nav, locale switcher, card titles, FAQ) | `underline decoration-transparent` → `hover:decoration-black` |
| already-underlined link | `decoration-black/30` → `hover:decoration-black` |
| bracketed link (`[ About ]`, footer + contact socials) | the brackets go `opacity-70` → `group-hover:opacity-100` |
| link that renders in 3 different inks (`/about` chapters) | underline THICKENS, `decoration-1` → `hover:decoration-2`, because thickness has no hue |

⚠️ `decoration-current/30` looks like the obvious colour-agnostic answer and is
NOT: an alpha modifier on `currentColor` does not reliably compile, and it dies
silently like every dead Tailwind class. Thickness is the colour-agnostic lever.

⚠️ Every replacement transition list still names **`transform`**, because
`active:scale-[0.96]` compiles to `transform` and a list that omits it makes the
press snap (the trap recorded below). Verify a new hover class actually EMITS
CSS before trusting it: grep the served chunk with a known-live control class.

## CTAs, links and press feedback

The signature button is `CtaButton.tsx` (variants `dark`/`light`/`onLavender`/
`onTan`; it auto-opens `http(s)` hrefs in a new tab and routes internal paths
through the locale-aware `Link`).

Outbound destinations are centralized: `lib/links.ts` (`BOOKING` per-space mazj.sa
URLs, `SOCIALS`, `ZATCA_TAX_NUMBER`) and `lib/contact.ts` (`WHATSAPP_NUMBER` +
`waLink(msg)` localized click-to-chat + `MAPS_URL`, the real Life Tower pin).
**Reuse these, never hardcode a number or URL in a component.**

🔴 The site is **self-serve first**: primary CTAs go to `/spaces`, never WhatsApp.
`waLink` survives only in `/contact`, `/faq`'s closing CTA, `LocationHours`, the
`/spaces` "not sure which fits?" block, and (owner decision
2026-07-28) **`/about`'s closing plate**. **Never label anything
"Pricing" or "Plans".**

⚠️ **`FoundingBand` LEFT that list on 2026-07-28** and is the clearest case of
the self-serve test being applied. Its CTA was a prefilled WhatsApp message
because the startups offer had nowhere to send anyone; now it goes to
`/startups`, which explains the offer and takes a real application. The
`Founding.ctaMsg` key was deleted from both message files in the same change.
The offer's TERMS are still told in person, which is a copy rule (`TONE.md` §6),
not a reason for the button to open a chat.

🔴 **BOOKING IS AN OUTBOUND LINK AGAIN, TEMPORARILY, SINCE 2026-08-01, AND THIS
PARAGRAPH HAS NOW FLIPPED THREE TIMES. Check the code, not your memory of it.**
Owner decision, until Rekaz fix their API: every Book control calls
`bookingUrl(space, locale)` from `lib/links.ts` and opens
`https://mazj.sa/<locale>/…` in a NEW TAB, and the four `/spaces/<space>/book`
routes 307 out to the same pages. Full reasoning in root `CLAUDE.md` (launch
item 1) and the design record it links.

⚠️ **Two component-level consequences.** `CtaButton` needs no change, because it
already opens any `http(s)` href in a new tab, so six of the seven call sites
changed by swapping a value. **`Hero.tsx` is the exception**: its pill is a
hand-written control, not a `CtaButton`, so it carries `target="_blank"` and
`rel="noopener noreferrer"` itself. And `FACILITIES`, `CARDS` and `OFFERS` now
hold a `space` KEY rather than a ready-made `href`, because a store URL depends
on the visitor's locale and a module-scope constant cannot know it.

⚠️ **The paragraph this replaced said the opposite and was true when written:**
`BOOKING.*` became on-site `/spaces/<space>/book` paths on 2026-07-27, only the
card step left (to `platform.rekaz.io`), and the line before THAT said "still go
to mazj.sa" until 2026-07-28. The stable rule under all three states is the one
in `Hero.tsx`'s own comment: **the markup must match where the href points.** A
same-tab `Link` to an absolute URL, or a new-tab `<a>` to a locale-less internal
path, has been shipped here once each.

**Why `/about` earned the WhatsApp exception, and the test that grants one.** A
tour is the one thing on this site that **cannot be self-served**: there is no
tour product in Rekaz, so `/spaces` cannot sell one. `/about`'s closing copy
promised "book a tour" while both its buttons pointed at listing pages, i.e. the
page's last sentence named an action no control on it performed. Every other
tour CTA (`LocationHours`, `SpaceOffers`, the `Faq` answer, `/contact`) was
already `waLink`, so the odd one out was `/about`, not the exception. **The test
is whether a self-serve path exists for the thing the copy promises**, not
whether the page feels commercial: `/about` keeps `/spaces` as its secondary
button precisely so the self-serve route is still one click away. Do not read
this as licence to make WhatsApp primary on a page where `/spaces` can actually
close the loop.

**Press feedback (scale-on-press)** is centralized in `app/globals.css` as
`:active { scale: 0.96 }` on the shared interactive classes (`.cta`,
`.qualify-pill-btn`, `.sf-option`, `.sf-trigger`) via the CSS `scale` property,
which is independent of the CTA sweep's `transform` so they never collide.

🔴 **Never add a per-instance `active:scale-[0.96]` to a `.cta`/`CtaButton`
element:** Tailwind's `scale-[...]` compiles to `transform`, which stacks with the
`scale` property and compounds to ~0.92, a visible double-shrink.

Raw non-`.cta` buttons (the nav CTA, wordmark, nav links and menu toggle, the
footer bracket links and socials, the contact socials, `LocaleSwitcher`, the
`LocationHours` map card, the `SpacesGrid` card-title link, and the `SpaceOffers`
detail / `SpaceDetail` FAQ text links) each carry their own `active:scale-[0.96]`
with an explicit `[transition:...]` list, never `transition-all`.

🔴 **That transition list must name `transform`, NOT `scale`.**
`active:scale-[0.96]` compiles to the `transform` property, so
`transition-[scale]` / `transition-[opacity,scale]` watches a property that never
changes and the press SNAPS with zero easing (shipped twice: contact socials,
LocationHours map card). Press timing standard is 120ms; the idiom is
`[transition:opacity_200ms,transform_120ms]`.

## The interface-polish pass, and what it already covers

Run 2026-08-01/02 against the `make-interfaces-feel-better` principles. **Most of
it was already done, so re-audit before "fixing" anything here.** Measured across
`app/` + `components/` (`.tsx`) on 2026-08-02:

| Principle | State |
|---|---|
| press scale | 36 `active:scale-[0.96]`, plus the shared `.cta` rule in `globals.css` |
| explicit transitions | 37 `[transition:…]` lists; **zero** `transition-all` outside dead `components/ui/button.tsx` |
| text wrapping | 32 `text-balance`, 51 `text-pretty`, 9 `[text-wrap:…]` |
| tabular figures | 51 sites, plus `body` in `admin.css` |
| hit pads | 10 `before:h-11` / `before:h-[44px]` pseudo-pads |
| font smoothing | all three documents (`[locale]`, `admin`, `global-error`) |
| `will-change` | **zero** in `.tsx`, deliberately; see the notes in `globals.css` |

Deliberately NOT wrapped, so don't "complete" it: `Hero.tsx`'s `h1` (two authored
`intro-line` block spans, balance is a no-op), `FaqSection`'s bare `<h3>` wrapper
(the span inside carries it), `PastEvents`' year numeral, `/startups`' `font-mono`
reference code, and the two label-register paragraphs in `global-error.tsx`.

🔴 **`blur-none` COMPILES TO AN EMPTY `--tw-blur`, NOT `blur(0px)`. Use `blur-0`.**
Read out of the served stylesheet 2026-08-02: `.blur-none` emits `--tw-blur:  ;`
while `.blur-0` emits `--tw-blur: blur(0)`. The empty form leaves the composed
`filter` shorthand invalid at computed-value time, so the property falls back to
`none` and a `filter` transition interpolates a list against nothing. It still
renders, which is what makes it a trap rather than a bug.

🔴 **`blur-*` compiles to `filter`, exactly as `scale-*` compiles to `transform`.**
The press-feedback rule above says a transition list must name `transform`, never
`scale`; the same applies one property over. `Navigation.tsx`'s icon cross-fade
therefore names all three: `transition-[opacity,transform,filter]`.

⚠️ **That cross-fade carries a FOURTH easing**, `cubic-bezier(0.2,0,0,1)`,
owner-approved 2026-08-01 for that one control. `DESIGN.md` documents a closed set
of three and none suits a scale-from-quarter-size (expo snaps hard at the start,
premium overshoots, and zero bounce is the requirement). It is NOT in `DESIGN.md`'s
motion table yet, so a later pass may "correct" it back.

## Brand assets

The MAZJ wordmark is `public/logos/mazj-wordmark.png` (recolored to project ink
`#111`; the footer and subscribe card re-tint it white with
`filter:brightness(0) invert(1)`). The favicon is `app/icon.png`.

Outbound links are all REAL and centralized (see above): no `href="#"` placeholder
survives in `components/` or `app/`. The one `#` in markup is `layout.tsx`'s
`href="#content"` skip link, a real in-page anchor, and `CtaButton`'s `href = "#"`
default parameter is dead since every call site passes an explicit href.

🔴 **There is no icon-only MAZJ symbol**: the wordmark PNG is the only mark. Its
transparent alpha also lets it drive a CSS `mask-image` over a solid
`backgroundColor` to render the mark in an exact colour. The ONE live instance is
the small `purple-dark` (`#321f61`) mark in `FoundingBand.tsx`, the `aria-hidden`
span directly above the eyebrow. That idiom used to live in `StepInto`, which
post-redesign carries no mark and no media at all, and `Network`'s only mask is a
radial-gradient vignette over a photo, so don't go looking for the wordmark mask in
either.

**Never wrap copy-driven text in a fixed height plus `overflow-clip`**: growth
clips silently, bottom-first, with no tell. Use a growable floor
(`min-h-[max(100svh,620px)]` in WhyMazj; `min-h-[min(640px,100svh)]` in Hero) and
match the padding's viewport unit to the box's (`pt-[16svh]` with an svh box:
`16vh` computes from iOS's larger toolbar-expanded viewport and silently eats the
copy budget).

---

# Verification recipes

Measuring visual work here is full of traps that produce confident wrong answers.

## Screenshots

GSAP makes static headless screenshots catch mid-animation frames. 🔴 Worse:
**WITHOUT reduced motion everything below the fold captures BLANK**, because
`.reveal` / `.word-reveal` / `.reveal-list` rest at `opacity:0` and only fire on
intersection (a full-page landing capture came back as empty cream, and the
per-section shots were 1.5 KB of nothing). **Reduced motion is what makes the
content VISIBLE, not merely deterministic.**

🔴 But the rescue block only reaches `.reveal`, `.word-reveal .wr-word`, and the
line/intro masks. **`.reveal-list > *` ESCAPES it:** those children keep
`opacity:0` until `.is-visible` lands (their only reduced-motion rule kills the
transition, not the opacity), so `/privacy`, `/terms`, the `/events` archive and
the space feature lists STILL capture blank (measured: zero pixels darker than 150
across the archive's 1994px block). Scroll them into view or add `.is-visible`
yourself.

Capture with Playwright `reducedMotion: 'reduce'` (which disables ScrollFX and CSS
animations) for deterministic final positions. It does **not** pause a raw
`<video autoplay loop>` by itself.

🔴 **But since 2026-07-31 that context CHANGES WHAT IS ON THE PAGE, and a capture
agent that does not know this will file a false bug.** Five of the six ambient
loops are gated on `usePrefersReducedMotion()`, and the gate does not pause them,
it **never mounts the `<video>` at all**: you get the `next/image` poster instead.
So under the very capture mode this section tells you to use, the hero background,
the hero clip window, the three WhyMazj clips, the footer dune and FoundingBand
are all STILLS. That is correct behaviour, not a broken page, and it is not what a
real visitor without the preference sees. Only the nav CTA (`mazj-button.mp4`)
keeps playing.

**So: to photograph the site as most visitors see it, do NOT use
`reducedMotion: 'reduce'`** — take normal motion and pause the videos yourself.
Use the reduced-motion context only when you want the reveal-state rescue, and
expect posters where clips would be. Pause videos in the same session before
measuring anything over video
(`document.querySelectorAll('video').forEach(v => v.pause())`), or sample ≥12
frames ~620ms apart and take the worst case.

🔴 **System-Chrome `--screenshot` captures the VIEWPORT, not the full page, so a
taller `--window-size` does NOT get you further down.** Measured 2026-08-02: the
output is always exactly the window height (1440x900 → 900px; 1440x3200 → 3200px).
And because the landing's sections are sized in `svh` (`min-h-svh`,
`min-h-[max(100svh,620px)]`, `min-h-[min(640px,100svh)]`), a 3200px window makes
the hero 3200px tall and captures **only the hero**. Taller buys nothing.

**To inspect a below-the-fold component without a driver, PROBE IT IN ISOLATION:**
write a standalone `.html` into the scratchpad replicating the exact declarations,
point it at the real files under `public/` with `file://` plus
`--allow-file-access-from-files`, and capture that. Used 2026-08-02 to compare
FoundingBand's card with and without its drop shadow over the real photograph, and
to prove the inset-shadow result in `## Media`. It answers a CSS question without
touching the app, and it is deterministic.

**Measuring a 1px hairline: compare the box's first pixel column against its
second, down many rows, and take the MEDIAN** (ink at 10% makes col0 ≈ 0.90 ×
col1). Always run the same measurement on a known-good control in the SAME
capture; a lone ratio tells you a hairline exists, not that it is the right one.

The page never reaches Playwright `networkidle` (looping autoplay videos keep the
network busy), so wait on `domcontentloaded` + `wait_for_selector('header')` +
a short settle instead. If the Chrome extension is unconnected, delegate capture to
a subagent (system `chrome --headless=new --screenshot`, or Playwright).

🔴 **The chrome-devtools MCP is the best full-page route, and `fullPage: true`
DEFEATS the svh problem** that makes tall `--window-size` captures useless.
`captureBeyondViewport` keeps the layout viewport at whatever `resize_page` set,
so `svh` stays bound to THAT height instead of expanding to the content:
`resize_page(1440, 900)` then `take_screenshot({fullPage: true})` returns the
whole page with every `min-h-svh` section a sane 900px. Three traps: `filePath`
must be INSIDE the workspace root (same as Playwright MCP: save to the repo,
then move); output is at **DPR 2**, so a 1440px page returns 2880px wide and
every crop coordinate must be scaled; and availability varies run to run, so
ToolSearch for it before assuming system Chrome is the only fallback.

🔴 **`resize_page` CANNOT go below ~500px on macOS: it reports success while
`innerWidth` stays 500**, so a 320px pass silently measures desktop and passes.
Use `emulate` with a CDP device-metrics override (`320x800x2, mobile, touch`)
and ASSERT `window.innerWidth` before trusting a number.

⚠️ **It also refuses to START when a stale browser still holds its profile**
(`The browser is already running for ~/.cache/chrome-devtools-mcp/chrome-profile`),
and `list_pages` fails with the same message, so it reads as "the MCP is down"
rather than "the profile is locked".

🔴 **Do NOT `pkill -f chrome-devtools-mcp` to clear it. That pattern matches the
MCP SERVER as well as the browser, and killing it removes every
`mcp__plugin_chrome-devtools-mcp__*` tool for the REST OF THE SESSION** — the
tools stop existing and ToolSearch returns no match for them, so there is no way
back. Done once, 2026-07-31, on the strength of this file's own previous advice
("kill that PID"), which is why that advice is gone.

Recover instead by switching to claude-in-chrome (separate profile, unaffected),
or by dropping the MCP entirely: `npx --yes lighthouse@latest` and Python
Playwright both need no browser MCP and did the whole job that day.

🔴 **A static capture of `/about` shows its chapter photos MISSING, and both
causes look like your bug.** `MediaFrame` renders `loading="lazy"`, so below-fold
images report `naturalWidth === 0` and never fetch; and `data-fx="clip"` holds
`clip-path: inset(34% 12% 28% round 16px)` until ScrollTrigger fires. Together
they read as a broken image path plus broken CSS, and cost a false alarm on
2026-07-28. **Drive a REAL scroll first** (Lenis owns scroll, so
`getLenis()?.scrollTo(y, {immediate: true, force: true})`, imported from
`components/motion/SmoothScroll`, stepped in ~400px
increments with a ~90ms wait), then assert `naturalWidth > 0` and
`clipPath === "inset(0% round 16px)"` before you believe a blank frame.
  - 🔴 **There is no `window.lenis`, and this file told you there was until
    2026-07-30.** The instance is module-scoped (`getLenis()` in
    `components/motion/SmoothScroll`) and is **not created at all** under reduced
    motion, which is the very context every capture recipe here tells you to use.
    So the Lenis handle a capture script reaches for is `undefined`, the scroll
    silently does nothing, and the agent reports the section as blank: the exact
    false alarm this bullet exists to prevent. **Under `reducedMotion: 'reduce'`,
    plain `window.scrollTo` is authoritative and works.** Reach for `getLenis()`
    only in a normal-motion session.

🔴 **The small black circular "N" in a dev screenshot is Next's DEV-TOOLS
INDICATOR, not your layout.** It is `position:fixed`, so it does not mirror in
RTL and it sits ON TOP of real text at 390px, which is exactly what a genuine
mobile overlap looks like. A capture subagent reported it as a confirmed layout
bug on 2026-07-28, with a careful write-up naming the two headings it "broke",
and its own strongest evidence (it stayed on the physical left while the Arabic
content mirrored right) was the proof it was not part of the page. It cannot
exist in production. **Settle it in one command rather than reasoning about it:**
`curl -s localhost:3000/<route> | grep -c next-devtools` returns 1 on the dev
server and 0 on a real `npm start`. Worth telling capture agents up front, since
they cannot know.

🔴 **Tall `--window-size` captures are defeated by `svh` sections:** the landing
hero (`h-svh min-h-[min(640px,100svh)]`), the WhyMazj video cards
(`min-h-[max(100svh,620px)]`) and the footer (`min-h-svh`) expand to fill the
viewport, so an 8000px window makes ONE of them fill the frame and pushes
everything below it out of shot (the footer's own content sits past the bottom
edge). And **`--window-size=390` does NOT emulate mobile**: the page lays out wider
and the shot just crops (confirmed twice: EN and AR clip identically on elements
the change never touched; the quick tell is the hero pill still rendering the long
`cta` where a real mobile viewport shows `ctaShort`). For footer or mobile work,
use a real viewport with a JS-capable tool, or verify via the DOM instead.

## Overflow and fit

- **Neither `--window-size=390` NOR claude-in-chrome `resize_window` emulates a
  narrow viewport.** The first lays out desktop and crops; the second reports
  "Successfully resized" while `window.innerWidth` stays at the desktop value,
  so the numbers look measured and are not. Font metrics ARE linear in
  font-size, so PROJECT instead: measure the string once at 100px, divide by
  100, multiply by the target breakpoint's size, and compare against that
  breakpoint's column. That cleared the kashida `h1` at **178.9px** against the
  **272px** column at 320vw without ever rendering at 320px.
- **Overflow checks need BOTH methods.** `body` and `<main>` both set
  `overflow-x:hidden`, so `documentElement.scrollWidth` under-reports and reads
  clean while content overflows. Walk each element's bounding rect against the
  viewport box (check both edges; RTL overflows left). But that rect walk MISSES
  text overflowing its own box (`whitespace-nowrap`), since the box stays at
  container width: only `el.scrollWidth > el.clientWidth` on that element catches
  it. **Run both.**
- ⚠️ **`sr-only` spans are FALSE POSITIVES in that second method.** The class
  clips them to a 1px box, so each one reports its whole text width as overflow:
  measured `scrollWidth 117 / clientWidth 1` on an "(opens in a new tab)" span at
  390 on `/admin`, where the page's real overflow was **zero**
  (`documentElement.scrollWidth === innerWidth === 390`). Two of them made a clean
  page read as two defects. Filter the class out before counting.
- 🔴 **`el.scrollWidth > el.clientWidth` is BLIND on a `flex-1 truncate` label.**
  The span stretches to fill its box, so `scrollWidth` returns the BOX width
  whenever the text fits: the test reports equal-and-fine with zero slack
  information, and only trips once the text ALREADY overflows. For real headroom,
  measure the string alone at `width:max-content` and subtract from the live
  `clientWidth`. The hero pill trigger (`min-w-0 flex-1 truncate`) is exactly this
  shape, and its tightest box is 167px at vw320 (per-locale copy budgets live in
  `TONE.md` §7).
- **`scrollHeight` cannot see TOP overflow, only bottom.**
  `scrollHeight === clientHeight` does NOT prove text isn't clipped; it silently
  misses cut-off ascenders (this check once "verified" a live clipping bug as
  absent). Measure ink with canvas `TextMetrics` using the heading's exact font
  shorthand (`900 85px "Thmanyah Sans"`) → `actualBoundingBoxAscent` /
  `Descent`, and find the real baseline by injecting a 0×0
  `vertical-align:baseline` probe span into the line.
  - ⚠️ **That probe must run PER LINE, not per element.** Appended to a
    multi-line heading it measures the LAST line's baseline against a ONE-line
    box and returns a negative "room" (measured `-47` on `/about`'s two-line
    `closingTitle`). Probe each `.wr-line`, or the first text node. A negative or
    absurd result is the tell that you measured the wrong box, **not** that the
    heading clips: confirm visually before acting on it.
- **Responsive fit is testable without a mobile viewport: rebuild the component's
  box at fixed widths.** Recreate the real geometry in a specimen rig (the
  component's flex/padding/gap values plus the actual woff2) at each breakpoint's
  column width, then read `clientWidth` off it. 🔴 Media queries key off the
  VIEWPORT, not your container, so every per-breakpoint override must be applied
  BY HAND per case (`.sf-trigger` padding/gap under 360, `.qualify-pill-btn`
  padding under 359) or all rows silently test desktop geometry and pass. Cheaper
  and more honest than fighting `--window-size`.
- 🔴 **For pure text WIDTHS, shape the real woff2 with HarfBuzz: exact, not
  approximate.** `pip install uharfbuzz` (sandbox off), shape at the element's px
  size; it reproduced all seven of `TONE.md` §7's browser-measured values to
  **0.1px**. Two traps, both SILENT: HarfBuzz here is built without brotli, so
  `hb.Face(<woff2 bytes>)` shapes everything to `.notdef` and every n-character
  string returns the SAME width (identical widths for different strings is the
  only tell); and `TTFont(path).save()` round-trips back to woff2, so set
  `font.flavor = None` first. Tracking is per character for Latin and **zero**
  for Arabic (`html[lang="ar"] *` neutralises it).
- **When no JS-capable browser tool is up**, run the ink-width and baseline-probe
  measurements in that same rig: copy the woff2 into the scratchpad beside the
  specimen, `python3 -m http.server`, have the script write its numbers into the
  DOM, and screenshot to read them. **Calibrate against a known value before
  trusting it** (the rig reproduced the footer `<h2>`'s documented 350.2px as
  346px).
- **Measure a rendered line's width by colour-keying its ink, not by font math.**
  Mask the text colour (cream versus `#FF5A48`), then split the column profile on
  gaps >12px to get per-WORD runs. Exclude the non-text column (x<800 at vw1440)
  or the coral media square and its floorplan register as "words". Necessary
  because metric predictions drift: CSS `letter-spacing` does NOT apply across an
  Arabic tatweel run, so `advance − tracking` under-predicted by ~1.6px per glyph
  (16.83 predicted versus 18.46 measured at 85px/900).

## Contrast, and the coral

🔴 **Contrast MUST be measured from rendered pixels, never computed from token or
alpha values: the `.grain-overlay` makes computed numbers systematically
OPTIMISTIC.** The film grain (`mix-blend-mode: soft-light`, opacity 0.32) covers
the entire page, so it degrades every foreground/background pair by **~0.3-0.5
ratio points**. Confirmed with a hidden-versus-shown control: two labels computed
6.98 / 6.69 from their CSS composites and measured 6.99 / 6.71 with grain OFF
(agreeing), but dropped to 6.24 / 6.64 with grain ON. So a value that pencils out
at exactly 4.5 will ship failing. Sample actual pixels (canvas over a screenshot
region), and for any text over VIDEO sample ≥12 frames ~620ms apart and take the
worst case: frame jitter here reaches ~16 ratio points, so a small sample has
repeatedly produced false passes AND false fails. `text-shadow` earns NO WCAG
1.4.3 credit (it measures fg versus bg); a `background` plate does. To sample a
text block's BACKDROP, set the copy `visibility:hidden`, screenshot, restore:
glyph ink otherwise pollutes the band.

🔴 **The brand coral `#FF5A48` is untouchable, INCLUDING its apparent lightness.
Do NOT darken it for contrast without explicit user approval.** Cream or white on
`#FF5A48` tops out at ~2.90:1 (fails AA), and a remediation pass "fixed" this by
darkening the coral's *appearance*: a scrim over the header CTA and footer, plates
behind the hero chips, and a darker-coral `orange-ink` text token. **The user
rejected ALL of it hard ("it's our branding") and it was reverted**: the darker
coral killed the brand feel. A black scrim (`bg-black/[0.22]`) plus a
`brightness(0.78)` video dim had nonetheless survived on the header CTA in code;
on 2026-07-23 the owner again flagged that button as "darker than ours" and
**both were removed**: the header CTA now renders at full `#FF5A48` (white label
back to ~3.08:1, owner-accepted).

So these specific spots knowingly sit below AA, and that is the owner's explicit
brand-over-metric choice, **not an open bug**: the header CTA white label, footer
cream text over flat coral, hero telemetry chips, and coral eyebrows and index
numbers on cream. **Leave them.** Any real fix must keep the coral at full
`#FF5A48` brightness and come from the user, not from a contrast audit.

## Measuring CSS and video

- **Verifying compiled CSS:** Tailwind emits `rgb()`, not hex, so a token search
  for `#514e4a` returns 0 while `rgb(81 78 74)` is present. Turbopack **dev** also
  serves CSS from `/_next/static/chunks/*.css`, not the production
  `/_next/static/css/` path. 🔴 Two false-negative traps in that dev chunk: it is
  **pretty-printed** (`.text-45 {\n  font-size: 45px;\n}`), so a `\.text-45\{`
  pattern matches NOTHING (allow whitespace before the brace); and Tailwind only
  emits classes it actually finds in content, so bare `.text-85` / `.text-50` /
  `.text-70` are legitimately ABSENT when only `lg:text-85` is used. **Always grep
  a known-live class (`.text-12`, 58 usages) as a control** before concluding a
  class is missing.
- **Computed-CSS extraction here has two guaranteed false positives.**
  `__nextjs-Geist` and `__nextjs-Geist Mono` are the Next.js **dev overlay's**
  fonts (they report `status: unloaded`), not part of the design: the real stack is
  Thmanyah Sans 400/500/700/900 and nothing else. And `#e5e7eb` is Tailwind
  preflight's default `border-color` on every element, 482 hits, which ranks it as
  a top "brand colour" while it is drawn nowhere. Strip both before trusting any
  extracted token list.
- 🔴 **Hand-written `backdrop-filter` MUST put `-webkit-` FIRST, standard LAST.**
  Reversed, Lightning CSS collapses the pair and ships ONLY
  `-webkit-backdrop-filter`, which Chrome 148+ no longer recognises, so
  `getComputedStyle().backdropFilter === "none"` and the blur dies in EVERY
  browser, silently. `.qualify-pill`, `.sf-panel` and `.sf-caption` all shipped
  dead this way and nobody noticed until the glass was measured. Tailwind's own
  `backdrop-blur-*` are fine (they emit both). **Verify in the SERVED stylesheet**
  (`curl` the `/_next/static/chunks/app_globals_*.css`), never the source. `mask`
  is NOT affected: Lightning expands that shorthand to longhands keeping both
  prefixes.
- **Reduced motion collapses ALL transition durations to 0.001ms** (global rule at
  the bottom of `globals.css`), so a `reducedMotion: 'reduce'` capture context
  cannot measure transition timing. Verify hover and press transitions by
  asserting `getComputedStyle(el).transitionProperty`, which is also the only
  automated catch for the transition-list-versus-transform press bug above.
- **Verifying a blurred video layer: measure the FILL ONLY.** White label glyphs
  paint *above* the blur, so whole-element variance is dominated by their hard
  edges and understates it badly (7% apparent reduction versus **41.6%** measured
  on the label-free padding strips). Likewise, frame-to-frame pixel deltas cannot
  pin a playback rate: screenshot overhead widens the real interval and the dune
  clip's motion is non-uniform (deltas ranged 1.12-10.52). Read
  `video.playbackRate`, or sample `currentTime` across a known wall-clock gap.
- 🔴 **Anything measured over the hero video needs a PAUSED frame.** Frame jitter
  (spread ~49) routinely EXCEEDS the effect being measured, so one sample proves
  nothing: a lone dark frame produced an "absolute ceiling" that a later frame
  simply exceeded, and a re-crop-the-video recommendation had to be retracted
  because of it. A/B with the video paused in ONE session, or sample ≥3 frames
  ~700ms apart. Two more traps: an "interior" region silently includes the LABEL
  TEXT (std 3 → 30, pure artifact), and `element.screenshot()` on a fractional-px
  bbox returns 802×122 not 800×120, so edge rows are half background: re-cut on
  the device grid before measuring a 1px rim.
- 🔴 **An offscreen measuring span does NOT load the webfont, and
  `document.fonts.ready` resolves anyway.** Nothing visible uses the face, so it
  is never requested, and every width comes back in the FALLBACK font. The
  output is plausible rather than obviously broken, which is what makes it
  expensive: a kashida sweep returned a uniform `0.203em` for all 220 Arabic
  codepoints and read as a real finding about the font. Call
  `await document.fonts.load('900 100px "Thmanyah Sans"', sample)` FIRST, and
  assert one known width as a control before trusting the run.

---

## `components/ui/` and `components/admin/`: the ADMIN's design system

Added 2026-07-29. 🔴 **Neither folder is part of the marketing site and neither
may be imported from one.** `components/ui/` is shadcn, vendored from the
`new-york-v4` registry and patched for this repo's Tailwind 3.4;
`components/admin/` is the 22 MAZJ primitives built on top. Both style
themselves with tokens that resolve through CSS custom properties defined in
`app/admin/admin.css`, which only the admin's own root layout imports.

⚠️ Used on a marketing page they do not throw and they do not look broken: the
declaration is invalid, the browser drops it, and the element keeps whatever it
inherited. `eslint.config.mjs` bans the imports; nothing can ban a copied class
name. **The full mechanics, the four silent traps, and the vendoring script live
in [`../app/CLAUDE.md`](../app/CLAUDE.md) under "The admin's design system".**

🔴 **`cn()` from `@/lib/utils` is sanctioned in those two folders and forbidden
everywhere else in `components/`.** The marketing site composes its classes
literally on purpose: a literal class list is greppable, and this repo has been
bitten by a format-on-save linter rewriting Tailwind values it could see. Values
hidden behind a merge function are values it cannot.

## `components/events/`

Added 2026-07-28, when `/events` stopped being static copy. Four files:
`EventCard`, `UpcomingEvents`, `PastEvents`, `EventRegistration`. The first
three are Server Components; only the form is a client one.

🔴 **They take DATA, not translations, for the event itself.** `useTranslations`
still supplies the chrome (labels, empty states, CTAs), but every event string
arrives already resolved to ONE language from
`app/[locale]/events/_lib/events.ts`. A component handed `{en, ar}` has to
decide, and a component that decides eventually decides wrong on one locale.

🔴 **Dates are formatted on the SERVER and cross as finished strings.** `ar-SA`
resolves to a different CALENDAR depending on the engine's ICU version (region
SA defaults to `islamic-umalqura`), so a date formatted in the browser can
disagree with the one rendered on the server. Inside a `<time>` element that is
a React hydration mismatch, i.e. a broken page rather than a wrong date. Never
move this into a client component "to use the visitor's timezone": the event
happens in Al Khobar and that is the only time that means anything.

⚠️ The old `components/UpcomingEvents.tsx` and `components/PastEvents.tsx` were
DELETED, not edited, and their `EventsPage.upcoming` / `EventsPage.archive` keys
are gone from both message files. A grep for either will find nothing.

**The archive is mostly UNLINKED on purpose.** 41 imported historical events
carry a title, a date and a one-line subtitle and nothing else, so linking each
to its own page would publish 41 near-empty URLs from the strongest page on the
route. `hasDetail` is the rule: an upcoming event always gets a page (that is
where registration happens), a past one only when it has a description or a
poster.

**The empty poster state is `.dot-field`, not a stock photo.** An event is often
published the minute it is decided and gets its artwork a week later, so the
gap is a normal state rather than an error.

## Adding a section

Create the component here in `components/`, add its namespace to **both** message
files, and render it in `app/[locale]/page.tsx`. Server components can call
`useTranslations` directly; client components work because the whole tree sits
under `NextIntlClientProvider`.

## Removing a section

Mirror of the above, and it reaches further than expected. Measured while
deleting `/about`'s principles ledger (2026-07-31):

1. The component: the JSX, plus any now-unused `type` and `t.raw()` read. `tsc`
   catches the orphaned type; **nothing** catches a dead `raw()` call.
2. **Both** message files. Prove it was a pure DELETE (diff opcodes, not a line
   count) and that leaf-key parity still holds.
3. 🔴 `test/arabic-kashida.test.ts`, if any removed key carried a swash. The
   pinned inventory is an equality assertion, so a deleted key fails the suite.
4. 🔴 `TONE.md`, which quotes real copy as worked examples. **Four** separate
   rules cited this one section. Keep the rules, mark the copy deleted, or the
   next session greps for a string that no longer exists.

**Before proposing a replacement, measure what the section uniquely carried.**
Here the answer was "nothing": the page's own h1 and intro already made the
claim, and its only facts were capacities living in 7 and 11 other keys.
