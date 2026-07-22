import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import CtaButton from "./CtaButton";

/**
 * Host your event: the Al-Ma'arij hall as a venue, with a single self-serve
 * CTA into the hall's own space page (booking happens there, on mazj.sa).
 */
export default function HostEvent() {
  const t = useTranslations("HostEvent");

  return (
    <section className="relative w-full bg-beige-card px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="flex flex-col gap-5 lg:ps-[8%]">
          <p className="eyebrow text-12 text-brown/60">{t("eyebrow")}</p>
          <h2 className="whitespace-pre-line text-balance font-sans text-32 font-medium leading-[1.05] text-brown lg:text-50">
            {t("title")}
          </h2>
          <p className="eyebrow text-12 text-brown/60 tabular-nums">{t("features")}</p>
          <p className="mt-2 max-w-[420px] text-15 leading-relaxed tabular-nums text-brown/90 lg:text-16 [text-wrap:pretty]">{t("body")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {/* Al-Ma'arij is a space, not an "event", so this stays inside the
                /spaces branch. /events is now MAZJ's own workshops and meetups.
                The old "ask about a date" WhatsApp CTA is gone: the hall page
                books itself, and a second button to the same place is noise. */}
            <CtaButton href="/spaces/event-hall" variant="onTan">
              {t("bookCta")}
            </CtaButton>
          </div>
        </Reveal>

        <Reveal delay={120} className="flex items-center justify-center">
          <div className="relative aspect-[4/3] w-full max-w-[560px] overflow-clip rounded-[16px] shadow-[0_10px_32px_rgba(0,0,0,0.12),inset_0_0_0_1px_rgba(0,0,0,0.1)]">
            {/* The alt describes the PHOTOGRAPH — it must never be t("title"):
                that is verbatim the <h2> in the other half of this grid, and it
                once made the heading announce twice in a row. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/spaces/event.jpg" alt={t("photoAlt")} className="h-full w-full object-cover" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
