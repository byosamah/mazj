import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import CtaButton from "./CtaButton";
import {BOOKING} from "@/lib/links";
import {waLink} from "@/lib/contact";

/**
 * Host your event: the Al-Ma'arij hall as a venue. Two CTAs: enquire (goes to
 * the contact page) and book directly on mazj.sa.
 */
export default function HostEvent() {
  const t = useTranslations("HostEvent");

  return (
    <section className="relative w-full bg-beige-card px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="flex flex-col gap-5 lg:ps-[8%]">
          <p className="font-mono text-12 uppercase tracking-[0.05em] text-brown/60">{t("eyebrow")}</p>
          <h2 className="whitespace-pre-line font-sans text-32 font-medium leading-[1.05] text-brown lg:text-50">
            {t("title")}
          </h2>
          <p className="font-mono text-12 uppercase tracking-[0.05em] text-brown/60">{t("features")}</p>
          <p className="mt-2 max-w-[420px] text-15 leading-relaxed text-brown/90 lg:text-16">{t("body")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <CtaButton href={waLink(t("enquireMsg"))} variant="onTan">
              {t("enquireCta")}
            </CtaButton>
            <CtaButton href={BOOKING.event} variant="light">
              {t("bookCta")}
            </CtaButton>
          </div>
        </Reveal>

        <div className="flex items-center justify-center">
          <div className="relative aspect-[4/3] w-full max-w-[560px] overflow-clip rounded-[16px] shadow-[0_10px_32px_rgba(0,0,0,0.12)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/spaces/event.jpg" alt={t("title")} className="h-full w-full object-cover" />
          </div>
        </div>
      </div>
    </section>
  );
}
