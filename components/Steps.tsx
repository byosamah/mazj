import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import WordReveal from "./WordReveal";
import CtaButton from "./CtaButton";
import {waLink} from "@/lib/contact";

export default function Steps() {
  const t = useTranslations("Steps");
  const tCta = useTranslations("Cta");

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
              Radial so the warm golden edges of the room stay bright. */}
          <div
            className="absolute inset-0"
            aria-hidden="true"
            style={{background: "radial-gradient(72% 58% at 50% 46%, rgba(28,14,4,0.62), rgba(28,14,4,0) 72%)"}}
          />
        </div>
        <div className="relative z-10 mx-auto flex max-w-[920px] flex-col items-center gap-7 px-6 text-center">
          <div className="flex flex-col items-center gap-6">
            <Reveal as="p" className="font-mono text-12 uppercase tracking-[0.05em] text-beige/85">{t("eyebrow")}</Reveal>
            <WordReveal
              as="h2"
              className="font-sans font-bold text-40 leading-[1.02] text-beige lg:text-85 lg:leading-[0.98] lg:tracking-[-1.7px]"
            >
              {t("title")}
            </WordReveal>
            <Reveal as="p" className="max-w-[560px] text-15 leading-[1.5] text-beige/90 lg:text-16" delay={120}>{t("body")}</Reveal>
          </div>
          <Reveal className="mt-2" delay={140}>
            <CtaButton
              href={waLink(tCta("bookTourMsg"))}
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
        cta={{label: t("step1Cta"), href: "/pricing"}}
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
          <p className="font-mono text-12 uppercase tracking-[0.05em] text-brown/60">{step}</p>
          <h3 className="mt-6 whitespace-pre-line font-sans text-32 font-medium leading-[1.05] text-brown lg:text-50">
            {heading}
          </h3>
          <p className="font-mono text-12 uppercase tracking-[0.05em] text-brown/60">{sub}</p>
          <p className="mt-2 max-w-[420px] text-15 leading-relaxed text-brown/90 lg:text-16">{body}</p>
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
    <div className="relative isolate aspect-[3/4] w-full max-w-[300px] overflow-clip rounded-[16px] bg-[#FF5A48] shadow-[0_10px_32px_rgba(0,0,0,0.12)]">
      {/* the original animated orange dune video, recolored below */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover [filter:brightness(0.78)]"
        autoPlay
        muted
        loop
        playsInline
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
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#FF5A48] mix-blend-color" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/mazj-wordmark.png"
          alt="MAZJ"
          className="h-auto w-[128px] [filter:brightness(0)_invert(1)]"
        />
        <p className="font-mono text-12 uppercase tracking-[0.05em] text-white/90">{t("subscribeTag")}</p>
      </div>
    </div>
  );
}

/* Real MAZJ space photo, framed as a rounded card ("Reserve your space") */
function ReserveCard() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative aspect-[3/4] w-full max-w-[300px] overflow-clip rounded-[16px] shadow-[0_10px_32px_rgba(0,0,0,0.12)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/step-reserve.jpg"
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

/* Real MAZJ shared-space photo ("Just show up") — same frame as ReserveCard.
   Replaces the old solar-template energy-dashboard mock. */
function ShowUpCard() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative aspect-[3/4] w-full max-w-[300px] overflow-clip rounded-[16px] shadow-[0_10px_32px_rgba(0,0,0,0.12)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/spaces/membership.jpg"
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}
