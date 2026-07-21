import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import WordReveal from "./WordReveal";

export default function WhyMazj() {
  const t = useTranslations("Why");

  return (
    <section className="relative w-full bg-beige">
      {/* Card 1 — why mazj */}
      <VideoCard label={t("card1Label")} video="/videos/why-mazj.mp4" poster="/images/why-mazj.jpg" align="top">
        <Statement>{t("card1Statement")}</Statement>
      </VideoCard>

      {/* Card 2 — the risks (three alternating lines) */}
      <VideoCard label={t("risksLabel")} video="/videos/why-risks.mp4" poster="/images/why-risks.jpg" align="center">
        <div className="flex w-full max-w-[1100px] flex-col gap-4 [text-shadow:0_2px_18px_rgba(0,0,0,0.6)]">
          <Reveal as="span" className="block text-start font-sans text-20 font-medium leading-tight lg:text-45 [text-wrap:balance]">
            {t("risk1")}
          </Reveal>
          <Reveal as="span" className="block text-start font-sans text-20 font-medium leading-tight lg:text-end lg:text-45 [text-wrap:balance]" delay={120}>
            {t("risk2")}
          </Reveal>
          <Reveal as="span" className="block text-start font-sans text-20 font-medium leading-tight lg:text-center lg:text-45 [text-wrap:balance]" delay={240}>
            {t("risk3")}
          </Reveal>
        </div>
      </VideoCard>

      {/* Card 3 — One house at a time */}
      <VideoCard label={t("card3Label")} video="/videos/why-onehouse.mp4" poster="/images/why-onehouse.jpg" align="top">
        <Statement>{t("card3Statement")}</Statement>
      </VideoCard>
    </section>
  );
}

function VideoCard({
  label,
  video,
  poster,
  align = "center",
  children,
}: {
  label: string;
  video: string;
  poster: string;
  align?: "top" | "center";
  children: React.ReactNode;
}) {
  return (
    <div
      data-fx="pin-scale"
      className={`relative flex h-svh min-h-[620px] w-full justify-center overflow-clip ${
        align === "top" ? "items-start" : "items-center"
      }`}
    >
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster={poster}
        src={video}
      />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/45 via-black/25 to-black/55" />
      {/* faint hairline grid over the footage */}
      <div className="grid-overlay grid-overlay--light z-[2]" aria-hidden="true" />
      <div
        data-pin-content
        className={`relative z-[3] flex w-full max-w-[1200px] flex-col items-center gap-7 px-6 text-center text-beige ${
          align === "top" ? "pt-[16vh]" : ""
        }`}
      >
        <p className="eyebrow text-12">{label}</p>
        {children}
      </div>
    </div>
  );
}

function Statement({children}: {children: string}) {
  return (
    <WordReveal as="h2" className="max-w-[1100px] font-sans font-bold text-40 leading-[1.04] lg:text-85 lg:leading-[0.98] lg:tracking-[-1.7px]">
      {children}
    </WordReveal>
  );
}
