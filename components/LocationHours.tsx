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
    {label: t("membersLabel"), value: t("membersValue")},
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
          {/* Address + WhatsApp span the row; staffed/members pair up beneath —
              a composed 2-up grid rather than a flat single-column list. */}
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
            Google-map still of the pin (public/images/location-map.jpg) with the
            "Get directions" label over a bottom scrim; taps through to Maps.
            Deliberately the clean, unlabelled-pin capture, NOT the variant that
            bakes a 4.7-star rating card onto the map (no rating claims on the
            page, per brand). Regenerate the still from Google Maps if the pin
            ever moves. */}
        <Reveal delay={120} className="flex">
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex aspect-[4/3] w-full items-end overflow-clip rounded-[16px] bg-beige-card transition-transform duration-[120ms] active:scale-[0.96] after:pointer-events-none after:absolute after:inset-0 after:rounded-[16px] after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] after:content-['']"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/location-map.jpg"
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-expo-out group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="relative flex w-full items-end justify-between gap-6 p-6 lg:p-8">
              <p className="eyebrow max-w-[300px] text-12 text-beige underline decoration-beige/30 underline-offset-4 group-hover:decoration-beige">
                {t("mapPlaceholder")}
              </p>
              <span aria-hidden className="eyebrow shrink-0 text-12 text-beige/70">
                ↗
              </span>
            </div>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
