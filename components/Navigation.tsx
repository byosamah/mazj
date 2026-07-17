"use client";

import {useLocale, useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {BOOKING} from "@/lib/links";
import LocaleSwitcher from "./LocaleSwitcher";

export default function Navigation() {
  const t = useTranslations("Nav");
  const rtl = useLocale() === "ar";

  // The original header stays pinned and visible at every scroll depth.
  const links = [
    {label: t("spaces"), href: "/spaces"},
    {label: t("pricing"), href: "/pricing"},
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
        <Link href="/" aria-label={t("home")} className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/mazj-wordmark.png" alt="MAZJ" height={19} width={26} className="h-[19px] w-auto" />
        </Link>
        <nav className="flex flex-row items-center" style={{gap: "24px"}}>
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-14 text-black transition-opacity duration-200 hover:opacity-60"
            >
              {l.label}
            </Link>
          ))}
          <LocaleSwitcher />
        </nav>
        <a
          href={BOOKING.dayDesk}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative isolate flex h-[45px] items-center justify-center overflow-clip rounded-[4px] bg-orange px-[24px]"
        >
          {/* Hover-only dune. Reuses the hero window's own clip, recolored to the
              exact brand coral the same way (brightness dim + mix-blend-color
              overlay). Same source file as the hero box, so it decodes from cache
              and takes the identical 0.78 dim. `isolate` scopes the blend to the
              button; `overflow-clip` keeps the video inside the 4px radius.
              The label below carries `relative` so it paints above this. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-[100ms] ease-out group-hover:opacity-100"
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
            <span className="absolute inset-0 bg-[#FF5A48] mix-blend-color" />
          </span>
          <span className="relative text-14 font-medium text-white">{t("getStarted")}</span>
        </a>
      </div>

      {/* Mobile bar */}
      <div className="flex w-[calc(100vw-1.5rem)] items-center justify-between rounded-[6px] bg-white px-5 py-3 shadow-[0_2px_20px_rgba(0,0,0,0.1)] lg:hidden">
        <Link href="/" aria-label={t("home")} className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/mazj-wordmark.png" alt="MAZJ" height={18} width={25} className="h-[18px] w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          {/* TODO(owner): the mobile hamburger has no menu behind it yet; adding
              one is a design task for the next pass. All pages stay reachable on
              mobile through the footer links meanwhile. */}
          <button type="button" aria-label={t("home")} className="flex h-10 w-10 items-center justify-center">
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
