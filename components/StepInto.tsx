import {useLocale, useTranslations} from "next-intl";
import CtaButton from "./CtaButton";
import Reveal from "./Reveal";
import WordReveal from "./WordReveal";
import {bookingUrl} from "@/lib/links";

/**
 * Closing invitation. Deliberately the SIMPLE, type-led counterpart to the
 * FoundingBand split-screen (which now owns the photo + floating-video idiom):
 * a single centred column on the lavender band — eyebrow, a big "Step into
 * MAZJ", one line of body, the two CTAs, and the day-pass note. No media, no
 * card, no decoration; the finale is the wordmark itself, set large, with room
 * around it. (Restraint on purpose — the split-screen version read as a twin.)
 */
export default function StepInto() {
  const t = useTranslations("StepInto");
  const locale = useLocale();

  return (
    <section className="relative w-full bg-purple px-6 py-28 lg:py-40">
      <div className="mx-auto flex max-w-[840px] flex-col items-center gap-7 text-center">
        <p className="eyebrow text-12 text-purple-dark">{t("eyebrow")}</p>
        <WordReveal
          as="h2"
          className="font-sans font-bold text-45 leading-[1.0] text-purple-dark sm:text-70 lg:text-85 lg:leading-[0.98] lg:tracking-[-1.7px]"
        >
          {`${t("titleLine1")}\n${t("titleLine2")}`}
        </WordReveal>
        <Reveal className="flex flex-col items-center gap-7" delay={120}>
          <p className="max-w-[440px] text-15 leading-[1.5] text-purple-dark lg:text-16 text-pretty">
            {t("body")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <CtaButton href="/spaces" variant="onLavender">
              {t("qualifyCta")}
            </CtaButton>
            <CtaButton
              href={bookingUrl("sharedSeat", locale)}
              variant="light"
              className="!border-purple-dark/40 [--cta-fg:#321f61] [--cta-sweep:#321f61] [--cta-fg-hover:#c8b0ff]"
            >
              {t("dayPassCta")}
            </CtaButton>
          </div>
          {/* /95 clears WCAG AA 4.5:1 on bg-purple (/70 = 3.85:1 fails). */}
          <p className="max-w-[440px] text-13 leading-[1.5] text-purple-dark/95 text-pretty">
            {t("dayPassNote")}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
