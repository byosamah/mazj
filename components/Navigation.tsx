"use client";

import {useEffect, useRef, useState} from "react";
import Image from "next/image";
import {useLocale, useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import CtaButton from "./CtaButton";
import LocaleSwitcher from "./LocaleSwitcher";
import {getLenis} from "./motion/SmoothScroll";
import {useIsDesktop, usePrefersReducedMotion} from "./useMediaQuery";

/** Playback rate for the header CTA's ambient dune fill. The source clip is a
 *  7.4s loop that drifts too slowly to register at a glance behind the blur,
 *  so it runs faster than Daylight's 1x. Tune here, nowhere else. */
const CTA_VIDEO_SPEED = 2;

/** The mobile panel's id, referenced by the hamburger's `aria-controls`. The
 *  element must therefore exist in the DOM even while closed; see the
 *  visibility-not-unmount note on the panel itself. */
const MENU_ID = "mazj-mobile-menu";

/** What the mobile menu's focus trap treats as tabbable. The header only ever
 *  holds links and buttons, so this stays deliberately narrow. `:not([disabled])`
 *  matters: LocaleSwitcher disables itself during its route transition. */
const FOCUSABLE = "a[href], button:not([disabled])";

export default function Navigation() {
  const t = useTranslations("Nav");
  const rtl = useLocale() === "ar";
  const isDesktop = useIsDesktop();
  const reduceMotion = usePrefersReducedMotion();

  // Mobile disclosure state. `menuOpen` is DERIVED, not stored, so that resizing
  // past the lg breakpoint closes the menu and releases the scroll lock without
  // a set-state-in-an-effect (the pattern this repo's ESLint config flags).
  // `useIsDesktop()` reads false on the server and on the first client render,
  // which is harmless here: the hamburger only exists below lg in the first
  // place, so `menuRequested` can never be true while `isDesktop` is stale.
  const [menuRequested, setMenuRequested] = useState(false);
  const menuOpen = menuRequested && !isDesktop;

  const mobileRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  // The original header stays pinned and visible at every scroll depth.
  const links = [
    {label: t("spaces"), href: "/spaces"},
    {label: t("events"), href: "/events"},
    {label: t("about"), href: "/about"},
    {label: t("contact"), href: "/contact"},
  ];

  // Move focus into the panel once it is open, mirroring the hero space-finder:
  // gate on a plain boolean and hand off through requestAnimationFrame. Unlike
  // the hero's portaled dropdown this panel needs no measurement pass, so it is
  // already mounted by the time the effect runs; the rAF only defers past the
  // paint that flips `visibility`, since a `visibility: hidden` element cannot
  // take focus.
  useEffect(() => {
    if (!menuOpen) return;
    const frame = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [menuOpen]);

  // Escape (returning focus to the hamburger), outside-click, and a Tab trap.
  // The trap spans the whole mobile subtree, not just the panel, so the logo,
  // the locale switcher and the hamburger itself all stay reachable while the
  // menu is open; the alternative (trapping the panel alone) would strand the
  // close button outside the cycle.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!mobileRef.current?.contains(e.target as Node)) setMenuRequested(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuRequested(false);
        hamburgerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const root = mobileRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !active || !root.contains(active);
      if (e.shiftKey && (outside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (outside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Lock the page behind the open menu.
  //
  // The site scrolls through Lenis, so `lenis.stop()` is the mechanism already
  // present: it parks the smooth scroller AND stamps `.lenis-stopped` on <html>,
  // which globals.css turns into `overflow: hidden`. That covers the normal
  // path. It does NOT cover reduced motion, where SmoothScroll never constructs
  // Lenis at all and `getLenis()` is null, so the inline `overflow` below sets
  // the very same property unconditionally rather than adding a second, competing
  // lock. (iOS Safari honours root `overflow: hidden` imperfectly; that limit is
  // inherited from the existing Lenis lock, not introduced here.)
  useEffect(() => {
    if (!menuOpen) return;
    const lenis = getLenis();
    lenis?.stop();
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previousOverflow;
      lenis?.start();
    };
  }, [menuOpen]);

  // One click handler for the whole panel rather than an onClick per link: it
  // also catches the CtaButton, which takes no onClick prop and lives in another
  // file. Keyboard activation of a link fires a click that bubbles here too, so
  // Enter closes the menu exactly like a tap. Navigation itself is untouched;
  // this only drops the disclosure state, which otherwise survives the route
  // change (Navigation sits in the layout and never remounts).
  const onPanelClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest("a")) setMenuRequested(false);
  };

  // Closed state of the panel. `visibility` (not unmounting) keeps MENU_ID in
  // the DOM for `aria-controls` to point at, while still removing the links from
  // both the tab order and the accessibility tree, and it is the one hidden
  // state that can still transition. Under reduced motion the offset is dropped
  // entirely: the global reduced-motion rule only zeroes transition DURATION, so
  // without this the element would still be displaced, just instantly. Both
  // class strings are written literally so the JIT emits them.
  const panelClosed = reduceMotion
    ? "invisible opacity-0"
    : "invisible -translate-y-1 opacity-0";

  return (
    // 🔴 Centred with inset-x-0 + justify-center, NOT left-1/2 + -translate-x-1/2.
    // A fixed element with `left: 50%` and no `right`/`width` shrink-to-fits into
    // the space that remains, i.e. 50vw. The translate re-centres it on screen but
    // buys back no layout width, so the pill was laying out inside half a viewport:
    // measured 512.0px at vw1024 rising to its natural 524.7px only from vw1056 up.
    // Inside that squeezed band the "Book now" label wrapped to two lines in a
    // fixed 45px-tall button, and the wordmark was squashed 14.1% (rendered aspect
    // 1.166 against a natural 1.357). inset-x-0 gives the header the full viewport
    // and justify-center does the centring for real: header 512 -> 1024, pill back
    // to 524.7, CTA back to one line, logo back to 1.356. The pair is logical, so
    // RTL mirrors for free, and centring is width-agnostic, which matters because
    // the Arabic pill is naturally wider (532.6 vs 524.7).
    //
    // pointer-events are opted back in per bar: the header now spans the full
    // viewport width, and a transparent full-width band must not swallow clicks
    // aimed at the hero beneath it.
    <header className="pointer-events-none fixed inset-x-0 top-[22px] z-100 flex justify-center">
      {/* Desktop pill */}
      <div
        className="pointer-events-auto hidden items-center rounded-[6px] bg-white lg:flex"
        style={{gap: "28px", padding: rtl ? "6px 16px 6px 6px" : "6px 6px 6px 16px", boxShadow: "0 10px 32px rgba(0,0,0,0.12)"}}
      >
        <Link href="/" aria-label={t("home")} className="relative flex items-center transition-transform duration-[120ms] active:scale-[0.96] before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:h-[44px] before:w-[44px] before:-translate-x-1/2 before:-translate-y-1/2">
          {/* `priority`: the header is fixed at the top of every route, so this
              is in the first viewport on all 26 of them. Left to the default it
              is lazy, and a lazy image in a fixed header still waits for the
              observer. */}
          <Image src="/logos/mazj-wordmark.png" alt="MAZJ" height={19} width={26} priority className="h-[19px] w-auto" />
        </Link>
        {/* Labelled so a landmark rotor can tell this from the footer's nav.
            Unlabelled, the two announced as a bare "navigation, navigation".
            The mobile panel's nav carries the SAME label on purpose: exactly one
            of the two subtrees is ever display:block, so they never coexist in
            the accessibility tree. */}
        <nav aria-label={t("primaryNav")} className="flex flex-row items-center" style={{gap: "24px"}}>
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-14 text-black inline-flex items-center min-h-[40px] underline decoration-transparent underline-offset-[6px] hover:decoration-black [transition:text-decoration-color_200ms,transform_120ms] active:scale-[0.96]"
            >
              {l.label}
            </Link>
          ))}
          <LocaleSwitcher />
        </nav>
        {/* Self-serve entry point. Lands on /spaces (the full booking menu)
            rather than jumping straight out to one mazj.sa product, so the
            header never has to guess which of the six someone wants. */}
        <Link
          href="/spaces"
          className="relative isolate flex h-[45px] items-center justify-center overflow-clip rounded-[4px] bg-orange px-[24px] transition-transform duration-[120ms] active:scale-[0.96]"
        >
          {/* Ambient dune fill, ported from godaylight.com's header CTA. It is
              always playing, never hover-gated: the effect is the loop breathing
              behind a permanent blur, not a reveal. `mazj-button.mp4` is
              Daylight's own button crop (byte-identical), so it is framed for a
              127x45 box rather than squeezed down from a hero-sized clip.
              Recolored to brand coral via a mix-blend-color overlay, and NOT
              dimmed: the clip's own mean luma (~136) already equals #FF5A48's
              blend luminosity (137.5), so the coral lands on true brand at full
              brightness. (hero/step-card dim theirs to 0.78; this one is the
              header's brand button and must read as exact #FF5A48, not darker.)
              `isolate` scopes the blend; `overflow-clip` holds the 4px radius.
              `bg-orange` on the link is the base coral the video paints over,
              so the button is never bare before the first frame decodes. */}
          {/* All three layers are absolute with no z-index, so DOM order alone
              is paint order: video, then the coral blend, then the blur. The
              label is `relative` and last, so it always paints on top and stays
              white (a blend overlay above it would repaint it coral). */}
          {/* Daylight plays this at 1x, where the drift is so slow you have to
              stop and stare to notice the button is moving at all. Sped up so
              the motion reads at a glance. `defaultPlaybackRate` matters as much
              as `playbackRate`: the media load algorithm resets the live rate
              back to the default, so setting only the latter can silently snap
              back to 1x once the file finishes loading. */}
          {/* Rendered only at lg and up. `hidden lg:flex` on the pill is a PAINT
              rule, not a fetch rule: the element stayed in the DOM on phones and
              pulled all 41 KB of mazj-button.mp4 at 390px, where the button is
              display:none. Only not rendering it stops the request.
              Gating the <video> rather than the whole pill is deliberate:
              useIsDesktop() is false on the first client render by design, so
              gating the pill would flash the header in one paint after hydration
              on desktop. The pill keeps its CSS hiding for LAYOUT; just the media
              waits. Nothing flashes when the video does arrive, because bg-orange
              on the link is already the coral the video paints over.
              preload="none" is belt and braces: autoplay supersedes it wherever
              the video is allowed to play, so it only bites when a UA defers
              autoplay (data saver), where a fetch would buy nothing. */}
          {isDesktop && (
            <video
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              ref={(el) => {
                if (el) {
                  el.defaultPlaybackRate = CTA_VIDEO_SPEED;
                  el.playbackRate = CTA_VIDEO_SPEED;
                }
              }}
              src="/videos/mazj-button.mp4"
            />
          )}
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-[#FF5A48] mix-blend-color" />
          {/* Daylight's `backdrop-blur-sm` is Tailwind v4 (=8px); this repo is
              Tailwind 3 where that class is only 4px, hence the explicit value.
              The blur is what collapses the ripples into a near-solid coral and
              keeps the white label legible over moving footage. */}
          <span aria-hidden className="pointer-events-none absolute inset-0 backdrop-blur-[8px]" />
          {/* No contrast scrim, and no video dim, ON PURPOSE. The white 14px
              label sits ~3.08:1 on full-brightness coral, below the AA 4.5:1
              minimum, and that is the OWNER'S explicit brand-over-metric choice:
              the button must read as true #FF5A48, not a darkened variant. A
              black film (0.22) once lifted the label to 4.812:1 but darkened the
              coral, and the owner rejected it hard ("it's our branding"). It is
              removed here for the same reason. 🔴 Do NOT re-add a scrim, or
              re-dim the video, from a contrast audit: any real fix must keep the
              coral at full #FF5A48 brightness and come from the owner. */}
          <span className="relative text-14 font-medium text-white">{t("getStarted")}</span>
        </Link>
      </div>

      {/* Mobile bar + disclosure menu.
          The desktop nav is lg:only, so before this existed the header offered a
          phone NO primary navigation at all: /spaces, /events, /about and
          /contact were unreachable from it, and the hamburger was a dead button
          whose aria-label duplicated the logo link two tab stops earlier.
          Deliberately NOT portaled, unlike the hero's space-finder: that one has
          to escape an overflow-clip section, whereas this header is fixed and
          nothing clips it. Staying in the tree keeps the focus trap and the
          outside-click test scoped to a single subtree.
          The width lives on this wrapper (it used to sit on the bar itself) so
          the panel below inherits the bar's exact footprint. */}
      <div ref={mobileRef} className="pointer-events-none w-[calc(100vw-1.5rem)] lg:hidden">
        <div className="pointer-events-auto flex items-center justify-between rounded-[6px] bg-white px-5 py-3 shadow-[0_2px_20px_rgba(0,0,0,0.1)]">
          <Link href="/" aria-label={t("home")} className="relative flex items-center transition-transform duration-[120ms] active:scale-[0.96] before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:h-[44px] before:w-[44px] before:-translate-x-1/2 before:-translate-y-1/2">
            <Image src="/logos/mazj-wordmark.png" alt="MAZJ" height={18} width={25} priority className="h-[18px] w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            {/* 44x44, up from 40x40. The state lives on aria-expanded rather than
                in a swapped label, so the name stays stable while the button
                toggles. */}
            <button
              ref={hamburgerRef}
              type="button"
              aria-label={t("menu")}
              aria-expanded={menuOpen}
              aria-controls={MENU_ID}
              onClick={() => setMenuRequested((open) => !open)}
              className="flex h-11 w-11 items-center justify-center transition-transform duration-[120ms] active:scale-[0.96]"
            >
              {/* Two stacked icons cross-fading, rather than a geometry morph:
                  the bars are tapered (16.5/11.5/6.5 wide), so rotating them into
                  an X would need per-line scaling to come out symmetric. The
                  wrapper pins both to the icon's own 18x14 box so neither relies
                  on flex static-position for abspos children. Reduced motion is
                  already handled globally (transition-duration -> 0.001ms). */}
              <span className="relative block h-[14px] w-[18px]">
                <svg
                  width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true"
                  className={`absolute inset-0 [transition:opacity_200ms] ${menuOpen ? "opacity-0" : "opacity-100"}`}
                >
                  <line x1="0.75" y1="1.5" x2="17.25" y2="1.5" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="3.25" y1="7" x2="14.75" y2="7" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="5.75" y1="12.5" x2="12.25" y2="12.5" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <svg
                  width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true"
                  className={`absolute inset-0 [transition:opacity_200ms] ${menuOpen ? "opacity-100" : "opacity-0"}`}
                >
                  <line x1="3" y1="1" x2="15" y2="13" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="15" y1="1" x2="3" y2="13" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            </button>
          </div>
        </div>

        {/* The panel reuses the bar's own surface verbatim: same 6px radius,
            same white, same shadow, so it reads as a second pill rather than a
            new component. No dark full-screen overlay: nothing in this header
            establishes one, and the scroll lock already stops the page moving. */}
        <div
          ref={panelRef}
          id={MENU_ID}
          onClick={onPanelClick}
          className={`mt-2 rounded-[6px] bg-white px-5 py-3 shadow-[0_2px_20px_rgba(0,0,0,0.1)] [transition:opacity_200ms,visibility_200ms,transform_200ms] ${
            menuOpen ? "pointer-events-auto visible translate-y-0 opacity-100" : panelClosed
          }`}
        >
          <nav aria-label={t("primaryNav")} className="flex flex-col">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="flex min-h-[44px] items-center text-14 text-black underline decoration-transparent underline-offset-[6px] hover:decoration-black [transition:text-decoration-color_200ms,transform_120ms] active:scale-[0.96]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          {/* Desktop parity: the header CTA reaches mobile too. It is the shared
              CtaButton, not the coral video treatment above; re-mounting that
              button here would refetch the very video FIX 6 just stopped
              downloading on phones. `dark` is the site's standard CTA on a light
              surface, and .cta already stands 50px tall, clearing 44.
              No active:scale here: .cta:active already carries it globally, and
              stacking a Tailwind `transform` scale on top compounds to ~0.92. */}
          <CtaButton href="/spaces" variant="dark" className="mt-2 w-full">
            {t("getStarted")}
          </CtaButton>
        </div>
      </div>
    </header>
  );
}
