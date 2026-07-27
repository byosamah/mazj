import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {SOCIALS} from "@/lib/links";

const SOCIAL_LINKS = [
  {label: "X", href: SOCIALS.x},
  {label: "Linkedin", href: SOCIALS.linkedin},
  {label: "Instagram", href: SOCIALS.instagram},
];

// Accepted payment methods, the real acceptance marks from mazj.sa's footer
// (checkout lives on mazj.sa). Heights differ on purpose: the mada/Mastercard/
// Visa marks sit in a padded 41x26 box, so they need a taller box than the
// tight Tamara/Tabby wordmarks to read at the same optical size.
const PAYMENTS = [
  {brand: "tamara", alt: "Tamara", src: "/payments/tamara.svg", h: "h-4"},
  {brand: "tabby", alt: "Tabby", src: "/payments/tabby.svg", h: "h-4"},
  {brand: "mada", alt: "mada", src: "/payments/mada.svg", h: "h-6"},
  {brand: "mastercard", alt: "Mastercard", src: "/payments/mastercard.svg", h: "h-6"},
  {brand: "visa", alt: "Visa", src: "/payments/visa.svg", h: "h-6"},
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

      {/* Bottom cluster in normal flow (NOT absolutely pinned — WCAG 1.4.4):
          payment methods on top, then socials + ZATCA. */}
      <div className="relative z-10 mx-auto mt-auto flex w-full max-w-[1400px] flex-col gap-8 pt-10">
        <ul
          aria-label={t("payments")}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
        >
          {PAYMENTS.map((p) => (
            <li key={p.brand} className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.alt} loading="lazy" decoding="async" className={`${p.h} w-auto`} />
            </li>
          ))}
        </ul>

        {/* Socials + ZATCA. A flex row with wrap reflows at any text size: the
            two sit on one line at default size (socials start, ZATCA end) and
            stack when text zoom grows them, where the old `absolute` pins
            clipped INSTAGRAM and dropped ZATCA onto the h2. Logical props, so
            RTL mirrors. */}
        <div className="eyebrow flex w-full flex-wrap items-center justify-between gap-x-12 gap-y-2 text-12 text-beige/90">
          {/* gap-x-10 below sm keeps the EN socials row (274px) from stranding
              INSTAGRAM on a second line inside the 272px container at 320px. */}
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* The WCAG 2.2.2 pause control (MotionToggle) was deliberately
                unmounted at the owner's request: a known, accepted 2.2.2 gap.
                Do not re-add from an audit; if it returns it belongs in THIS
                row, never as a fixed floating chip (it occluded ZATCA). */}
            <div className="tabular-nums">{t("zatca")}</div>
            {/* Official ZATCA "VAT registered" seal — MAZJ's own compliance
                badge, the same file mazj.sa serves. alt="" because the tax line
                beside it already announces the registration + number, so the
                seal is visual reinforcement, not new info. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/payments/vat-badge.svg"
              alt=""
              loading="lazy"
              decoding="async"
              className="h-12 w-auto"
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
