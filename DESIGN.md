---
version: alpha
name: MAZJ
description: A warm, cream-canvased editorial system for a bilingual (Arabic + English) Saudi coworking brand. One typeface, one coral, hairline structure instead of cards, and photography that carries the mood.
colors:
  primary: "#FF5A48"
  secondary: "#C8B0FF"
  on-secondary: "#321F61"
  tertiary: "#4C2806"
  neutral: "#111111"
  neutral-variant: "#514E4A"
  surface: "#FFF7E9"
  surface-container: "#F0E5CF"
  surface-bright: "#FFFFFF"
  outline: "#E7E0D3"
typography:
  display-hero:
    fontFamily: Thmanyah Sans
    fontSize: 85px
    fontWeight: 900
    lineHeight: 0.98
    letterSpacing: -0.02em
  display-page:
    fontFamily: Thmanyah Sans
    fontSize: 70px
    fontWeight: 900
    lineHeight: 1.02
    letterSpacing: -0.02em
  statement-lg:
    fontFamily: Thmanyah Sans
    fontSize: 85px
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: -0.02em
  statement-md:
    fontFamily: Thmanyah Sans
    fontSize: 50px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Thmanyah Sans
    fontSize: 50px
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Thmanyah Sans
    fontSize: 32px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Thmanyah Sans
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: -0.02em
  metric:
    fontFamily: Thmanyah Sans
    fontSize: 50px
    fontWeight: 700
    lineHeight: 1.35
    fontFeature: tnum
  body-lg:
    fontFamily: Thmanyah Sans
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.625
  body-md:
    fontFamily: Thmanyah Sans
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.625
  body-sm:
    fontFamily: Thmanyah Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.625
  action:
    fontFamily: Thmanyah Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1
  label-md:
    fontFamily: Thmanyah Sans
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Thmanyah Sans
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.05em
rounded:
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  2xl: 16px
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  gutter: 24px
  page-inline: 24px
  page-inline-lg: 40px
  section-block: 96px
  section-block-lg: 128px
  opener-block: 150px
  opener-block-lg: 190px
  container: 1400px
  container-narrow: 860px
  container-prose: 720px
  nav-height: 57px
  nav-offset: 22px
components:
  surface-page:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.neutral}"
    typography: "{typography.body-md}"
  surface-tan:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.tertiary}"
  surface-ink:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.surface}"
  band-lavender:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
  button-primary:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.surface}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    height: 50px
  button-primary-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.tertiary}"
  button-outline:
    textColor: "{colors.neutral}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    height: 50px
  button-on-lavender:
    backgroundColor: "{colors.on-secondary}"
    textColor: "{colors.surface-bright}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    height: 50px
  button-brand-coral:
    backgroundColor: "{colors.primary}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    height: 45px
  badge-coral:
    backgroundColor: "{colors.primary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.sm}"
  nav-pill:
    backgroundColor: "{colors.surface-bright}"
    textColor: "{colors.neutral}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
  glass-picker:
    textColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    height: 60px
    width: 400px
  glass-picker-button:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.surface}"
    typography: "{typography.action}"
    rounded: "{rounded.lg}"
    height: 48px
  glass-picker-panel:
    rounded: "{rounded.xl}"
    padding: 6px
  glass-picker-option:
    textColor: "{colors.surface}"
    rounded: "{rounded.xs}"
  media-frame:
    rounded: "{rounded.2xl}"
  card-space:
    textColor: "{colors.neutral}"
    typography: "{typography.headline-sm}"
  heading-display:
    textColor: "{colors.neutral}"
    typography: "{typography.display-hero}"
  heading-section:
    textColor: "{colors.neutral}"
    typography: "{typography.headline-lg}"
  heading-on-tan:
    textColor: "{colors.tertiary}"
    typography: "{typography.headline-lg}"
  text-body:
    textColor: "{colors.neutral-variant}"
    typography: "{typography.body-md}"
  label-eyebrow:
    textColor: "{colors.neutral-variant}"
    typography: "{typography.label-md}"
  metric-figure:
    textColor: "{colors.neutral}"
    typography: "{typography.metric}"
  accordion-row:
    textColor: "{colors.neutral}"
    typography: "{typography.body-lg}"
  skip-link:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.neutral}"
    typography: "{typography.action}"
    rounded: "{rounded.sm}"
    height: 44px
---

# MAZJ Design System

## Overview

MAZJ (مزج) is a single coworking building in Al Khobar, Saudi Arabia, and its
site is built to feel like the building: warm, calm, staffed, and specific to
one place. The house style is **warm editorial minimalism**. A cream canvas
carries near-black text, structure comes from hairlines rather than cards, and
the emotional register is welcome rather than hustle. Photography of the real
rooms and the real members does the persuading; the interface stays quiet
around it.

The audience is founders, freelancers, and small teams in the Eastern Province,
reading in Arabic first and English second. Both languages are first-class:
every string exists in both, one typeface serves both, and the layout mirrors.
Nothing in this system may be a Latin-only idea.

Three qualities are non-negotiable and outrank any other rule in this file:

1. **The coral `#FF5A48`.** It is the brand, including its lightness. It is
   never darkened, never substituted, never "fixed" for a contrast metric.
2. **One typeface.** Thmanyah Sans (خط ثمانية) in four weights, carrying Latin
   and Arabic in the same files. There is no secondary display face and no
   monospace.
3. **Air.** Sections breathe at 96px to 128px of block padding, and openers at
   150px to 190px. When something feels wrong, the answer is usually more space,
   not more ornament.

**Where this file sits.** This document owns the visual system: colour, type,
space, shape, motion, and component form. It does not own copy. Voice, tone,
settled Arabic vocabulary, and what the site may or may not claim live in
`TONE.md`. Implementation mechanics and the reasoning behind individual code
decisions live in `CLAUDE.md`. When a visual rule here and a copy rule in
`TONE.md` appear to collide, they are answering different questions; resolve it
by asking which layer the decision belongs to.

**Lineage.** The visual system is a reskin of Daylight Energy (godaylight.com):
the cream-and-tan palette tiers, uppercase eyebrow labels over hairlines, the
two-tone headline whose last phrase takes the accent, word-by-word statement
reveals, the always-on ambient video inside the header button, and the CTA whose
fill sweeps up from below. Where the two systems disagree, **this file wins.**
Three things are MAZJ-owned and must never be reverted toward the reference: the
coral (Daylight's accent is orange `#F66F00`), the مزج wordmark, and Thmanyah.
Two further deliberate divergences are documented in place below: positive
eyebrow tracking, and the hero glass control.

## Colors

The palette is a warm neutral field with one hot accent and one cool one. It is
deliberately small: ten tokens, no tints generated off them, and no third accent.

- **Primary, Coral (#FF5A48):** The brand. It appears as the header button fill,
  small badges, section index numerals, and single accented words inside a
  headline. It is an accent, never a surface: no full-bleed coral sections, no
  coral body text.
- **Secondary, Lavender (#C8B0FF):** The cool counterweight, used as a
  full-bleed band on two sections (the closing invitation and the startups
  offer) to break the cream. Also the text-selection highlight.
- **On-secondary, Deep Indigo (#321F61):** The ink that sits on lavender, the
  button fill inside lavender bands, and the focus-ring hue.
- **Tertiary, Brown (#4C2806):** Ink for headings on tan, and the hue behind the
  hairline grid overlay and dot-field textures at 6% to 18% alpha.
- **Neutral, Ink (#111111):** Primary text on cream, the fill of the default
  button, and the dark surface of the hero and the sub-page photo openers. It is
  a near-black, never pure `#000`.
- **Neutral-variant, Warm Grey (#514E4A):** All secondary and body copy, and the
  default eyebrow colour. It measures 7.77:1 on cream and 6.62:1 on tan.
- **Surface, Cream (#FFF7E9):** The page. Also the ink used on every dark
  surface, so the same value reads as both ground and figure.
- **Surface-container, Tan (#F0E5CF):** The second surface tier, used to
  separate a section from its neighbours without a card or a border.
- **Surface-bright, White (#FFFFFF):** Reserved for exactly one thing, the
  floating navigation pill. Pure white is not a page surface in this system.
- **Outline, Hairline (#E7E0D3):** Every rule and divider. It ships as ink at
  10% alpha (15% on openers), which composites to this value on cream. All
  structure in this system is a 1px hairline of this weight.

**The coral contrast exception, and it is an exception.** Cream on coral
measures 2.90:1 and white on coral measures 3.08:1, both below WCAG AA. The
places this occurs (the header button label, footer copy over the coral band,
the hero telemetry chips, coral eyebrows and index numerals on cream) are known
and are the owner's explicit brand-over-metric ruling. Darkening the coral or
laying a scrim over it was tried, shipped, measured, and rejected. That is why
`primary` is the only colour in this file that appears in a component without a
paired `textColor`: encoding the pair would assert a compliance this system does
not claim. Treat these spots as settled, not as open bugs, and never resolve
them by changing the coral.

**Inherited versus owned, verified against the reference's live stylesheet.**
Seven of these values are literally the reference's own: the cream `#FFF7E9`, tan
`#F0E5CF`, brown `#4C2806`, indigo `#321F61`, warm grey `#514E4A`, and two
further beige tiers it ships that MAZJ does not use. The one MAZJ-owned value is
the **coral**, where the reference uses orange `#F66F00` (published as its
primary brand colour, with a full print spec down to Pantone 144 C). The
**lavender `#C8B0FF`** is inherited and matches the swatch on the reference's own
brand page; note that its compiled stylesheet ships `#C8B2FF` instead, so its two
sources disagree by one digit. Ours follows the published swatch and is settled:
do not "correct" it toward the implementation value. One thing is a deliberate
omission: the reference's **blue** (`#BED5FF` and `#1D3E86`) is not in this
palette and must not be introduced. The hero's spectrum wash runs coral to
lavender for exactly this reason, where the reference's spans into blue.

**Status colours do not exist here.** There is no success, warning, error, or
info hue on this surface, and coral must not be pressed into service as an error
red: it is the brand accent and would read as a promotion. If a future surface
needs status colour, introduce it deliberately rather than borrowing from this
palette.

## Typography

One family, four weights, and a hard split between three registers: display,
body, and label.

- **Display** is Thmanyah Sans at 900 for page titles and 700 for the big
  in-page statements, set very tight (line-height 0.98 to 1.05) with -0.02em
  tracking. It runs from 45px to 85px and is always short: 14 to 18 characters
  per line, enforced with `ch`-based max-widths rather than manual breaks.
- **Section headings** drop to weight 500 at 32px to 50px. The weight change is
  the hierarchy signal, not just the size, so a 500 heading never competes with
  a 700 statement on the same screen.
- **Body** is 15px at 1.625 leading in warm grey, 18px for a route's opening
  paragraph, 14px inside cards and navigation. Measure is 46 to 62 characters.
- **Labels (the eyebrow)** are 12px, weight 500, uppercase, tracked +0.05em.
  Nearly every section opens with one over a hairline. 11px is the tight-chrome
  variant.
- **Numerals** are tabular wherever figures stack or count (capacities, hours,
  years, route indices).

**Why the eyebrow tracking is positive.** The reference's own published spec for
its label register is uppercase mono, 12px or 16px only, weight 400, tracked
**+5%**, which is the same +0.05em this system uses. Its live homepage
nonetheless renders those eyebrows at roughly -0.02em, because its compiled size
utility bakes a negative default tracking in and its eyebrows never override it.
That is an implementation slip on their side, not a design intent, and it must
not be copied. There is a second reason not to copy it even if it were
deliberate: their labels are set in a monospaced face whose wide sidebearings
absorb negative tracking, whereas this system is single-typeface and uppercase
sans at 12px needs its tracking opened, not closed. Keep +0.05em.

### Font sources

- **Family:** Thmanyah Sans (خط ثمانية), self-hosted `.woff2` at weights 400,
  500, 700, 900. Every file carries both Latin and Arabic glyphs, so numerals
  and symbols inside Arabic copy render from the same face and no per-locale
  font swap exists.
- **Fallback chain:** `"Thmanyah Sans", system-ui, sans-serif`. There is no
  serif and no mono in the design. If a build cannot ship Thmanyah, fall back to
  a humanist sans with real Arabic coverage and true 500/700/900 weights; never
  synthesize bold, because Arabic suffers badly from faux weights.
- **Availability:** free for commercial use, published by Thmanyah
  (font.thmanyah.com). Builders can obtain it directly, so graceful degradation
  should rarely be needed.
- **Weight 900 is load-bearing.** Page titles are set at 900 and section
  statements at 700. Reverting either to 500 flattens the whole page.

### The responsive ramp

Tokens above are the desktop values. Each display role steps down on small
screens, and the step is part of the design, not an afterthought:

| Role          | Mobile | Desktop | Notes                                  |
| :------------ | -----: | ------: | :------------------------------------- |
| display-hero  |   40px |    85px | line-height 1.02 to 0.98               |
| display-page  |   40px |    70px | panel opener; 45px on photo openers    |
| statement-lg  |   40px |    85px | 44px where the lane is wider           |
| statement-md  |   32px |    50px | 45px variant in narrow lanes           |
| headline-lg   |   32px |    50px | weight 500                             |
| headline-md   |   24px |    32px | weight 500                             |
| body-lg       |   15px |    18px | route intro paragraph                  |

The type scale is a **closed set**: 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20,
24, 28, 32, 36, 40, 45, 50, 70, 85. There is no 34, 44, 52, 64, or 80 step. In
this stack a size outside the set is not an error, it silently applies nothing
and the element inherits 16px body size, so a display heading collapses to body
size at that breakpoint with no warning. Verify a size exists before using it.

### Bilingual type (Arabic + Latin)

Arabic is not a translation layer, it is half the system, and it fails in ways
Latin does not.

- **Letter-spacing is disabled entirely in Arabic.** Tracking breaks glyph
  joining, so the Arabic document neutralizes it globally. This means uppercase
  and tracking, the two usual signals of a label, are both no-ops in Arabic.
  **Weight is the only register signal that survives both writing systems**, so
  the eyebrow is keyed on weight 500.
- **Arabic needs more leading.** Headings get line-height 1.35 in Arabic.
  Arabic descenders run roughly twice Latin's at the same size, so Arabic is the
  worse clipping case, not the rescued one: a masked display line clips Arabic
  by about 4.35px at 85px while the same English line clears by 0.51px. Check
  Arabic first after any weight or leading change.
- **That leading rescue only reaches `h1`, `h2`, and `h3`.** Arabic display text
  inside a `span` or `p` gets no rescue and adjacent lines can physically
  collide. Either make display text a real heading tag or give it explicit 1.35
  leading at the call site.
- **Numerals differ.** Arabic copy uses Arabic-Indic numerals, so never compare
  the two languages by value to check parity. Compare key paths and array
  lengths.

## Layout

A single wide lane, generous air, and hairlines instead of boxes. Sections are
full-bleed bands of colour; the content inside them is centred in a fixed
maximum width. Spacing follows a 4px unit, and the values that recur are 4, 8,
16, 20, 24, 40, 48, 64, and 96.

### Container lanes

- **Wide (1400px):** the default lane for almost everything, including
  navigation, section headers, grids, and the footer. This is the system's
  signature: a wide, calm measure with real margins.
- **Narrow (860px):** long-form reading, grouped question lists, and legal
  routes.
- **Prose (720px):** a single paragraph column, used for accordion answers and
  the copy block inside a photo opener.
- **Full-bleed:** hero video, sub-page photo openers, dark statement bands, and
  the lavender bands run edge to edge with no lane at all.
- **Measure caps:** display headings cap at 14 to 18 characters, body at 46 to
  62 characters. Use character units for these, not pixels, so the cap survives
  a type-size change. They are documented here rather than as spacing tokens
  because `ch` is not a valid Dimension unit in this format; only `px`, `em`,
  and `rem` are.

### Section rhythm

- Inline page padding is 24px, rising to 40px from the large breakpoint up.
- Block padding is 96px, rising to 128px. Reference and detail sections run
  tighter at 64px to 96px, and the lavender closing band runs looser at 112px to
  160px.
- Route openers reserve 150px to 190px of top padding to clear the floating
  navigation, which is fixed 22px from the top of the viewport and 57px tall.
- Grids are 1 column on phones, 2 at the small breakpoint, and 3 or 4 at large,
  with a 24px gutter. Copy and media pair as asymmetric two-column splits
  (1.35fr to 1fr, or 0.8fr to 1.2fr), never as an even 50/50.
- Every content block starts on a 1px hairline with the eyebrow sitting 20px
  below it. This rule, not a border or a shadow, is what groups content.
- **Breakpoints** are 640, 768, 1024, 1280, and 1536, and the meaningful one is
  **1024**: below it the navigation collapses to a bar, the hero's media window
  and telemetry chips are replaced by a text-only fact row, and every
  two-column split stacks. Three narrow cutoffs are derived rather than chosen,
  and should not be rounded to a named breakpoint: **448px** is where the hero
  glass control stops shrinking (its 400px maximum plus 24px gutters), **360px**
  is where the English trigger label starts to truncate, and the fact row is
  additionally gated to viewports at least **600px tall**, because on a short
  phone its height pushes the hero's bottom-anchored headline under the floating
  navigation.
- A faint hairline grid overlays light sections (columns at 16.6667%, rows every
  180px, ink at 6%) with a light variant over dark imagery (cream at 7% to 9%).

### Bilingual and RTL layout

The Arabic document is `dir="rtl"` and the entire layout mirrors. Two rules
follow from that:

- **Use logical properties, never physical ones.** Inline-start and inline-end,
  padding-inline, `ps`/`pe`, `text-start`. Physical left/right values do not
  mirror and will strand a component on the wrong edge.
- **Directional utilities and physical values need an explicit locale branch.**
  Gradient directions, rotations, clip insets, and absolutely-positioned offsets
  are physical. Branch on locale and write both values literally.
- **One deliberate exception:** the specular light source on the hero glass does
  not mirror. A light source is physical, not directional, so it should not flip
  with reading order the way a layout does.

## Elevation & Depth

**This system is flat.** Hierarchy comes from colour tiers (cream, tan,
lavender, ink), hairlines, and type weight. Shadows are functional only, never
decorative, and there is no elevation ladder.

- **Media has no shadow at all.** It sits directly on the page surface inside a
  16px radius with a 1px inset hairline of ink at 10%, drawn as a pseudo-element
  because an inset shadow paints underneath an opaque image in a clipped box and
  renders invisible. The white floating card with a soft drop shadow is
  explicitly **not** part of this system; it is the generic look this design was
  built to avoid.
- **Only two things float:** the navigation pill (`0 10px 32px` ink at 12% on
  desktop, `0 2px 20px` at 10% on mobile) and the skip link (`0 8px 24px` at
  28%). Both are fixed overlays, so the shadow is doing separation work, not
  ornament.
- **A film grain covers the entire page** (an SVG noise field, soft-light blend,
  opacity 0.32, animated in 4 steps over 0.6s). It is part of the brand's warmth
  and it also **degrades every contrast pair by roughly 0.3 to 0.5 ratio
  points**, so contrast must be measured from rendered pixels, never computed
  from token values. A pair that pencils out at exactly 4.5 will ship failing.
- **The hero drifts a coral-to-lavender spectrum wash** across its video at
  soft-light 0.5 over 20s, and the dark legibility scrim sits above it so
  headline copy stays crisp.
- **Depth over video is earned by masking, not by lightening.** The hero scrim is
  masked away in a wide, short ellipse behind the glass control to give the blur
  real tonal range to work with. Painting a translucent light patch on top
  instead only raises the black floor and washes the area grey.

### Motion

Motion is a contract in this system, not a flourish. Three easings, and
durations that cluster hard.

- `--ease-expo: cubic-bezier(0.16, 1, 0.3, 1)` for scroll reveals.
- `--ease-premium: cubic-bezier(0.16, 1.08, 0.38, 0.98)` for cards, crossfades,
  and anything that should overshoot slightly.
- `--ease-default: cubic-bezier(0.4, 0, 0.2, 1)` for interface micro-motion.

| Pattern                        | Duration                    |
| :----------------------------- | :-------------------------- |
| Press scale (0.96)             | 120ms                       |
| Button sweep and label lift    | 120ms                       |
| Hover opacity, focus rim       | 200ms                       |
| Chevron rotate                 | 300ms                       |
| Accordion open and close       | 450ms                       |
| Media crossfade                | 600ms                       |
| Word reveal, 45ms per word     | 550ms                       |
| Block reveal, card reveal      | 900ms, 850ms                |
| List stagger, capped at 12 rows| 45ms per row                |
| Hero intro lines               | 1000ms                      |
| Ambient spectrum drift         | 20s, infinite               |

- **Reveals are the page's rhythm.** Blocks rise 26px and fade, cards rise 48px
  and scale from 0.94 off their bottom edge, lists stagger their children from
  one observer on the container, and display headings reveal word by word.
- **Press feedback is universal.** Every interactive element scales to 0.96 on
  press, at 120ms, using the CSS `scale` property so it never collides with a
  `transform`-based sweep.
- **Autoplaying video ignores `prefers-reduced-motion` in CSS.** Ambient video
  must be gated in script, not in a media query. Under reduced motion all
  transition durations collapse to near zero, which also means motion timing
  cannot be measured in a reduced-motion capture.
- **One-shot reveals must never be paused.** Any animation that starts from an
  invisible state (a masked line at translateY(120%), a panel at opacity 0)
  freezes its content permanently hidden if paused, so it is exempted from the
  global animation-pause rule.

## Shapes

The shape language is **soft rectangles, sharply graded**. Radii are small and
purposeful, and the size of a radius encodes what a thing is:

- **16px** is media, and only media. Every photograph and video frame on the
  site carries it.
- **12px** is the hero glass shell and its dropdown panel, with **8px** for the
  solid chip nested inside it. The pairing is concentric on purpose: a 4px inner
  corner inside a 12px outer reads as a square chip rattling in a rounded slot.
- **6px** is the floating navigation pill.
- **4px** is buttons, badges, and the skip link. The signature CTA is a 4px
  rectangle, not a pill.
- **2px** is the smallest interior detail: dropdown rows, focus-ring corners,
  small caption chips.
- **Fully round** is reserved for genuinely circular things (indicator dots,
  avatars). Nothing text-bearing is a pill.

Never mix radii inside one control. Nested surfaces step down by one level, they
do not repeat the parent's value.

**The ladder is inherited, the names are not.** The reference publishes 2px for
small UI, 4px for buttons, 6px for cards, and 16px for images, the same steps and
very nearly the same role mapping used here. Its documented names disagree with
its own compiled ones, though: its published `--radius-lg` is 16px, while the
`--radius-lg` in its shipped stylesheet is 8px and 16px arrives as
`--radius-2xl`. Port the numbers and the roles, never the names.

### Illustration and iconography

**This system currently contains no illustration.** There are no isometric
graphics, no spot illustration, no abstract geometry, and no 3D renders anywhere
on the site. The brand's visual substance today is photography.

Read that as a description of what exists, **not as a prohibition**: the question
of whether MAZJ should have an illustration language is deliberately left open
here. What follows from it is only this: no illustration language has been
established, so there is no existing style to match. If one is introduced it is a
new brand decision, made deliberately and then recorded in this section, rather
than a look inherited from a template or a stock library.

- **Photography** is the primary visual language: real interiors and real
  members of one specific building, shot in warm daylight with a low-saturation,
  warm-neutral grade that agrees with the cream canvas. Rooms read as occupied
  and calm, never as empty architectural showpieces and never as stock
  photography. Aspect ratios are portrait 4:5 for margin media, 3:2 for cards,
  1:1 for the hero window, and 4:3 as the general default.
- **Video** carries the ambient mood: a hero loop, a dune texture in the footer,
  and a small crop looping inside the header button. Loops must be seamless
  (single shot, boomeranged), must carry no burned-in captions or logos, and
  need a poster generated from frame 0 of the same file.
- **Baked-in orange footage is recoloured to the brand coral** by overlaying a
  solid `#FF5A48` at `mix-blend-mode: color` inside an isolated stacking
  context, never by `hue-rotate` (browsers under-rotate saturated orange).
  Because the blend takes lightness from the source, luma is matched first.
  Verify a recolour by hue (about 6 degrees), never by RGB distance.
- **Iconography is almost absent.** Only a chevron, a hamburger, and a "+" that
  rotates 45 degrees to become a close mark. They are small, monochrome, and
  never coral. Do not introduce an icon set; if a concept needs an icon to be
  understood, rewrite the copy.
- **The only mark is the مزج wordmark** (a PNG, recoloured with a CSS mask where
  it must be a specific colour, and a hand-authored stroked SVG where it must
  animate). There is no icon-only symbol, no monogram, and no favicon glyph
  other than the wordmark.
- **Textures instead of graphics.** Where a section needs visual interest
  without a photograph, the system uses the hairline grid overlay or a masked
  dot field in brown at 18% alpha. Both are quiet by design.

**Anti-patterns.** Do not substitute stock photography for the real rooms. Do not
recolour photographs toward the coral. Do not put a photograph behind body copy
without a measured scrim.

## Components

### Buttons and CTAs

The signature CTA is a 4px rectangle, 50px tall with 24px of inline padding, at
14px weight 500. That geometry is inherited verbatim from the reference's
published button spec (height 50px, padding 0 24px, radius 4px, 14px medium), so
it is one of the few places where matching the reference exactly is correct. On hover a solid rectangle sweeps **straight up** from below
(translateY 101% to 0) in 120ms while the label lifts 4px and flips colour. Four
colour variants exist and each is bound to a surface: ink on light, outlined on
light, and indigo on lavender. The outlined variant has no fill and carries a 1px
border of ink at 25% alpha. The sweep colour is always the surface the button
sits on, so the hover state reads as the button inverting into the page.

The header button is the exception and the brand moment: a full-coral 4px
rectangle with a video loop playing behind a permanent 8px backdrop blur. The
loop is **always on**, not hover-gated, and there is no hover state at all. The
blur is what collapses the moving footage into a near-solid coral that breathes.
Its white label sits at 3.08:1 by owner ruling (see Colors).

**The straight sweep is a deliberate divergence, and it is settled.** The
reference ships two sweeps. Its **default** boxed CTA arrives rotated and scaled:
`translateY(200%) rotate(15deg) scale(1.8)` easing to `translateY(0)
rotate(8deg)` over 1000ms, with the duration dropping to 100ms on the way back
out. That is 11 instances across its homepage and brand page, declared three
independent ways (utility classes, a hand-written `transform` shorthand, and its
own documentation). Its **full-width** CTA is the single exception, and its brand
page captions that one, in words, "straight vertical slide". MAZJ straightened
the sweep everywhere and runs it at 120ms instead of 1000ms: crisper, and it does
not throw a rotating rectangle behind Arabic text. Keep it straight.

This was previously recorded as an unresolved contradiction because searching the
reference's compiled CSS for `transform: rotate(` returns nothing. **That search
is the trap, not the answer.** The reference is built on Tailwind v4, which emits
the standalone `rotate:` and `scale:` properties instead of a `transform`
shorthand, so a grep for the shorthand is blind to every rotated element on the
page. Search for `rotate:` and `scale:` as well, and read the markup, not only
the stylesheet.

Buttons are labelled by what happens next ("Book this space", "See all spaces"),
never "Pricing" or "Plans". Primary calls to action route to the site's own
booking pages, never to a chat channel.

### Navigation

Navigation is a white pill floating 22px from the top of the viewport, centred,
57px tall, at 6px radius with a soft shadow. It holds the wordmark, four links
at 14px, a language switch, and the coral button. On phones it becomes a
full-width bar with a disclosure panel. It is fixed and overlays the hero, which
is why every route opener reserves 150px to 190px of top padding.

Interactive controls carry invisible 44px hit pads via pseudo-elements, so their
measured bounding box is routinely 18px to 24px while the real target is 44px.
Never audit tap targets from the element rectangle alone.

### The hero space picker (glass)

The hero's primary control is a 400px by 60px translucent shell at 12px radius,
holding a full-width trigger and a solid 48px ink chip at 8px radius, opening a
portaled dropdown panel at 12px radius with 6px of padding and 2px rows.

It is built on Apple's Liquid Glass model, **not** on the reference's glass, and
this is a signed-off divergence. The reference's field floats over a golden-hour
photograph (backdrop luma about 49, real structure); this one floats over dark,
nearly featureless video (luma about 22, structure deviation about 3). A
blur-led material borrows its appearance from its backdrop, so against a dead
backdrop it borrows nothing: the reference's exact values were shipped here,
measured, and produced a rim luminance spread of 2.7% across its edges, which is
to say a rectangle with a border. For the record, those values are
`rgba(255,255,255,0.05)` behind `blur(6px) saturate(110%)` with a 1px **pure
white** rim at 22% alpha (beige only on focus) at a 12px radius, and the reference
carries no SVG filter and no inset shadow anywhere on its site, so there is no
hidden optical trick left to copy. Generating the optics instead (a masked
gradient specular rim with real falloff, an implied bezel, and refraction insets
confined to a narrow edge band by large negative shadow spreads) took that
spread to about 56%.

Two consequences worth stating as rules. The tint **tracks its dark backdrop and
stays near-black**: lightening the fill to force visibility is a documented
anti-pattern and reads as milky plastic. And the rim, not the blur, carries the
effect. Also: the primary control is always solid and always actionable. A
dimmed or disabled state on it dropped its internal contrast to 2.90:1 and made
the entire control read as broken.

Hand-written `backdrop-filter` declarations must put the `-webkit-` prefixed
property **first** and the standard property **last**. Reversed, the build's CSS
minifier collapses the pair and ships only the prefixed form, which current
Chrome no longer recognises, and the blur dies silently in every browser. Verify
in the served stylesheet, not the source.

### Media and cards

There is exactly **one** media container in this system: a 16px-radius frame
with a 1px inset hairline, sitting directly on the page. Every image and video
on every route goes through it. There is no card wrapper, no white background,
and no drop shadow.

A "card" here is therefore not a box, it is a stack: framed media, then a
hairline, then an eyebrow, a 20px title, a line of body copy, and a button
pinned to the bottom of the column. The hairline does the containment that a
border and a shadow would do elsewhere.

Never wrap copy-driven text in a fixed height with clipped overflow. Copy grows
(especially in translation) and it will clip silently from the bottom with no
tell. Use a growable floor instead, and match the viewport unit of the padding
to the unit of the box.

### Sections, labels and rules

The section is the real unit of this design. Each one is a full-bleed band of a
single surface colour, containing a lane, opening on a hairline with an eyebrow,
and building to one statement. Adjacent sections alternate surface (cream, tan,
lavender, ink) so the page reads as chapters rather than a scroll.

Two-tone headlines are a signature: the closing phrase of a display heading
takes the coral while the rest stays ink or cream. Use it once per screen at
most.

Accordions are built with a checkbox and a label and animate from `0fr` to `1fr`
grid rows, so they need no script and server-render correctly. A collapsed
answer must also be hidden from assistive technology, since a zero-height row
stays in the accessibility tree.

### Variants and states

Every interactive component ships five states, and three of them are usually
forgotten:

- **Default** and **hover** as described above. Hover effects are gated to
  pointer devices.
- **Press:** scale 0.96 at 120ms, on everything. When a component is not the
  shared button class, its own transition list must name `transform`, because a
  `scale-[…]` utility compiles to `transform` and a transition watching `scale`
  will animate nothing and snap.
- **Focus-visible:** mandatory and never removed. Rings are 2px, offset 3px,
  indigo at 60% on light surfaces and cream at 55% to 75% on glass and dark
  surfaces. Focus offset goes negative inside tightly padded containers so the
  ring does not clip. A hover wash is not a focus state: a 10% white fill
  measures 1.29:1 against its panel, against the 3:1 that is required.
- **Disabled:** avoid it on primary controls. Prefer making the control do
  something useful (opening the picker) over dimming it.

## Do's and Don'ts

- **Do** keep the coral at exactly `#FF5A48`, including its lightness. **Don't**
  darken it, scrim it, or swap it for a darker variant to satisfy a contrast
  audit; the four sub-AA coral spots are a settled owner ruling, and any real
  fix must come from the brand owner.
- **Do** confirm a `text-*` size exists in the closed type scale before using
  it. **Don't** invent an in-between step: an undefined size applies nothing and
  the element silently inherits 16px body size.
- **Do** mirror every layout with logical properties, and branch on locale for
  gradients, rotations, and absolute offsets. **Don't** ship a physical
  left/right value and assume the Arabic build is fine.
- **Do** check Arabic first for clipping and leading after any type change, and
  give Arabic display text in a non-heading tag explicit 1.35 leading.
  **Don't** assume the heading leading rule covers a `span` or a `p`.
- **Do** put media in the one 16px frame with its inset hairline. **Don't**
  reintroduce a white card with a drop shadow, which is the generic look this
  system exists to avoid.
- **Do** measure contrast from rendered pixels, sampling at least twelve frames
  when text sits over video. **Don't** compute a ratio from token values: the
  page-wide film grain costs 0.3 to 0.5 ratio points, and `text-shadow` earns no
  WCAG credit while a background plate does.
- **Do** express hairline borders, asymmetric button padding, box shadows, and
  motion timings as CSS rules. **Don't** try to encode them as component tokens:
  this format's component properties are a closed set of eight, and
  `borderColor`, `paddingX`, and `boxShadow` are not among them.
- **Do** keep one typeface, four weights, and weight-based hierarchy.
  **Don't** add a display face, a monospace, or a second accent hue; the mono
  alias in the theme config resolves to the same sans face and is vestigial.
- **Do** give every control a visible focus ring and a 44px hit target.
  **Don't** replace a focus ring with a hover wash, and don't audit target size
  from the element's own rectangle when a pseudo-element carries the hit pad.
- **Do** let sections breathe at 96px to 128px and let statements stay short.
  **Don't** fill empty space with ornament or an icon set; emptiness is the
  brand's calm.
