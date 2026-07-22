import {useTranslations} from "next-intl";
import CtaButton from "./CtaButton";
import Reveal from "./Reveal";
import WordReveal from "./WordReveal";
import {BOOKING} from "@/lib/links";

export default function StepInto() {
  const t = useTranslations("StepInto");

  return (
    <section className="relative w-full overflow-clip bg-purple">
      <div className="grid min-h-svh w-full grid-cols-1 lg:grid-cols-2">
        {/* Text column */}
        <div className="flex flex-col justify-between gap-16 px-6 py-16 lg:px-12 lg:py-[65px]">
          <WordReveal
            as="h2"
            className="font-sans font-bold text-40 leading-[1.0] text-purple-dark lg:text-85 lg:leading-[0.98] lg:tracking-[-1.7px]"
          >
            {`${t("titleLine1")}\n${t("titleLine2")}`}
          </WordReveal>

          <Reveal className="flex max-w-[440px] flex-col gap-5" delay={120}>
            {/* small deep-purple MAZJ mark (masked so colour is exact) */}
            <span
              aria-hidden="true"
              className="block h-[26px] w-[35px]"
              style={{
                backgroundColor: "#321f61",
                WebkitMaskImage: "url(/logos/mazj-wordmark.png)",
                maskImage: "url(/logos/mazj-wordmark.png)",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskPosition: "center",
                maskPosition: "center",
              }}
            />
            <p className="eyebrow text-12 text-purple-dark">{t("eyebrow")}</p>
            <p className="text-15 leading-[1.5] text-purple-dark lg:text-16 text-pretty">{t("body")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <CtaButton href="/spaces" variant="onLavender">
                {t("qualifyCta")}
              </CtaButton>
              <CtaButton
                href={BOOKING.sharedSeat}
                variant="light"
                className="!border-purple-dark/40 [--cta-fg:#321f61] [--cta-sweep:#321f61] [--cta-fg-hover:#c8b0ff]"
              >
                {t("dayPassCta")}
              </CtaButton>
            </div>
            {/* /80 is the lowest Tailwind opacity step clearing WCAG AA 4.5:1 on
                bg-purple: /70 = #5f4b90 = 3.85:1 (fail), /80 = #503c81 = 4.83:1. */}
            <p className="max-w-[420px] text-13 leading-[1.5] text-purple-dark/95 text-pretty">{t("dayPassNote")}</p>
          </Reveal>
        </div>

        {/* Media column — sunlit room photo with a floating square video card */}
        <div className="relative min-h-[62vh] overflow-clip lg:min-h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/step-into.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div data-fx="rise" className="relative aspect-square w-full max-w-[405px] overflow-clip rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.24),inset_0_0_0_1px_rgba(0,0,0,0.1)]">
              {/* Decorative (aria-hidden) and below the fold, so preload="none":
                  688 KB that should not compete with first paint. The poster stays,
                  it is what shows until the clip is actually requested. */}
              <video
                className="h-full w-full object-cover"
                aria-hidden="true"
                autoPlay
                muted
                loop
                playsInline
                preload="none"
                poster="/images/step-into-video.jpg"
                src="/videos/step-into.mp4"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
