import Image from "next/image";
import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import AmbientVideo from "./motion/AmbientVideo";
import {SOCIALS, STARTUP_OFFER} from "@/lib/links";

const SOCIAL_LINKS = [
  {label: "X", href: SOCIALS.x},
  {label: "Linkedin", href: SOCIALS.linkedin},
  {label: "Instagram", href: SOCIALS.instagram},
];

// Accepted payment methods, the real acceptance marks from mazj.sa's footer
// (checkout lives on mazj.sa). Heights differ on purpose: the mada/Mastercard/
// Visa marks sit in a padded 41x26 box, so they need a taller box than the
// tight Tamara/Tabby wordmarks to read at the same optical size.
//
// `w`/`h` are the INTRINSIC attribute pair, not the rendered size: the class
// above still sets the height and `w-auto` still derives the width. They exist
// so the browser can reserve the box before the SVG arrives. Without them
// Lighthouse flags all five (`unsized-images`) and each mark pops the row into
// place on load. Each value is the file's own viewBox aspect scaled to the
// rendered height, so the reserved box and the painted box agree exactly:
//   tamara   417.45x122.77 at 16px -> 54
//   tabby    999.4x398.1   at 16px -> 40
//   mada / mastercard / visa  41x26 at 24px -> 38
const PAYMENTS = [
  {brand: "tamara", alt: "Tamara", src: "/payments/tamara.svg", h: "h-4", w: 54, px: 16},
  {brand: "tabby", alt: "Tabby", src: "/payments/tabby.svg", h: "h-4", w: 40, px: 16},
  {brand: "mada", alt: "mada", src: "/payments/mada.svg", h: "h-6", w: 38, px: 24},
  {brand: "mastercard", alt: "Mastercard", src: "/payments/mastercard.svg", h: "h-6", w: 38, px: 24},
  {brand: "visa", alt: "Visa", src: "/payments/visa.svg", h: "h-6", w: 38, px: 24},
];

export default function Footer() {
  const t = useTranslations("Footer");

  const links = [
    {label: t("linkAbout"), href: "/about"},
    {label: t("linkSpaces"), href: "/spaces"},
    {label: t("linkEvents"), href: "/events"},
    // Sits beside Events rather than at the end: both are reasons to come that
    // are not a desk, and the footer is the only place on the site (other than
    // the landing band) where a founder who arrived on a space page can find
    // the offer at all.
    {label: t("linkStartups"), href: STARTUP_OFFER},
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
      {/* ⚠️ `footer-dune.mp4` IS NOT A DUNE. The filename is a leftover and it has
          misled this comment, `components/CLAUDE.md` and at least one session.
          Opened and checked 2026-07-30: it is 5.0s / 1280x720 of a man in a
          ghutra making Arabic coffee at MAZJ's pantry counter, dallah, fridge and
          shelves in frame. A RECOGNISABLE PERSON sits behind the footer text, so
          treat any change to its brightness as a change to how visible he is, not
          just as a colour tweak. (The `hero`/`step-card` clips really are dune.)

          Video background, recolored to the exact MAZJ brand coral
          (#FF5A48). The color is baked into the video pixels, so we override it
          with a mix-blend-mode:color overlay: the overlay supplies the brand
          hue+saturation while the video supplies the luminosity, so the footage
          keeps its light/shadow motion but reads as #FF5A48. `isolate` scopes
          the blend to just the video (not the footer bg behind it). This is
          exact + predictable in-browser, unlike a hue-rotate filter on such a
          saturated source. The overlay also tints the poster fallback.

          🔴 THE VIDEO IS HELD AT 15% OVER FLAT CORAL ON PURPOSE. Do not raise it,
          and do NOT try to fix the colour with a brightness filter. Owner ruling
          2026-07-30, after both wrong answers were built and measured.

          The problem: blend:color takes LUMINOSITY FROM THE VIDEO, and this clip
          is dark (mean luma ~78 against the coral's own 137.5). At full strength
          the footer rendered rgb(186, 34, 17), lightness 39.8% against the brand's
          64.1%. Correct hue, but a de-facto DARKENED coral, which is the one thing
          the brand rule forbids. The owner read it as "red-ish".

          ✗ The obvious fix, brightness(1.77) on the video (derived as 137.52 ÷ the
          clip's mean luma), DOES land the colour: 62.4% lightness, 0.0° hue error,
          no clipping. It was rejected on sight and correctly so. The clip is
          1280x720 at **0.52 Mbps**, a very low bitrate for 720p, so multiplying a
          dark heavily-compressed source amplifies its blocking and banding:
          measured high-frequency artifact energy went 5.2 → 9.2, i.e. nearly
          DOUBLE what the site shipped before. It also blew a pale band across the
          end-side column, exactly where both locales put the 50px h2, dropping
          that heading to 1.9:1. Brightness cannot fix a dark low-bitrate source.

          ✓ Instead the coral is painted FLAT on this wrapper and the video rides
          at 15% on top of it, so the brand colour comes from the token and the
          clip only ripples it. Measured: lightness 60.6% against the 64.1% target
          (was 39.8%), hue error 0.0°, and artifacts fall to 0.8, which is ~6x
          CLEANER than the site ships today rather than worse. Nothing is
          brightened, so nothing is over-exposed.

          ⚠️ `bg-orange` on THIS div is load-bearing, not a duplicate of the
          section's. `isolate` scopes the blend, so the overlay blends against
          whatever is inside this group only; without a coral base here the
          15%-opacity video would composite against transparency and the blend
          would have nothing to take luminosity from.

          ⚠️ Cream text sits at ~2.79:1 over this. Below AA, and the same
          brand-over-metric call already made for flat coral at 2.72:1. Any fix
          keeps the coral at full brightness. See components/CLAUDE.md. */}
      <div className="pointer-events-none absolute inset-0 z-0 isolate overflow-clip bg-orange">
        {/* The 15% opacity is on BOTH layers on purpose: the poster used to be
            the video's own `poster` attribute and therefore inherited it, so
            carrying it across keeps the still and the footage at the identical
            dilution. 🔴 That 15%-over-flat-coral recipe is the measured one
            (lightness 60.6 against the brand's 64.1, hue error 0.0, artifacts
            6x cleaner than a brightness lift) — see components/CLAUDE.md before
            touching it. */}
        <AmbientVideo
          src="/videos/footer-dune.mp4"
          poster="/images/footer-dune.jpg"
          sizes="100vw"
          className="opacity-[0.15]"
        />
        <div aria-hidden className="absolute inset-0 bg-orange mix-blend-color" />
      </div>
      <div className="relative z-10 mx-auto my-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-16 lg:grid-cols-3">
        {/* Wordmark */}
        <div className="flex justify-center lg:justify-start">
          {/* 559x412 intrinsic, rendered at 42px tall, so 57 wide. Stated so
              the row reserves the box rather than reflowing when it lands. */}
          <Image
            src="/logos/mazj-wordmark.png"
            alt="MAZJ"
            width={57}
            height={42}
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
              className="group relative inline-flex items-center gap-[8px] before:absolute before:content-[''] before:inset-x-0 before:top-1/2 before:h-[44px] before:-translate-y-1/2 [transition:transform_120ms] active:scale-[0.96]"
            >
              {/* Decorative brackets. aria-hidden so the accessible name is
                  "About", not "[ About ]" (Chrome folds text nodes into the
                  name, and it folds ::before/::after content in too, so moving
                  these to CSS would NOT fix it). Broke JAWS type-ahead.

                  🔴 THE BRACKETS ARE THE HOVER, and that replaced a
                  `hover:opacity-70` on the whole link (2026-07-31). Fading a
                  link on hover is backwards: it makes the thing you are
                  pointing at HARDER to read at the exact moment of intent, and
                  on cream over the coral band it was spending contrast the
                  footer does not have. Brightening the brackets instead adds
                  presence, costs the label nothing, and uses an ornament this
                  design already owns. */}
              <span
                aria-hidden="true"
                className="opacity-70 [transition:opacity_200ms] group-hover:opacity-100"
              >
                [
              </span>
              <span>{l.label}</span>
              <span
                aria-hidden="true"
                className="opacity-70 [transition:opacity_200ms] group-hover:opacity-100"
              >
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
              {/* Raw <img>, deliberately: these are SVGs, and routing an SVG
                  through next/image needs `dangerouslyAllowSVG`, which turns
                  the optimizer into a proxy for arbitrary SVG. There is nothing
                  to gain either way — a 1.3 KB vector cannot be made smaller by
                  re-encoding it as AVIF. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt={p.alt}
                width={p.w}
                height={p.px}
                loading="lazy"
                decoding="async"
                className={`${p.h} w-auto`}
              />
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
                className="underline decoration-transparent underline-offset-[6px] hover:decoration-beige [transition:text-decoration-color_200ms,transform_120ms] active:scale-[0.96] inline-flex items-center min-h-[44px] min-w-[44px]"
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
              width={38}
              height={48}
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
