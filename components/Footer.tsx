import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {SOCIALS} from "@/lib/links";
import MotionToggle from "./MotionToggle";

const SOCIAL_LINKS = [
  {label: "X", href: SOCIALS.x},
  {label: "Linkedin", href: SOCIALS.linkedin},
  {label: "Instagram", href: SOCIALS.instagram},
];

export default function Footer() {
  const t = useTranslations("Footer");

  const links = [
    {label: t("linkAbout"), href: "/about"},
    {label: t("linkSpaces"), href: "/spaces"},
    {label: t("linkEvents"), href: "/events"},
    {label: t("linkFaq"), href: "/faq"},
    {label: t("linkContact"), href: "/contact"},
    {label: t("linkTerms"), href: "/terms"},
    {label: t("linkPrivacy"), href: "/privacy"},
  ];

  return (
    // No `justify-center` here: the grid below carries `my-auto` instead. In
    // flexbox an auto margin absorbs free space BEFORE justify-content sees any,
    // so the two would fight. With my-auto on the grid alone the free space
    // splits evenly above and below it (the grid stays optically centred,
    // exactly as justify-center did) while the socials/ZATCA row lands at the
    // bottom in normal flow, where it can reflow under text zoom.
    <footer
      id="footer"
      className="relative flex min-h-svh w-full flex-col overflow-clip bg-orange px-6 py-16 lg:px-10"
    >
      {/* Animated dune video background, recolored to the exact MAZJ brand coral
          (#FF5A48). The color is baked into the video pixels, so we override it
          with a mix-blend-mode:color overlay: the overlay supplies the brand
          hue+saturation while the video supplies the luminosity, so the dune
          keeps its light/shadow motion but reads as #FF5A48. `isolate` scopes
          the blend to just the video (not the footer bg behind it). This is
          exact + predictable in-browser, unlike a hue-rotate filter on such a
          saturated source. The overlay also tints the poster fallback. */}
      <div className="pointer-events-none absolute inset-0 z-0 isolate overflow-clip">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/images/footer-dune.jpg"
          src="/videos/footer-dune.mp4"
        />
        <div aria-hidden className="absolute inset-0 bg-orange mix-blend-color" />
      </div>
      <div className="relative z-10 mx-auto my-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-16 lg:grid-cols-3">
        {/* Wordmark */}
        <div className="flex justify-center lg:justify-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/mazj-wordmark.png"
            alt="MAZJ"
            className="h-[42px] w-auto opacity-95 [filter:brightness(0)_invert(1)]"
          />
        </div>

        {/* Bracket links */}
        <nav
          aria-label={t("footerNav")}
          className="eyebrow flex flex-col items-center gap-[26px] text-12 text-beige"
        >
          {links.map((l, i) => (
            <Link
              key={i}
              href={l.href}
              className="group relative inline-flex items-center gap-[8px] before:absolute before:content-[''] before:inset-x-0 before:top-1/2 before:h-[44px] before:-translate-y-1/2 hover:opacity-70 [transition:opacity_200ms,transform_120ms] active:scale-[0.96]"
            >
              {/* Decorative brackets. aria-hidden so the accessible name is
                  "About", not "[ About ]" (Chrome folds text nodes into the
                  name, and it folds ::before/::after content in too, so moving
                  these to CSS would NOT fix it). Broke JAWS type-ahead. */}
              <span aria-hidden="true" className="opacity-70">
                [
              </span>
              <span>{l.label}</span>
              <span aria-hidden="true" className="opacity-70">
                ]
              </span>
            </Link>
          ))}
        </nav>

        {/* Big display type */}
        <div className="flex justify-center lg:justify-end">
          {/* No whitespace-nowrap: at 40px it overran its own grid cell by 9.6px
              at vw320, and at 50px by 80px in the lg 3-column band (cell is
              272px, text 352px). Footer padding absorbed it so nothing was
              visibly cut, but the heading was escaping its column. This is NOT
              an Arabic problem: Arabic measures narrower (350.2 vs 352.0).
              Letting it wrap keeps one line at every width where it fits
              (including 1440) and balances to two only in the squeezed bands.
              leading-[1.1] rather than leading-none so a two-line wrap does not
              collide; single-line appearance is unchanged. */}
          <h2 className="text-balance text-center font-sans text-40 font-medium leading-[1.1] text-beige lg:text-end lg:text-50">
            {t("morePower")}
          </h2>
        </div>
      </div>

      {/* Socials + ZATCA. IN NORMAL FLOW, not absolutely pinned (WCAG 1.4.4
          Resize Text). They used to be `absolute bottom-10 start-6` and
          `absolute bottom-[84px] end-6`. At 200% text-only zoom text-12 becomes
          24px, both rows doubled in height and grew UPWARD from their fixed
          bottom offsets while the vertically-centred grid stayed put, so the
          socials row clipped by 37.81px (INSTAGRAM cut off) and the ZATCA line
          landed on top of the h2, text over text. Text zoom does not change the
          viewport, so no media query could have caught it.
          A flex row with wrap reflows at any text size: the two sit on one line
          at default size (socials start, ZATCA end, exactly as before) and stack
          when the text grows. `mt-auto` plus `my-auto` on the grid above keeps
          the grid optically centred in the remaining space, so the default
          appearance is unchanged. Logical props throughout, so RTL mirrors. */}
      <div className="eyebrow relative z-10 mx-auto mt-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-x-12 gap-y-2 pt-10 text-12 text-beige/90">
        {/* gap-x-10 below sm: at 320 the EN row (44+60+74px labels + two 48px
            gaps = 274px) missed the 272px container by 2px, so INSTAGRAM
            wrapped alone onto a stranded second line. AR fit (263.5px) because
            html[lang=ar] neutralises the Latin eyebrow tracking. 40px gaps put
            EN at 258px; sm: restores the original rhythm where it never wrapped. */}
        <div className="flex flex-wrap items-center gap-x-10 sm:gap-x-12">
          {SOCIAL_LINKS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="[transition:opacity_200ms,transform_120ms] active:scale-[0.96] hover:opacity-70 inline-flex items-center min-h-[44px] min-w-[44px]"
            >
              {s.label}
            </a>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          {/* WCAG 2.2.2 pause control. Lives HERE, in normal flow, not as a
              fixed floating chip in the layout: as `fixed bottom-4 end-4
              z-[9999]` on an opaque chip it occluded the ZATCA line by
              71.4 x 3.7px at 390px even at default zoom, and by 44,640 px
              squared at 200% text zoom. Fixing 2.2.2 by breaking 1.4.4 is not
              a trade worth making. Its beige-on-coral styling was designed for
              this row anyway, and every real route renders this footer. */}
          <MotionToggle />
          <div className="tabular-nums">{t("zatca")}</div>
        </div>
      </div>
    </footer>
  );
}
