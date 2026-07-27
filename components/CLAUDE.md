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

**Adding or verifying a font:** `fonttools` (Python) is installed. Check a woff2's
glyph coverage (Arabic `U+0627` plus Latin present) before wiring it, and check
any SPECIAL character before shipping it (`U+0640` tatweel was confirmed in all
four weights before the hero kashida went in). External font CDNs (e.g.
`framerusercontent.com`) aren't in the sandbox network allowlist, so curl font
binaries with the sandbox disabled (`github.com` and `raw.githubusercontent.com`
ARE allowed). Standalone HTML font specimens need `<meta charset="utf-8">` or
Arabic mojibakes, and Playwright MCP can't open `file://` (serve over 127.0.0.1
with a UTF-8 charset).

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
`prefers-reduced-motion`, and with MotionToggle unmounted NOTHING gates the 6 live
ambient loops (Hero bg + desktop clip, nav CTA, footer dune, WhyMazj,
FoundingBand). Reduced-motion visitors still get all of them, and a Playwright
`reducedMotion: 'reduce'` context will NOT freeze them. If a gate is ever asked
for it has to be JS (`usePrefersReducedMotion()` + `video.pause()`), never the
`@media` block. And `hidden lg:block` still **DOWNLOADS** its media on mobile:
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
`network-bg`, `step-into`, `contact-welcome`, `events/*` (`location-map` is a
Google-map still, not a photo). 🔴 `spaces/office-day` and `office-month` are
LEGACY names from when daily and monthly were separate products: they now hold the
pod interior and the row of glass rooms respectively, so don't read the filenames
as descriptions or "correct" the mapping. Crop a content photo to its slot's exact
dims with
`ffmpeg -i SRC -vf "scale=W:H:force_original_aspect_ratio=increase,crop=W:H" -q:v 3 DEST`
(spaces 1200×800, usp-* 1066×1333, network-bg 1013×1333, step-into 1000×1333,
events 900×844).

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
  `brightness(0.78)`; `footer-dune` is Y≈83 and takes none. Matching luma is what
  makes two elements read as the same coral.
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
dropdown. `FACILITIES[]` (config, not copy) is **6 picker entries fanned onto only
4 `BOOKING` URLs** (`dayDesk` + `membership` → `sharedSeat`, `officeDay` +
`officeMonth` → `privateOffice`), each with its own photo
(`public/images/spaces/*.jpg`, pulled from mazj.sa's rekaz.io CDN, optimized with
`sips`). Picking one crossfades its photo into the window and aims the CTA at that
page. 🔴 The duplicated hrefs are a deliberate leftover of mazj.sa's 6→4
restructure: the hero still offers duration as a CHOICE, while mazj.sa now handles
duration as a variant inside each product. **Don't read it as 6 products, and
don't "dedupe" it.** Copy = `SpaceFinder` namespace.

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
`/spaces` "not sure which fits?" block, and `FoundingBand`. **Never label anything
"Pricing" or "Plans".** Booking and checkout still go to `BOOKING.*` on mazj.sa.

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
animations) for deterministic final positions. It does **not** pause raw
`<video autoplay loop>`, and nothing else does either now that `MotionToggle` is
unmounted sitewide, so ambient videos keep playing on every route and nothing is
ever frozen on one frame for you. Pause them yourself in the same session before
measuring anything over video
(`document.querySelectorAll('video').forEach(v => v.pause())`), or sample ≥12
frames ~620ms apart and take the worst case.

The page never reaches Playwright `networkidle` (looping autoplay videos keep the
network busy), so wait on `domcontentloaded` + `wait_for_selector('header')` +
a short settle instead. If the Chrome extension is unconnected, delegate capture to
a subagent (system `chrome --headless=new --screenshot`, or Playwright).

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

- **Overflow checks need BOTH methods.** `body` and `<main>` both set
  `overflow-x:hidden`, so `documentElement.scrollWidth` under-reports and reads
  clean while content overflows. Walk each element's bounding rect against the
  viewport box (check both edges; RTL overflows left). But that rect walk MISSES
  text overflowing its own box (`whitespace-nowrap`), since the box stays at
  container width: only `el.scrollWidth > el.clientWidth` on that element catches
  it. **Run both.**
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
- **Responsive fit is testable without a mobile viewport: rebuild the component's
  box at fixed widths.** Recreate the real geometry in a specimen rig (the
  component's flex/padding/gap values plus the actual woff2) at each breakpoint's
  column width, then read `clientWidth` off it. 🔴 Media queries key off the
  VIEWPORT, not your container, so every per-breakpoint override must be applied
  BY HAND per case (`.sf-trigger` padding/gap under 360, `.qualify-pill-btn`
  padding under 359) or all rows silently test desktop geometry and pass. Cheaper
  and more honest than fighting `--window-size`.
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

---

## Adding a section

Create the component here in `components/`, add its namespace to **both** message
files, and render it in `app/[locale]/page.tsx`. Server components can call
`useTranslations` directly; client components work because the whole tree sits
under `NextIntlClientProvider`.
