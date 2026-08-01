import Image from "next/image";
import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import {waLink, MAPS_URL} from "@/lib/contact";

/**
 * Location & hours. Reads the shared "Location" namespace so the landing
 * section and the contact page always show the same facts. WhatsApp and the
 * map are real links now; the phone row is intentionally omitted until a
 * verified number exists (never render "Coming soon" on a contact method).
 *
 * `surface` lets a route tint the section without forking the component: the
 * landing passes `bg-beige-card` (tan) so this block steps off the cream FAQ
 * that follows it; contact + the space pages keep the default cream.
 */
export default function LocationHours({surface = "bg-beige"}: {surface?: string}) {
  const t = useTranslations("Location");

  const rows: Array<{label: string; value: string; href?: string}> = [
    {label: t("addressLabel"), value: t("address")},
    {label: t("staffedLabel"), value: t("staffedValue")},
    {label: t("subscribersLabel"), value: t("subscribersValue")},
    {label: t("whatsappLabel"), value: t("whatsappValue"), href: waLink(t("whatsappMsg"))},
  ];

  return (
    <section className={`relative w-full ${surface} px-6 py-24 lg:px-10 lg:py-32`}>
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <Reveal className="flex flex-col gap-6">
          <p className="eyebrow text-12 text-muted">{t("eyebrow")}</p>
          <h2 className="whitespace-pre-line text-balance font-sans text-32 font-medium leading-[1.05] text-black lg:text-50">
            {t("title")}
          </h2>
          {/* One sentence of indexable prose on every route this section
              mounts (home, contact, all four space pages): the primary query
              phrase + the full street address in visible body text. */}
          <p className="max-w-[52ch] text-pretty text-15 leading-relaxed text-muted lg:text-16">
            {t("blurb")}
          </p>
          {/* Address + WhatsApp span the row; staffed/subscribers pair up
              beneath: a composed 2-up grid, not a flat single-column list. */}
          <dl className="mt-2 grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2">
            {rows.map((row, i) => (
              <div
                key={i}
                className={`flex flex-col gap-1.5 border-t border-black/10 pt-4 ${
                  i === 0 || i === 3 ? "sm:col-span-2" : ""
                }`}
              >
                <dt className="eyebrow text-12 text-muted">{row.label}</dt>
                <dd className="text-15 leading-relaxed text-black lg:text-16 [font-variant-numeric:tabular-nums]">
                  {/* 44px-tall hit box on the WhatsApp line (WCAG 2.5.8) without
                      moving the row rhythm; the value already clears 44px wide. */}
                  {row.href ? (
                    <a
                      href={row.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative inline-flex items-center text-black underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black before:absolute before:inset-x-0 before:top-1/2 before:h-[44px] before:-translate-y-1/2 before:content-['']"
                    >
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        {/* Links to MAZJ's real Google listing (Life Tower). Carries a static
            map still of the pin (public/images/location-map.png) with the
            "Get directions" label over a bottom scrim; taps through to Maps.

            🔴 IT IS A CUSTOM-STYLED MAP, NOT A GOOGLE SCREENSHOT (2026-07-30).
            The still it replaces was default Google styling, which meant MAZJ's
            own visit-us card named five other businesses on it, one of them a
            hotel: Aloft by Marriott, LEGO Store, JOE & THE JUICE, Hazel Coffee
            and Regal Burger. It now renders MAZJ's palette (cream ground, white
            roads, hairline strokes, a coral pin) with every business POI
            suppressed. The style lives in `scripts/mazj-map-style.json` and the
            regeneration recipe is in `components/CLAUDE.md`.

            ⚠️ Still the clean capture with NO rating card: no rating claims on
            the page, per brand.

            ⚠️ PNG, not JPEG, and that is measured rather than a preference. The
            styled map holds 464 distinct colours, so a 256-colour PNG is
            effectively lossless (max channel error 4) at 41KB, against 203KB for
            the JPEG it replaces at a LOWER resolution. JPEG also rings around
            the street labels, which are the one thing here that must stay
            crisp. */}
        <Reveal delay={120} className="flex">
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex aspect-[4/3] w-full items-end overflow-clip rounded-[16px] bg-beige-card transition-transform duration-[120ms] active:scale-[0.96] after:pointer-events-none after:absolute after:inset-0 after:rounded-[16px] after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] after:content-['']"
          >
            {/* 🔴 `unoptimized`, and it is not laziness. The still is already a
                hand-tuned PNG-8 at 256 colours (41 KB, measured effectively
                lossless against the styled map's 464 distinct colours). Running
                it back through a lossy AVIF/WebP re-encode is the one thing that
                would undo that: the flat cream fields band and the street
                labels ring, which is exactly the artifact PNG-8 was chosen to
                avoid. See the regeneration recipe in components/CLAUDE.md. */}
            <Image
              src="/images/location-map.png"
              alt=""
              fill
              unoptimized
              sizes="(min-width: 1024px) 745px, 100vw"
              className="object-cover transition-transform duration-700 ease-expo-out group-hover:scale-[1.04]"
            />
            {/* A CREAM SCRIM ACROSS THE BOTTOM, carrying the label and covering
                the map's baked-in Google branding. Owner instruction, 2026-07-30.

                🔴 THE COLOUR IS NOT THE PREFERENCE HALF, AND MUST NOT BE
                REVERTED. This was `from-black/70 via-black/20`, which was right
                while the still was Google's default styling: that image is
                mid-toned, so a dark fade read as a shadow. Against the
                cream-and-white styled map the same fade read as DIRT, turning the
                bottom half of the card muddy grey. Measured in situ at 1440. Ink
                on cream is 17.4:1 and the arrow's warm grey 7.77:1, so the flip
                from cream text to ink is also the safer direction.

                ⚠️ WHAT THE POSITION COSTS, recorded rather than argued. The map
                renders "Google" and "Map data ©…" along its bottom edge, and this
                fade is what hides them. Google's terms ask for that attribution
                to stay legible, so this is a deliberate step further into the
                grey area the still already sits in: the whole asset is a
                self-hosted capture rather than a Static Maps API call, because
                this project holds no Maps key.

                🔴 **THE OWNER DECLINED A MAPS API KEY, 2026-07-30, having been
                offered it twice. Do not propose it again.** Their reasoning:
                anyone who wants the real map taps the card, which opens Google
                Maps. So this still is a picture of where MAZJ is, not a map
                product, and it stays a picture. The only fix left on the table,
                if it ever matters, is easing this gradient so the last ~24px stay
                clear. Do not change it silently in either direction. */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-beige via-beige/80 to-transparent" />
            <div className="relative flex w-full items-end justify-between gap-6 p-6 lg:p-8">
              <p className="eyebrow max-w-[300px] text-12 text-black underline decoration-black/20 underline-offset-4 group-hover:decoration-black">
                {t("mapPlaceholder")}
              </p>
              <span aria-hidden className="eyebrow shrink-0 text-12 text-muted">
                ↗
              </span>
            </div>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
