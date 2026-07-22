import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import WordReveal from "./WordReveal";
import CtaButton from "./CtaButton";

export default function Steps() {
  const t = useTranslations("Steps");

  return (
    <section className="relative w-full bg-beige">
      {/* Intro — "How MAZJ Works" over the warm reach-for-the-sun panel */}
      <div className="relative flex min-h-[92vh] w-full items-center justify-center overflow-clip">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/process-bg.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-orange/10 via-transparent to-orange/25" />
          {/* Warm-dark readability scrim behind the centred heading: the sunlit
              window is very bright, so the white sans copy needs contrast to read.
              Radial so the warm golden edges of the room stay bright.
              Sized/weighted from measurement, not taste: at 72%x58% / 0.62 the
              body-copy band under the heading measured 3.76:1 median against
              the white 15px copy at 320w, with 27% of the band over luma 160
              (as low as 1.68:1) where the window slats show through. The wider
              80%x68% ellipse reaches the paragraph + CTA band on tall phone
              aspect ratios and 0.72 lifts the median past AA; the glyph-local
              text-shadow on the column below covers the bright-slat tail the
              radial cannot reach without flattening the golden edges. */}
          <div
            className="absolute inset-0"
            aria-hidden="true"
            style={{background: "radial-gradient(80% 68% at 50% 48%, rgba(28,14,4,0.72), rgba(28,14,4,0) 78%)"}}
          />
        </div>
        {/* text-shadow inherits to every descendant (heading, body, CTA label),
            the same over-bright-media idiom as the hero h1 and WhyMazj. */}
        <div className="relative z-10 mx-auto flex max-w-[920px] flex-col items-center gap-7 px-6 text-center [text-shadow:0_1px_14px_rgba(0,0,0,0.55)]">
          <div className="flex flex-col items-center gap-6">
            <Reveal as="p" className="eyebrow text-12 text-beige/85">{t("eyebrow")}</Reveal>
            <WordReveal
              as="h2"
              className="font-sans font-bold text-40 leading-[1.02] text-beige lg:text-85 lg:leading-[0.98] lg:tracking-[-1.7px]"
            >
              {t("title")}
            </WordReveal>
            <Reveal as="p" className="max-w-[560px] text-pretty tabular-nums text-15 leading-[1.5] text-beige/90 lg:text-16" delay={120}>{t("body")}</Reveal>
          </div>
          {/* DESIGN-SYSTEM SMELL: this needs `!important` utilities plus four inline
              CSS custom properties to become a beige outline button over photography.
              StepInto.tsx does the same thing in deep purple. Two call sites fighting
              the component this way means CtaButton is missing a variant (something
              like `outlineOnMedia`). Do not paper over it with a third override:
              add the variant, then delete these. */}
          <Reveal className="mt-2" delay={240}>
            <CtaButton
              href="/spaces"
              variant="light"
              className="!border-beige/40 !bg-transparent [--cta-fg:#fff7e9] [--cta-sweep:#fff7e9] [--cta-fg-hover:#4c2806]"
            >
              {t("qualifyCta")}
            </CtaButton>
          </Reveal>
        </div>
      </div>

      {/* Three full-height process cards on tan */}
      <ProcessCard
        step={t("step1Label")}
        heading={t("step1Heading")}
        sub={t("step1Sub")}
        body={t("step1Body")}
        cta={{label: t("step1Cta"), href: "/spaces"}}
        media={<SubscribeCard />}
      />

      <ProcessCard
        step={t("step2Label")}
        heading={t("step2Heading")}
        sub={t("step2Sub")}
        body={t("step2Body")}
        media={<ReserveCard />}
      />

      <ProcessCard
        step={t("step3Label")}
        heading={t("step3Heading")}
        sub={t("step3Sub")}
        body={t("step3Body")}
        media={<ShowUpCard />}
      />
    </section>
  );
}

function ProcessCard({
  step,
  heading,
  sub,
  body,
  cta,
  media,
}: {
  step: string;
  heading: string;
  sub: string;
  body: string;
  cta?: {label: string; href: string};
  media: React.ReactNode;
}) {
  return (
    <div
      data-fx="pin-card"
      className="flex min-h-[calc(100svh-0.375rem)] w-full items-center bg-beige-card px-6 py-16 lg:px-10"
    >
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="flex flex-col gap-5 lg:ps-[8%]">
          {/* brown/70 is the LOWEST alpha that clears WCAG AA 4.5:1 on bg-beige-card:
              /60 composites to #8e7456 = 3.53:1 (fail), /70 to #7d6142 = 4.60:1 (pass).
              These are 12px eyebrows, so 4.5 is the bar, not the 3.0 large-text bar. */}
          <p className="eyebrow text-12 tabular-nums text-brown/85">{step}</p>
          <h3 className="mt-6 whitespace-pre-line text-balance font-sans text-32 font-medium leading-[1.05] text-brown lg:text-50">
            {heading}
          </h3>
          <p className="eyebrow text-12 text-brown/85">{sub}</p>
          <p className="mt-2 max-w-[420px] text-pretty tabular-nums text-15 leading-relaxed text-brown/90 lg:text-16">{body}</p>
          {cta && (
            <div className="mt-4">
              <CtaButton href={cta.href} variant="onTan">
                {cta.label}
              </CtaButton>
            </div>
          )}
        </Reveal>

        <div data-pin-media-scale className="flex items-center justify-center">
          {media}
        </div>
      </div>
    </div>
  );
}

/* Portrait orange subscription card with the white MAZJ wordmark ("Subscribe") */
function SubscribeCard() {
  const t = useTranslations("Steps");
  return (
    <div className="relative isolate aspect-[3/4] w-full max-w-[300px] overflow-clip rounded-[16px] bg-orange shadow-[0_10px_32px_rgba(0,0,0,0.12)]">
      {/* the original animated orange dune video, recolored below.
          Decorative, so aria-hidden. preload="none" because this card is far
          below the fold: the 383 KB clip should not compete with first paint.
          It has no poster, and does not need one, the card's own bg-orange IS
          the colour the recolored video resolves to. */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover [filter:brightness(0.78)]"
        aria-hidden="true"
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        src="/videos/step-card.mp4"
      />

      {/* Recolor the baked-orange dune to the exact brand coral (#FF5A48), the
          same technique as the hero window and the footer dune. This clip is the
          hero's own footage re-cropped to portrait (mean luma 138.0 vs the hero's
          138.2), so the identical brightness(0.78) lands it on the identical
          coral. blend:color keeps the source's luminosity, so the dim is what
          sets the final lightness. `isolate` on the card scopes the blend.
          This sits above the video but BELOW the wordmark: blend:color would
          otherwise steal the hue and repaint the white mark coral. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-orange mix-blend-color" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/mazj-wordmark.png"
          alt="MAZJ"
          className="h-auto w-[128px] [filter:brightness(0)_invert(1)]"
        />
        <p className="eyebrow text-12 text-white/90">{t("subscribeTag")}</p>
      </div>
    </div>
  );
}

/* Real MAZJ space photo, framed as a rounded card ("Reserve your space") */
function ReserveCard() {
  const t = useTranslations("Steps");
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative aspect-[3/4] w-full max-w-[300px] overflow-clip rounded-[16px] shadow-[0_10px_32px_rgba(0,0,0,0.12)] after:pointer-events-none after:absolute after:inset-0 after:rounded-[16px] after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] after:content-['']">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/step-reserve.jpg"
          alt={t("reserveAlt")}
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

/* Real MAZJ shared-space photo ("Just show up") — same frame as ReserveCard.
   Replaces the old solar-template energy-dashboard mock. */
function ShowUpCard() {
  const t = useTranslations("Steps");
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative aspect-[3/4] w-full max-w-[300px] overflow-clip rounded-[16px] shadow-[0_10px_32px_rgba(0,0,0,0.12)] after:pointer-events-none after:absolute after:inset-0 after:rounded-[16px] after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] after:content-['']">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/spaces/membership.jpg"
          alt={t("showUpAlt")}
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}
