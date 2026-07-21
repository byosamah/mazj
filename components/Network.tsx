import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import WordReveal from "./WordReveal";
import CtaButton from "./CtaButton";

export default function Network() {
  const t = useTranslations("Network");

  return (
    <section className="relative flex min-h-svh w-full items-center justify-center overflow-clip bg-beige px-6 pb-[60px] pt-[140px] lg:pt-[150px]">
      {/* faint dotted network field */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[80%] w-[94%] max-w-[1240px] -translate-x-1/2 -translate-y-1/2 dot-field" />
      {/* real home photo at the centre of the network */}
      <div className="pointer-events-none absolute inset-0 z-0 hidden items-center justify-center lg:flex">
        <div className="relative h-[500px] w-[380px]">
          <div
            className="absolute inset-0 overflow-clip rounded-[16px] opacity-[0.22]"
            style={{
              WebkitMaskImage: "radial-gradient(75% 70% at 50% 50%, #000 40%, transparent 100%)",
              maskImage: "radial-gradient(75% 70% at 50% 50%, #000 40%, transparent 100%)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/network-bg.jpg" alt="" className="h-full w-full object-cover" />
          </div>
        </div>
      </div>
      {/* cream scrim so the centred copy stays crisp over the imagery */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-[5] h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/2"
        style={{background: "radial-gradient(closest-side, rgba(255,247,233,0.82), rgba(255,247,233,0))"}}
        aria-hidden="true"
      />

      <div className="relative z-10 flex max-w-[960px] flex-col items-center gap-7 text-center">
        <Reveal as="p" className="eyebrow text-12 text-muted">{t("eyebrow")}</Reveal>
        <WordReveal
          as="h2"
          className="max-w-[900px] font-sans font-bold text-40 leading-[1.03] text-black lg:text-85 lg:leading-[0.98] lg:tracking-[-1.7px]"
        >
          {`${t("titleLine1")}\n${t("titleLine2")}`}
        </WordReveal>
        <Reveal as="p" className="max-w-[560px] text-15 leading-[1.5] text-muted lg:text-16 text-pretty" delay={120}>{t("body")}</Reveal>
        <Reveal delay={200}>
          {/* "Join MAZJ" is a membership action, so it lands on /spaces (the
              booking menu). /community was removed: it's a future plan. */}
          <CtaButton href="/spaces" variant="dark">
            {t("qualifyCta")}
          </CtaButton>
        </Reveal>
      </div>
    </section>
  );
}
