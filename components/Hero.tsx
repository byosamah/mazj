"use client";

import {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useLocale, useTranslations} from "next-intl";
import {BOOKING} from "@/lib/links";
import {waLink} from "@/lib/contact";

/**
 * The six real MAZJ spaces (mazj.sa), ordered as the dropdown lists them.
 * `id` keys the localized label/name under the SpaceFinder namespace.
 * `href` opens that space's booking page on mazj.sa (external, new tab).
 * `img` is the photo that crossfades into the hero window when picked.
 * These are config, not display copy — the visible strings come from i18n.
 */
const FACILITIES = [
  {id: "dayDesk", href: BOOKING.dayDesk, img: "/images/spaces/day-desk.jpg"},
  {id: "meeting", href: BOOKING.meeting, img: "/images/spaces/meeting.jpg"},
  {id: "event", href: BOOKING.event, img: "/images/spaces/event.jpg"},
  {id: "officeDay", href: BOOKING.officeDay, img: "/images/spaces/office-day.jpg"},
  {id: "officeMonth", href: BOOKING.officeMonth, img: "/images/spaces/office-month.jpg"},
  {id: "membership", href: BOOKING.membership, img: "/images/spaces/membership.jpg"},
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

export default function Hero() {
  const t = useTranslations("Hero");
  const tf = useTranslations("SpaceFinder");
  const tc = useTranslations("Cta");
  const rtl = useLocale() === "ar";
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
  const [panelPos, setPanelPos] = useState<{top: number; left: number; width: number} | null>(null);

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
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Position the portaled panel just below the pill, in page coordinates, and
  // keep it there on scroll/resize. Measuring rootRef (the pill wrapper) aligns
  // and sizes the panel to the pill automatically, in both LTR and RTL.
  useEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      setPanelPos({
        top: r.bottom + window.scrollY + 10,
        left: r.left + window.scrollX,
        width: r.width,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) {
      const idx = selected ?? 0;
      requestAnimationFrame(() => optionRefs.current[idx]?.focus());
    }
  }, [open, selected]);

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
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

  return (
    <section className="relative h-svh min-h-[640px] w-full overflow-clip bg-black">
      {/* Base background — looping MAZJ hero video (self-hosted, no controls).
          The autumn photo is the poster shown until the first frame loads. */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-black">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
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
          className={`absolute inset-0 from-black/75 via-black/45 to-black/20 ${
            rtl ? "bg-gradient-to-l" : "bg-gradient-to-r"
          }`}
        />
      </div>

      {/* Square media window (desktop only). Default: the orange solar-panel
          video recolored to brand coral. On select: the chosen space's photo
          covers the square edge-to-edge. Floating chips anchor to its edges. */}
      <div className="sf-stage pointer-events-none absolute z-[1] hidden font-mono text-beige lg:block">
        <div
          data-fx="clip-hero"
          className="sf-frame isolate"
          style={{clipPath: "inset(0% round 16px)"}}
        >
          <video
            className="absolute inset-0 h-full w-full object-cover [filter:brightness(0.78)]"
            autoPlay
            muted
            loop
            playsInline
            poster="/images/hero-video.jpg"
            src="/videos/hero.mp4"
          />

          {/* Recolor the orange solar-panel video to the exact brand coral
              (#FF5A48) via a mix-blend-mode:color overlay (same technique as the
              footer dune). `isolate` on the frame scopes the blend to the video.
              It sits above the video but BELOW the crossfade photos, so only the
              default panel is tinted — never a chosen space photo.
              The video carries brightness(0.78) because blend:color keeps the
              video's own luminosity: this panel's source is brighter than the
              footer dune, so without the dim it read as a pale salmon (~68% luma)
              instead of the deep brand coral (~54%) the button + footer land on. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#FF5A48] mix-blend-color" />

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
          <div className="sf-caption font-mono text-12 uppercase tracking-[0.05em]" data-show={selected != null}>
            {selected != null ? tf(`cases.${FACILITIES[selected].id}.name`) : ""}
          </div>
        </div>

        {/* Floating feature chips anchored to the window edges. Their copy is
            driven by `chipBase`, so the trio always reflects the selected
            facility's real features (capacity · amenity · access) from mazj.sa,
            with a brand-level default before a space is chosen. */}
        <div data-fx="chip" className="sf-chip sf-chip-tl">
          <p className="flex items-center gap-1.5 text-12 uppercase tracking-[0.05em] text-beige/80">
            <IconCheck />
            <span>{tf(`${chipBase}.feature.label`)}</span>
          </p>
          <p className="mt-0.5 text-12 font-medium uppercase tracking-[0.05em]">{tf(`${chipBase}.feature.value`)}</p>
        </div>
        <div data-fx="chip" className="sf-chip sf-chip-bl">
          <p className="flex items-center gap-1.5 text-12 uppercase tracking-[0.05em] text-beige/80">
            <IconClock />
            <span>{tf(`${chipBase}.access.label`)}</span>
          </p>
          <p className="mt-0.5 text-12 font-medium uppercase tracking-[0.05em]">{tf(`${chipBase}.access.value`)}</p>
        </div>
        <div data-fx="chip" className="sf-chip sf-chip-r">
          <p className="flex items-center gap-1.5 text-12 uppercase tracking-[0.05em] text-beige/80">
            <IconPerson />
            <span>{tf(`${chipBase}.capacity.label`)}</span>
          </p>
          <p className="mt-0.5 text-12 font-medium uppercase tracking-[0.05em]">{tf(`${chipBase}.capacity.value`)}</p>
        </div>
      </div>

      {/* Content */}
      <div className="absolute inset-0 z-[3] flex flex-col justify-end pb-20 lg:justify-center lg:pb-0">
        <div className="w-full px-6 lg:ps-[4.2%] lg:pe-16">
          <div className="flex max-w-[560px] flex-col lg:max-w-[62%]">
            {/* Eyebrow */}
            <span className="intro-mask mb-4 lg:mb-6">
              <span
                className="intro-line block font-mono text-12 uppercase tracking-[0.05em] text-beige/90"
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
              className="intro-fade mt-5 max-w-[453px] text-15 font-normal text-beige lg:mt-6 lg:text-16"
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
                  data-placeholder={selected == null}
                  onClick={() => setOpen((o) => !o)}
                  onKeyDown={onTriggerKey}
                >
                  <span className="min-w-0 flex-1 truncate text-start">{triggerLabel}</span>
                  <svg className="sf-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {selected == null ? (
                  <span className="qualify-pill-btn sf-cta-disabled" aria-disabled="true">
                    <span className="qualify-pill-btn-label">
                      {tf("cta")}
                    </span>
                  </span>
                ) : (
                  <a
                    href={FACILITIES[selected].href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="qualify-pill-btn font-sans"
                  >
                    <span className="qualify-pill-btn-overlay" aria-hidden="true" />
                    <span className="qualify-pill-btn-label">
                      {tf("cta")}
                    </span>
                  </a>
                )}
              </div>

              {open &&
                panelPos &&
                createPortal(
                  <ul
                    ref={panelRef}
                    className="sf-panel"
                    role="listbox"
                    aria-label={tf("trigger")}
                    dir={rtl ? "rtl" : "ltr"}
                    style={{top: panelPos.top, left: panelPos.left, width: panelPos.width}}
                  >
                    {FACILITIES.map((f, i) => (
                      <li key={f.id} role="option" aria-selected={selected === i}>
                        <button
                          ref={(el) => {
                            optionRefs.current[i] = el;
                          }}
                          type="button"
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

            {/* Always-live action so a visitor who hasn't picked a space still
                has a way to reach a human. Brand coral, opens WhatsApp. */}
            <a
              href={waLink(tc("bookTourMsg"))}
              target="_blank"
              rel="noopener noreferrer"
              className="intro-fade mt-5 inline-flex h-[50px] w-full max-w-[400px] items-center justify-center rounded-[4px] bg-orange px-[22px] text-15 font-medium text-white transition-opacity duration-200 hover:opacity-90 lg:h-[45px] lg:w-fit lg:max-w-none"
              style={{["--delay" as any]: "700ms"}}
            >
              {tc("bookTour")}
            </a>

            {/* Trust line — address · access. Same mono micro-type as
                the eyebrow, one intro-fade beat after the pill. */}
            <p
              className="intro-fade mt-4 font-mono text-12 uppercase tracking-[0.05em] text-beige/75"
              style={{["--delay" as any]: "760ms"}}
            >
              {t("trustLine")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
