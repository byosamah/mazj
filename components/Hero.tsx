"use client";

import {useEffect, useId, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useLocale, useTranslations} from "next-intl";
import {BOOKING} from "@/lib/links";
import LogoLoop from "./LogoLoop";
import {useIsDesktop} from "./useMediaQuery";

/**
 * The panel MUST be positioned before its first paint: `.sf-panel` is
 * `position:absolute` with no top/left of its own, so an unpositioned frame
 * drops it at the bottom of <body>. That needs a LAYOUT effect, which warns
 * when a client component is server-rendered. Standard isomorphic guard: the
 * identity is decided once per environment, so the hook order is stable.
 */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// Portaled-panel geometry, in px.
const PANEL_GAP = 10; // breathing room between the pill and the panel
const PANEL_EDGE = 12; // never let the panel touch the viewport edge
const PANEL_MIN_H = 140; // floor: below this we stop clamping and just scroll

/**
 * The six real MAZJ spaces (mazj.sa), ordered as the dropdown lists them.
 * `id` keys the localized label/name under the SpaceFinder namespace.
 * `href` opens that space's booking page on mazj.sa (external, new tab).
 * `img` is the photo that crossfades into the hero window when picked.
 * These are config, not display copy — the visible strings come from i18n.
 */
const FACILITIES = [
  {id: "dayDesk", href: BOOKING.sharedSeat, img: "/images/spaces/day-desk.jpg"},
  {id: "meeting", href: BOOKING.meeting, img: "/images/spaces/meeting.jpg"},
  {id: "event", href: BOOKING.event, img: "/images/spaces/event.jpg"},
  {id: "officeDay", href: BOOKING.privateOffice, img: "/images/spaces/office-day.jpg"},
  {id: "officeMonth", href: BOOKING.privateOffice, img: "/images/spaces/office-month.jpg"},
  {id: "membership", href: BOOKING.sharedSeat, img: "/images/spaces/membership.jpg"},
] as const;

// 1×1 transparent gif — the crossfade buffers start empty so the orange video
// shows through until a space is chosen, and each new photo can fade in.
const TRANSPARENT =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// Small line-icons that accent the three floating feature chips. Stroke uses
// currentColor so each inherits the chip's beige label tone.
const iconProps = {
  width: 12,
  height: 12,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const IconPerson = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
  </svg>
);
const IconCheck = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.3 12.4l2.4 2.4 4.9-5.2" />
  </svg>
);
const IconClock = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.2v5.1l3.4 2" />
  </svg>
);
// Map pin, same line-icon language as the trio above (24 viewBox, currentColor,
// round caps). Used on the capacity chip ONLY in the default state, where it
// reads "Location / Al Khobar"; once a space is picked that chip becomes a
// capacity ("Fits / Up to 30") and IconPerson takes over.
const IconPin = () => (
  <svg {...iconProps}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

export default function Hero() {
  const t = useTranslations("Hero");
  const tf = useTranslations("SpaceFinder");
  const rtl = useLocale() === "ar";
  // False on the server and on the first hydrating render — see useMediaQuery.
  // Used ONLY to skip fetching desktop-only media, never to gate layout.
  const isDesktop = useIsDesktop();
  // The media window is a SQUARE anchored center-end (right in LTR, mirrored to
  // left in RTL) via logical properties in globals.css (.sf-stage / .sf-frame).
  // The floating telemetry chips anchor to its edges so they track it at any size.

  // Dropdown + selection state
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // The open panel is portaled to <body> (see the positioning effect) so it can
  // drop DOWNWARD and spill past the hero's own overflow-clip, painting over the
  // cream section below. panelRef lets the outside-click handler recognize a
  // click that landed inside the (now-detached) panel.
  const panelRef = useRef<HTMLUListElement>(null);
  // Whichever control opened the picker — the trigger, or the CTA. Escape must
  // hand focus back to what the user actually pressed, not always the trigger.
  const ctaRef = useRef<HTMLButtonElement>(null);
  const invokerRef = useRef<HTMLButtonElement | null>(null);

  // Stable ids: the listbox needs one so both controls that open it can point
  // at it, and every option needs one so the listbox exposes a real collection.
  const uid = useId();
  const listboxId = `${uid}-spaces`;
  const optionId = (i: number) => `${uid}-space-${i}`;

  // Two crossfade buffers ping-pong so switching spaces dissolves cleanly.
  const [activeA, setActiveA] = useState(true);
  const [bufA, setBufA] = useState(TRANSPARENT);
  const [bufB, setBufB] = useState(TRANSPARENT);

  const choose = (i: number) => {
    const img = FACILITIES[i].img;
    // Paint the new photo onto the *inactive* buffer, then flip to it.
    if (activeA) setBufB(img);
    else setBufA(img);
    setActiveA((prev) => !prev);
    setSelected(i);
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Close on outside-click or Escape while open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // Panel is portaled outside rootRef, so a click inside it must NOT close.
      const insideRoot = rootRef.current?.contains(target);
      const insidePanel = panelRef.current?.contains(target);
      if (!insideRoot && !insidePanel) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        // Back to whatever opened it (trigger OR cta), not always the trigger.
        (invokerRef.current ?? triggerRef.current)?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Position the portaled panel against the pill, in page coordinates, and keep
  // it there on scroll/resize. Measuring rootRef (the pill wrapper) aligns and
  // sizes the panel to the pill automatically, in both LTR and RTL.
  //
  // Written STRAIGHT TO THE NODE, with no React state anywhere in the path:
  //   - the old effect called setPanelPos(null) synchronously on close, which
  //     was this repo's one standing react-hooks/set-state-in-effect error. The
  //     null was never really state: "closed" already means "no panel", so the
  //     panel simply does not render rather than storing a null position.
  //   - and its listener was registered with capture:true and un-throttled, so
  //     every raw scroll event ran getBoundingClientRect + setState. Under Lenis
  //     that is a full re-render of the hero per tick. A rAF-coalesced style
  //     write does the same job at zero render cost.
  useIsoLayoutEffect(() => {
    if (!open) return;
    let frame = 0;

    const place = () => {
      frame = 0;
      const el = panelRef.current;
      const pill = rootRef.current?.getBoundingClientRect();
      if (!el || !pill) return;

      // Preserve the panel's own scroll across the re-measure: clearing
      // maxHeight below momentarily makes the content fit, which clamps
      // scrollTop back to 0. On short viewports (the clamped overflowY:auto
      // state) that froze the panel's scroll dead — every scroll snapped back
      // within a frame and options 5-6 were unreachable at 320x568.
      const scrolled = el.scrollTop;

      // Measure unclamped, or each tick would re-measure the previous clamp.
      el.style.maxHeight = "";
      const natural = el.offsetHeight;

      const below = window.innerHeight - pill.bottom - PANEL_GAP - PANEL_EDGE;
      const above = pill.top - PANEL_GAP - PANEL_EDGE;
      // Open downward by default, flip up only when the panel does not fit
      // below AND there is genuinely more room above. On a phone the pill sits
      // low in the hero, so the 293px panel opened 223px BELOW THE FOLD and
      // showed exactly one of its six options with nothing hinting at the rest.
      const flip = natural > below && above > below;
      const room = Math.max(flip ? above : below, PANEL_MIN_H);
      const height = Math.min(natural, room);

      el.style.width = `${pill.width}px`;
      el.style.left = `${pill.left + window.scrollX}px`;
      const top = flip
        ? Math.max(PANEL_EDGE, pill.top - PANEL_GAP - height)
        : pill.bottom + PANEL_GAP;
      el.style.top = `${top + window.scrollY}px`;
      // .sf-panel ships overflow:hidden with no max-height (globals.css), so
      // when neither side can hold all six options the scroller has to be
      // switched on from here. overflow-x stays hidden, which is legal.
      el.style.maxHeight = `${height}px`;
      el.style.overflowY = natural > height ? "auto" : "";
      if (scrolled) el.scrollTop = scrolled;
    };

    const schedule = (e?: Event) => {
      // The window listener below is capture-phase, so it also hears the
      // panel's OWN overflow scroll. The pill has not moved in that case, and
      // re-placing on it is what wiped the panel's scroll position (see the
      // note in place()). Only page-level scrolls reposition the panel.
      if (e && e.target instanceof Node && panelRef.current?.contains(e.target)) return;
      if (!frame) frame = requestAnimationFrame(place);
    };

    place();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [open]);

  // Move focus into the panel once it has actually MOUNTED.
  //
  // 🔴 This gate must stay a BOOLEAN. It used to read `open && panelPos !== null`
  // because the panel did not render until a position had been measured, which
  // landed a render AFTER `open` flipped — so keying it on `open` alone was a
  // silent no-op that focused nothing and stranded keyboard users on the
  // invoking control. Positioning is imperative now, so the panel mounts in the
  // SAME commit that flips `open` and the option refs are already attached when
  // this runs, which makes `open` the correct (and still boolean) gate.
  // Never depend on a per-tick object here — the old panelPos was a fresh object
  // on every scroll, which would yank focus back into the list on every scroll.
  useEffect(() => {
    if (!open) return;
    const idx = selected ?? 0;
    const raf = requestAnimationFrame(() => optionRefs.current[idx]?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, selected]);

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      invokerRef.current = triggerRef.current;
      setOpen(true);
    }
  };

  const onOptionKey = (e: React.KeyboardEvent, i: number) => {
    const last = FACILITIES.length - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      optionRefs.current[i === last ? 0 : i + 1]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      optionRefs.current[i === 0 ? last : i - 1]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      optionRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      optionRefs.current[last]?.focus();
    }
  };

  const triggerLabel = selected == null ? tf("trigger") : tf(`cases.${FACILITIES[selected].id}.label`);

  // Feature-chip content follows the selection: each facility's real features
  // from mazj.sa, or a brand-level default before anything is picked.
  const chipBase = selected == null ? "chipsDefault" : `cases.${FACILITIES[selected].id}.chips`;

  // CTA label shortens on narrow screens so the trigger keeps enough room for
  // the full question. Without it "What brings you in?" truncated to "What
  // brings you ..." at 390px — the pill gives the trigger ~124px of text room
  // there against the ~150px the string needs.
  //
  // 448px is derived, not picked: the pill is w-full max-w-[400px] inside a
  // px-6 column, so 400 + 24 + 24 is exactly where it stops shrinking. At or
  // above that its geometry equals desktop, so the long label provably fits.
  // (The reference does the same thing via a ::before content swap; we can't,
  // because our labels are translated — hence two spans, both class names
  // written literally so the JIT emits them.)
  const ctaLabel = (
    <>
      <span className="min-[448px]:hidden">{tf("ctaShort")}</span>
      <span className="hidden min-[448px]:inline">{tf("cta")}</span>
    </>
  );

  // The 640px floor is CAPPED BY THE VIEWPORT. A bare min-h-[640px] beat the
  // 390px height of a landscape phone, so the hero rendered 640px tall inside a
  // 390px window: content is absolutely positioned to inset-0 and pushed with
  // justify-end, which put the CTA pill 170px BELOW THE FOLD at 844x390 (146px
  // at 896x414). A landscape visitor saw the headline and no call to action at
  // all. min() can never exceed the real viewport, and at every portrait or
  // desktop size it still resolves to exactly the same 640px as before.
  return (
    <section className="relative h-svh min-h-[min(640px,100svh)] w-full overflow-clip bg-black">
      {/* Base background — looping MAZJ hero video (self-hosted, no controls).
          The autumn photo is the poster shown until the first frame loads. */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-black">
        {/* preload="metadata": this is the LCP-adjacent element on desktop so it
            is not starved outright, but it is a ~13 MB file and `metadata` stops
            the browser pulling all of it before the headline has painted.
            aria-hidden because it is pure decoration: without it some screen
            readers announce a bare, unlabelled media element. */}
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          preload="metadata"
          poster="/images/hero-bg.jpg"
          src="/videos/mazj-hero.mp4"
        />
        {/* Coral -> lavender spectrum wash (Daylight motif, MAZJ hues): tints the
            video but sits UNDER the scrim below, so headline copy stays legible. */}
        <div className="sf-spectrum" aria-hidden="true" />
        {/* Scrim: darkest under the hero copy, fading toward the media window.
            Direction is locale-aware — dark-on-left for LTR, dark-on-right for
            RTL — so it always sits behind the text, which flips sides in Arabic.
            Both class names are literal so Tailwind's JIT emits them. */}
        <div
          className={`hero-scrim absolute inset-0 from-black/75 via-black/45 to-black/20 ${
            rtl ? "bg-gradient-to-l" : "bg-gradient-to-r"
          }`}
        />
      </div>

      {/* Square media window (desktop only). Default: the orange solar-panel
          video recolored to brand coral. On select: the chosen space's photo
          covers the square edge-to-edge. Floating chips anchor to its edges. */}
      <div className="sf-stage pointer-events-none absolute z-[1] hidden text-beige lg:block">
        <div
          data-fx="clip-hero"
          className="sf-frame isolate"
          style={{clipPath: "inset(0% round 16px)"}}
        >
          {/* Poster layer. The still is painted through a CSS background rather
              than the <video>'s own `poster`, and that is the whole byte saving:
              a background-image inside a display:none subtree is NEVER fetched,
              and .sf-stage is display:none below lg. It carries the identical
              brightness(0.78) as the video, so the handoff is seamless. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center [filter:brightness(0.78)]"
            style={{backgroundImage: "url('/images/hero-video.jpg')"}}
          />

          {/* 🔴 RENDERED, not just hidden. `hidden lg:block` on .sf-stage is a
              paint concern, not a fetch concern: hero.mp4 (356 KB) and its
              poster (21 KB) were still downloading at a 390px viewport where
              they draw zero pixels — 656 KB of desktop-only media on every
              mobile load, measured. Only not rendering the element stops the
              request. useIsDesktop() is false on the server and on the first
              hydrating render, so desktop mounts this one paint after
              hydration; the poster div above is already painting by then, at
              the same brightness, so there is nothing to see and nothing to
              shift (.sf-stage is absolutely positioned either way).
              preload="none" keeps it from racing the background video. */}
          {isDesktop && (
            <video
              className="absolute inset-0 h-full w-full object-cover [filter:brightness(0.78)]"
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
              preload="none"
              poster="/images/hero-video.jpg"
              src="/videos/hero.mp4"
            />
          )}

          {/* Recolor the orange solar-panel video to the exact brand coral (the
              `orange` token, #FF5A48) via a mix-blend-mode:color overlay (same
              technique as the footer dune). `isolate` scopes the blend.
              It sits above the video but BELOW the crossfade photos, so only the
              default panel is tinted — never a chosen space photo.
              The video carries brightness(0.78) because blend:color keeps the
              video's own luminosity: this panel's source is brighter than the
              footer dune, so without the dim it read as a pale salmon (~68% luma)
              instead of the deep brand coral (~54%) the button + footer land on. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-orange mix-blend-color" />

          {/* The مزج mark writes itself over the coral panel until a space is
              chosen, then fades out for good (chosen photos also cover it).
              Sits after the blend overlay so the beige strokes stay beige. */}
          <LogoLoop dismissed={selected != null} />

          {/* crossfade photo buffers — each photo covers the square, centered */}
          {([bufA, bufB] as const).map((buf, idx) => (
            <div
              key={idx}
              className="sf-slide"
              aria-hidden="true"
              style={{opacity: (idx === 0 ? activeA : !activeA) ? 1 : 0}}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="sf-slide-img" alt="" src={buf} />
            </div>
          ))}

          {/* space-name caption chip (bottom-start of the window) */}
          <div className="eyebrow sf-caption text-12" data-show={selected != null}>
            {selected != null ? tf(`cases.${FACILITIES[selected].id}.name`) : ""}
          </div>
        </div>

        {/* Floating feature chips anchored to the window edges. Their copy is
            driven by `chipBase`, so the trio always reflects the selected
            facility's real features (capacity · amenity · access) from mazj.sa,
            with a brand-level default before a space is chosen. */}
        <div data-fx="chip" className="sf-chip sf-chip-tl">
          <p className="eyebrow flex items-center gap-1.5 text-12 text-beige/80">
            <IconCheck />
            <span>{tf(`${chipBase}.feature.label`)}</span>
          </p>
          <p className="eyebrow mt-0.5 text-12 font-medium tabular-nums">{tf(`${chipBase}.feature.value`)}</p>
        </div>
        <div data-fx="chip" className="sf-chip sf-chip-bl">
          <p className="eyebrow flex items-center gap-1.5 text-12 text-beige/80">
            <IconClock />
            <span>{tf(`${chipBase}.access.label`)}</span>
          </p>
          <p className="eyebrow mt-0.5 text-12 font-medium tabular-nums">{tf(`${chipBase}.access.value`)}</p>
        </div>
        <div data-fx="chip" className="sf-chip sf-chip-r">
          <p className="eyebrow flex items-center gap-1.5 text-12 text-beige/80">
            {/* Location pin for the default "Location / Al Khobar"; person for a
                selected space's capacity ("Fits / Up to 30"). */}
            {selected == null ? <IconPin /> : <IconPerson />}
            <span>{tf(`${chipBase}.capacity.label`)}</span>
          </p>
          <p className="eyebrow mt-0.5 text-12 font-medium tabular-nums">{tf(`${chipBase}.capacity.value`)}</p>
        </div>
      </div>

      {/* Content */}
      <div className="absolute inset-0 z-[3] flex flex-col justify-end pb-20 lg:justify-center lg:pb-0">
        <div className="w-full px-6 lg:ps-[4.2%] lg:pe-16">
          {/* The 62% column opens at xl (1280), NOT at lg (1024).
              At lg it let the headline reach INTO the media square in English:
              the column is 62% of the padded row, which crosses 598px at about
              1073px of viewport — exactly the width where "good company." stops
              wrapping and sets as one 598px line. Measured ink-to-square gap,
              scanned at 2px: +189.1 at vw1072 (3 lines), then -23.4 at vw1074
              (2 lines, the worst point), -18.4 at 1080, -1.4 at 1100, +0.3 at
              1102. The coral period landed ON the coral square and vanished,
              and the gap stayed under 45px all the way to ~1152 even where it
              did not literally collide. Holding the mobile 560px cap through
              the whole lg band keeps "good company." wrapped there, which is
              already how it sets at 1072 and below, so nothing new is invented.
              At 1280+ this resolves to the identical 62% and the composition
              that is currently correct (gap +151 at 1280) is untouched.
              Arabic never collided (min +44.5 at 1024) and only narrows here,
              so its gap can only improve. Font size is NOT reduced. */}
          <div className="flex max-w-[560px] flex-col xl:max-w-[62%]">
            {/* Eyebrow */}
            <span className="intro-mask mb-4 lg:mb-6">
              <span
                className="eyebrow intro-line block text-12 text-beige/90"
                style={{["--delay" as any]: "40ms"}}
              >
                {t("eyebrow")}
              </span>
            </span>

            <h1 className="font-sans font-black text-40 leading-[1.02] text-beige lg:text-85 lg:leading-[0.98] lg:tracking-[-1.7px]">
              <span className="intro-mask">
                <span className="intro-line" style={{["--delay" as any]: "120ms"}}>
                  {t("titleLine1")}
                </span>
              </span>
              <span className="intro-mask">
                <span className="intro-line text-orange" style={{["--delay" as any]: "220ms"}}>
                  {t("titleLine2")}
                </span>
              </span>
            </h1>

            <p
              className="intro-fade mt-5 max-w-[453px] text-15 font-normal text-beige lg:mt-6 lg:text-16 text-pretty"
              style={{["--delay" as any]: "460ms", letterSpacing: "-0.02em"}}
            >
              {t("subtitle")}
            </p>

            {/* Space finder — the dropdown of facility "cases" + a button that
                opens the chosen space's page on mazj.sa. Replaces the old email
                pill; keeps the exact glass-pill footprint. */}
            <div
              ref={rootRef}
              className="intro-fade relative mt-8 w-full max-w-[400px] lg:mt-10"
              style={{["--delay" as any]: "620ms"}}
            >
              <div className="qualify-pill">
                <button
                  ref={triggerRef}
                  type="button"
                  className="sf-trigger font-sans"
                  aria-haspopup="listbox"
                  aria-expanded={open}
                  aria-controls={open ? listboxId : undefined}
                  data-placeholder={selected == null}
                  onClick={() => {
                    invokerRef.current = triggerRef.current;
                    setOpen((o) => !o);
                  }}
                  onKeyDown={onTriggerKey}
                >
                  <span className="min-w-0 flex-1 truncate text-start">{triggerLabel}</span>
                  <svg className="sf-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {selected == null ? (
                  // Before a space is chosen the CTA stays FULLY SOLID and opens
                  // the picker, rather than sitting there dimmed. The old
                  // `sf-cta-disabled` (opacity .45) dropped the button's internal
                  // contrast to 2.90x against the reference's 14.53x, which read
                  // as a broken chip and flattened the whole glass control — it
                  // was the single biggest visual gap, far more than the glass.
                  // The reference's button is never dimmed either, because a
                  // dead-looking half is worse than guiding the click onward.
                  <button
                    ref={ctaRef}
                    type="button"
                    className="qualify-pill-btn font-sans"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-controls={open ? listboxId : undefined}
                    onClick={() => {
                      invokerRef.current = ctaRef.current;
                      setOpen(true);
                    }}
                  >
                    <span className="qualify-pill-btn-overlay" aria-hidden="true" />
                    <span className="qualify-pill-btn-label">
                      {ctaLabel}
                    </span>
                  </button>
                ) : (
                  <a
                    href={FACILITIES[selected].href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="qualify-pill-btn font-sans"
                  >
                    <span className="qualify-pill-btn-overlay" aria-hidden="true" />
                    <span className="qualify-pill-btn-label">
                      {ctaLabel}
                    </span>
                  </a>
                )}
              </div>

              {/* Mobile parity for the desktop telemetry chips. Below lg the
                  whole .sf-stage (photo window + the three facility-fact chips)
                  is hidden, so a phone visitor who picked a space got no
                  feedback beyond the trigger label before the CTA handed them
                  to mazj.sa. This row reuses the chips' exact i18n keys
                  (capacity / feature / access from the SpaceFinder namespace),
                  so it costs no new copy and no media bytes — the deliberate
                  656KB fetch-weight decision on .sf-stage stays intact. Only
                  rendered after a selection, so the default hero is unchanged.
                  Same over-video text-shadow idiom as the desktop chips' band.
                  Display is gated by .sf-facts (globals.css), NOT lg:hidden:
                  besides hiding at lg+ (desktop chips take over) it also hides
                  below 600px of viewport HEIGHT — in the bottom-anchored hero
                  column at 320x568 the row's ~88px pushed the headline's first
                  line up under the floating nav pill (h1 top 163.6 -> 55.6 vs
                  nav bottom ~90, measured). Short viewports keep the clean
                  pre-row geometry; 390x844-class phones show the facts. */}
              {selected != null && (
                <div className="sf-facts mt-5 flex-wrap gap-x-7 gap-y-3 text-beige [text-shadow:0_1px_10px_rgba(0,0,0,0.8)]">
                  {(["capacity", "feature", "access"] as const).map((k) => (
                    <p key={k} className="eyebrow text-12">
                      <span className="block text-beige/70">{tf(`${chipBase}.${k}.label`)}</span>
                      <span className="mt-0.5 block font-medium tabular-nums">{tf(`${chipBase}.${k}.value`)}</span>
                    </p>
                  ))}
                </div>
              )}

              {open &&
                createPortal(
                  <ul
                    ref={panelRef}
                    id={listboxId}
                    className="sf-panel"
                    role="listbox"
                    aria-label={tf("trigger")}
                    dir={rtl ? "rtl" : "ltr"}
                  >
                    {/* 🔴 ONE element carries the option semantics, and it is the
                        one that takes focus. role="option" + aria-selected used
                        to sit on the <li> while the focusable <button> lived
                        inside it, which ARIA forbids (an option may not have
                        interactive descendants) and which measurably broke the
                        announcement: focus landed on button.sf-option, so the AT
                        read "button" and lost BOTH the selection state and the
                        position in set ("option 2 of 6"). `option` is an allowed
                        role for <button>, so Enter/Space keep activating
                        natively and the roving-focus model below is untouched.
                        The <li> is presentational, which promotes the buttons to
                        direct children of the listbox and restores "n of 6". */}
                    {FACILITIES.map((f, i) => (
                      <li key={f.id} role="presentation">
                        <button
                          ref={(el) => {
                            optionRefs.current[i] = el;
                          }}
                          id={optionId(i)}
                          type="button"
                          role="option"
                          aria-selected={selected === i}
                          className="sf-option font-sans"
                          data-active={selected === i}
                          onClick={() => choose(i)}
                          onKeyDown={(e) => onOptionKey(e, i)}
                        >
                          <span className="sf-option-mark" aria-hidden="true">
                            ›
                          </span>
                          <span>{tf(`cases.${f.id}.label`)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>,
                  document.body
                )}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
