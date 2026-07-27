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
        {/* These three lines are display-sized (45px) but are NOT headings: they are one
            continuous statement broken across three lines, all centered, and card 1 and
            card 3 already own the h2 in this section. Because they render as <span>, the
            `html[lang="ar"] h1,h2,h3 {line-height:1.35}` rescue cannot reach them, so
            `leading-tight` (1.25) would crowd or overlap tall Arabic glyphs at 45px.
            Hence the explicit leading-[1.35], which is safe for Latin at this size too.
            Center-aligned in both locales (symmetric, no RTL mirroring), no text-shadow. */}
        <div className="flex w-full max-w-[1100px] flex-col gap-4">
          <Reveal as="span" className="block text-center font-sans text-20 font-medium leading-[1.35] lg:text-45 [text-wrap:balance]">
            {t("risk1")}
          </Reveal>
          <Reveal as="span" className="block text-center font-sans text-20 font-medium leading-[1.35] lg:text-45 [text-wrap:balance]" delay={120}>
            {t("risk2")}
          </Reveal>
          <Reveal as="span" className="block text-center font-sans text-20 font-medium leading-[1.35] lg:text-45 [text-wrap:balance]" delay={240}>
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
    // min-h (growable), NOT the previous fixed `h-svh min-h-[620px]`: the box
    // wraps copy-driven display text inside overflow-clip, so with a fixed
    // height any copy growth clips silently, bottom-first, with no tell. EN
    // card 3 already consumed ~550px of the 620px floor at 320x568. max() keeps
    // the exact same computed height at every current size (content fits), it
    // only lets a future longer statement grow the card instead of vanish.
    <div
      data-fx="pin-scale"
      className={`relative flex min-h-[max(100svh,620px)] w-full justify-center overflow-clip ${
        align === "top" ? "items-start" : "items-center"
      }`}
    >
      {/* Background footage: purely decorative (aria-hidden), and all three cards sit
          below the fold. preload="none" keeps 2.4 MB of clips (why-onehouse 1.45 MB,
          why-mazj 722 KB, why-risks 224 KB) off the critical path. The poster carries
          the frame until the clip is fetched. */}
      <video
        className="absolute inset-0 z-0 h-full w-full object-cover"
        aria-hidden="true"
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster={poster}
        src={video}
      />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/45 via-black/25 to-black/55" />
      {/* faint hairline grid over the footage */}
      <div className="grid-overlay grid-overlay--light z-[2]" aria-hidden="true" />
      <div
        data-pin-content
        className={`relative z-[3] flex w-full max-w-[1200px] flex-col items-center gap-7 px-6 text-center text-beige ${
          // svh, matching the box's own unit: with vh, iOS's expanded toolbar
          // computes this padding from the LARGER viewport while the box is
          // svh-sized, silently eating the copy's bottom margin inside the clip.
          align === "top" ? "pt-[16svh]" : ""
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
