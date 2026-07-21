import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {SOCIALS} from "@/lib/links";

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
    <footer
      id="footer"
      className="relative flex min-h-svh w-full flex-col justify-center overflow-clip bg-[#FF5A48] px-6 py-16 lg:px-10"
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
          autoPlay
          muted
          loop
          playsInline
          poster="/images/footer-dune.jpg"
          src="/videos/footer-dune.mp4"
        />
        <div aria-hidden className="absolute inset-0 bg-[#FF5A48] mix-blend-color" />
      </div>
      <div className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-16 lg:grid-cols-3">
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
        <nav className="eyebrow flex flex-col items-center gap-[26px] text-12 text-beige/90">
          {links.map((l, i) => (
            <Link
              key={i}
              href={l.href}
              className="group relative inline-flex items-center gap-[8px] before:absolute before:content-[''] before:inset-x-0 before:top-1/2 before:h-[40px] before:-translate-y-1/2 hover:opacity-70 [transition:opacity_200ms,transform_120ms] active:scale-[0.96]"
            >
              <span className="opacity-70">[</span>
              <span>{l.label}</span>
              <span className="opacity-70">]</span>
            </Link>
          ))}
        </nav>

        {/* Big display type */}
        <div className="flex justify-center lg:justify-end">
          <h2 className="whitespace-nowrap font-sans text-40 font-medium leading-none text-beige/95 lg:text-50">
            {t("morePower")}
          </h2>
        </div>
      </div>

      {/* Socials — pinned bottom-start like the original */}
      <div className="eyebrow absolute bottom-10 start-6 z-10 flex items-center gap-12 text-12 text-beige/70 lg:start-10">
        {SOCIAL_LINKS.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="[transition:opacity_200ms,transform_120ms] active:scale-[0.96] hover:text-beige hover:opacity-100 inline-flex items-center min-h-[40px] min-w-[40px]"
          >
            {s.label}
          </a>
        ))}
      </div>

      {/* ZATCA registration — pinned bottom-end, mirroring the socials row.
          Sits one row above the socials on mobile so the two lines never collide
          on narrow screens. */}
      <div className="eyebrow absolute bottom-[84px] end-6 z-10 text-12 tabular-nums text-beige/70 lg:bottom-10 lg:end-10">
        {t("zatca")}
      </div>
    </footer>
  );
}
