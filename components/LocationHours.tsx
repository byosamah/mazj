import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import {waLink, MAPS_URL} from "@/lib/contact";

/**
 * Location & hours. Reads the shared "Location" namespace so the landing
 * section and the contact page always show the same facts. WhatsApp and the
 * map are real links now; the phone row is intentionally omitted until a
 * verified number exists (never render "Coming soon" on a contact method).
 */
export default function LocationHours() {
  const t = useTranslations("Location");

  const rows: Array<{label: string; value: string; href?: string}> = [
    {label: t("addressLabel"), value: t("address")},
    {label: t("staffedLabel"), value: t("staffedValue")},
    {label: t("membersLabel"), value: t("membersValue")},
    {label: t("whatsappLabel"), value: t("whatsappValue"), href: waLink(t("whatsappMsg"))},
  ];

  return (
    <section className="relative w-full bg-beige px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="flex flex-col gap-5 lg:ps-[8%]">
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
          <dl className="mt-4 flex max-w-[480px] flex-col">
            {rows.map((row, i) => (
              <div key={i} className="flex flex-col gap-1 border-t border-black/10 py-5">
                <dt className="eyebrow text-12 text-muted">{row.label}</dt>
                <dd className="text-15 leading-relaxed text-black lg:text-16 [font-variant-numeric:tabular-nums]">
                  {/* The WhatsApp value was a bare inline <a> at text-15, so it
                      got nothing but its own line box: 106.0 x 19.0 measured at
                      390px, less than half the 44px guideline (WCAG 2.5.8), and
                      it repeats on six routes. The `before:` pseudo-element
                      centres a 44px-tall hit box on the line without adding
                      padding, so the row's rhythm and the rule above it do not
                      move. Width already clears 44 at 106px. */}
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

        {/* Links to MAZJ's real Google listing (Life Tower). This was an EMPTY
            tan box with a caption — the largest visual element on the contact
            page was a placeholder, on the one page whose subject is location.
            It now carries a real photo of the space with the directions label
            over a scrim, so the block shows something before it asks for a tap. */}
        <Reveal delay={120} className="flex items-center justify-center">
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex aspect-[4/3] w-full max-w-[560px] items-end overflow-clip rounded-[16px] bg-beige-card transition-transform duration-[120ms] active:scale-[0.96] after:pointer-events-none after:absolute after:inset-0 after:rounded-[16px] after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] after:content-['']"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/spaces/office-day.jpg"
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
