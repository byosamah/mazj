"use client";

import {useLocale, useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import LocaleSwitcher from "./LocaleSwitcher";

/** Playback rate for the header CTA's ambient dune fill. The source clip is a
 *  7.4s loop that drifts too slowly to register at a glance behind the blur,
 *  so it runs faster than Daylight's 1x. Tune here, nowhere else. */
const CTA_VIDEO_SPEED = 2;

export default function Navigation() {
  const t = useTranslations("Nav");
  const rtl = useLocale() === "ar";

  // The original header stays pinned and visible at every scroll depth.
  const links = [
    {label: t("spaces"), href: "/spaces"},
    {label: t("events"), href: "/events"},
    {label: t("about"), href: "/about"},
    {label: t("contact"), href: "/contact"},
  ];

  return (
    <header className="fixed top-[22px] left-1/2 z-100 -translate-x-1/2">
      {/* Desktop pill */}
      <div
        className="hidden items-center rounded-[6px] bg-white lg:flex"
        style={{gap: "28px", padding: rtl ? "6px 16px 6px 6px" : "6px 6px 6px 16px", boxShadow: "0 10px 32px rgba(0,0,0,0.12)"}}
      >
        <Link href="/" aria-label={t("home")} className="relative flex items-center transition-transform duration-[120ms] active:scale-[0.96] before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:h-[40px] before:w-[40px] before:-translate-x-1/2 before:-translate-y-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/mazj-wordmark.png" alt="MAZJ" height={19} width={26} className="h-[19px] w-auto" />
        </Link>
        <nav className="flex flex-row items-center" style={{gap: "24px"}}>
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-14 text-black inline-flex items-center min-h-[40px] hover:opacity-60 [transition:opacity_200ms,transform_120ms] active:scale-[0.96]"
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
              Recolored to brand coral the usual way (0.78 dim, matching the
              hero/step-card luma bracket, + mix-blend-color overlay).
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
          <video
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-cover [filter:brightness(0.78)]"
            autoPlay
            muted
            loop
            playsInline
            ref={(el) => {
              if (el) {
                el.defaultPlaybackRate = CTA_VIDEO_SPEED;
                el.playbackRate = CTA_VIDEO_SPEED;
              }
            }}
            src="/videos/mazj-button.mp4"
          />
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-[#FF5A48] mix-blend-color" />
          {/* Daylight's `backdrop-blur-sm` is Tailwind v4 (=8px); this repo is
              Tailwind 3 where that class is only 4px, hence the explicit value.
              The blur is what collapses the ripples into a near-solid coral and
              keeps the white label legible over moving footage. */}
          <span aria-hidden className="pointer-events-none absolute inset-0 backdrop-blur-[8px]" />
          <span className="relative text-14 font-medium text-white">{t("getStarted")}</span>
        </Link>
      </div>

      {/* Mobile bar */}
      <div className="flex w-[calc(100vw-1.5rem)] items-center justify-between rounded-[6px] bg-white px-5 py-3 shadow-[0_2px_20px_rgba(0,0,0,0.1)] lg:hidden">
        <Link href="/" aria-label={t("home")} className="relative flex items-center transition-transform duration-[120ms] active:scale-[0.96] before:absolute before:content-[''] before:left-1/2 before:top-1/2 before:h-[40px] before:w-[40px] before:-translate-x-1/2 before:-translate-y-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/mazj-wordmark.png" alt="MAZJ" height={18} width={25} className="h-[18px] w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          {/* TODO(owner): the mobile hamburger has no menu behind it yet; adding
              one is a design task for the next pass. All pages stay reachable on
              mobile through the footer links meanwhile. */}
          <button type="button" aria-label={t("home")} className="flex h-10 w-10 items-center justify-center transition-transform duration-[120ms] active:scale-[0.96]">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
              <line x1="0.75" y1="1.5" x2="17.25" y2="1.5" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="3.25" y1="7" x2="14.75" y2="7" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="5.75" y1="12.5" x2="12.25" y2="12.5" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
