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
          <p className="font-mono text-12 uppercase tracking-[0.05em] text-muted">{t("eyebrow")}</p>
          <h2 className="whitespace-pre-line font-sans text-32 font-medium leading-[1.05] text-black lg:text-50">
            {t("title")}
          </h2>
          <dl className="mt-4 flex max-w-[480px] flex-col">
            {rows.map((row, i) => (
              <div key={i} className="flex flex-col gap-1 border-t border-black/10 py-5">
                <dt className="font-mono text-12 uppercase tracking-[0.05em] text-muted">{row.label}</dt>
                <dd className="text-15 leading-relaxed text-black lg:text-16">
                  {row.href ? (
                    <a
                      href={row.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-black underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black"
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

        {/* Map: links to MAZJ's real Google listing (Life Tower). */}
        <Reveal delay={120} className="flex items-center justify-center">
          <a
            href={MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex aspect-[4/3] w-full max-w-[560px] items-center justify-center rounded-[16px] bg-beige-card transition-colors hover:bg-beige-card/70"
          >
            <p className="max-w-[280px] text-center font-mono text-12 uppercase tracking-[0.05em] text-brown/60 underline decoration-brown/20 underline-offset-4 group-hover:decoration-brown/50">
              {t("mapPlaceholder")}
            </p>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
