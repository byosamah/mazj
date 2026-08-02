import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {useTranslations} from "next-intl";

import PageIntro from "@/components/PageIntro";
import Reveal from "@/components/Reveal";
import WordReveal from "@/components/WordReveal";
import StartupApplicationForm from "@/components/startups/StartupApplicationForm";
import {pageMetadata} from "@/lib/metadata";

/**
 * The startups & builders offer, explained and applied for.
 *
 * The landing page's purple band has sold this offer since 2026-07-22 and, until
 * now, had nowhere to send anybody: its CTA opened a WhatsApp chat, so interest
 * arrived unstructured, at arbitrary hours, and nothing recorded who had asked.
 *
 * 🔴 THE OFFER STAYS A CLOSED ENVELOPE (owner ruling, `TONE.md` §6, reaffirmed
 * 2026-07-28). Not one line on this page states a discount, an amount, a
 * duration or an inclusion. What the page sells is what MAZJ gives a young
 * company (all three verifiable facts), and it says plainly that the offer
 * itself arrives with the approval. `offerNote` is the sentence carrying that,
 * and it is deliberately not coy about being closed: hiding the fact that the
 * terms are withheld reads worse than owning it.
 *
 * The page is indexable (`lib/routes.ts`). "Coworking for startups in Khobar"
 * is a real query and this is the only page that answers it.
 */

/** Reserved unused frames from the shoot: this one ships nowhere else. */
const PHOTO = "/images/startups.jpg";

function Content() {
  const t = useTranslations("Startups");
  const points = t.raw("offerPoints") as {title: string; body: string}[];
  const steps = t.raw("steps") as {title: string; body: string}[];

  return (
    <>
      <PageIntro
        variant="hero"
        eyebrow={t("eyebrow")}
        title={t("title")}
        intro={t("intro")}
        image={PHOTO}
      />

      {/* What a young company gets. Facts, never terms. */}
      <section className="relative w-full bg-beige px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid-overlay" aria-hidden="true" />

        <div className="relative z-[2] mx-auto w-full max-w-[1400px]">
          <div className="flex flex-col gap-5 border-t border-black/15 pt-5">
            <span className="eyebrow text-12 text-muted">{t("offerEyebrow")}</span>
            {/* A real h2 via WordReveal, so Arabic display glyphs keep the
                1.35 line-height rescue and their descenders are not clipped. */}
            <WordReveal
              as="h2"
              className="max-w-[18ch] whitespace-pre-line text-balance font-sans text-32 font-bold leading-[1.05] text-black lg:text-50 lg:leading-[1.02] lg:tracking-[-1px]"
            >
              {t("offerTitle")}
            </WordReveal>
            <Reveal delay={140}>
              <p className="max-w-[62ch] text-pretty text-15 leading-relaxed text-muted lg:text-18">
                {t("offerBody")}
              </p>
            </Reveal>
          </div>

          <Reveal className="reveal-list mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-[16px] bg-black/12 md:grid-cols-3">
            {points.map((point) => (
              <div key={point.title} className="flex flex-col gap-3 bg-beige p-8 lg:p-10">
                <h3 className="text-balance font-sans text-20 font-bold leading-[1.3] text-black lg:text-24">
                  {point.title}
                </h3>
                <p className="text-pretty text-14 leading-relaxed text-muted lg:text-15">
                  {point.body}
                </p>
              </div>
            ))}
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-8 max-w-[62ch] text-pretty text-14 leading-relaxed text-muted">
              {t("offerNote")}
            </p>
          </Reveal>
        </div>
      </section>

      {/* How the application actually goes. Three steps and a written answer. */}
      <section className="relative w-full bg-beige-card px-6 py-20 lg:px-10 lg:py-28">
        <div className="relative z-[2] mx-auto w-full max-w-[1400px]">
          <div className="flex flex-col gap-5 border-t border-brown/20 pt-5">
            <span className="eyebrow text-12 text-brown/60">{t("howEyebrow")}</span>
            <WordReveal
              as="h2"
              className="max-w-[18ch] whitespace-pre-line text-balance font-sans text-32 font-bold leading-[1.05] text-brown lg:text-50 lg:leading-[1.02] lg:tracking-[-1px]"
            >
              {t("howTitle")}
            </WordReveal>
          </div>

          <Reveal className="reveal-list mt-14 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
            {steps.map((step, i) => (
              <div key={step.title} className="flex flex-col gap-3 border-t border-brown/20 pt-5">
                {/* Coral index, tabular so 01/02/03 align in both locales. */}
                <span className="eyebrow text-12 text-orange tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-balance font-sans text-20 font-bold leading-[1.3] text-brown lg:text-24">
                  {step.title}
                </h3>
                <p className="text-pretty text-14 leading-relaxed text-brown/85 lg:text-15">
                  {step.body}
                </p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* The application. `scroll-mt` clears the fixed header when the in-page
          anchor is used from elsewhere on the site. */}
      <section
        id="apply"
        className="relative w-full scroll-mt-28 bg-beige px-6 py-20 lg:px-10 lg:py-28"
      >
        <div className="grid-overlay" aria-hidden="true" />

        <div className="relative z-[2] mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div className="flex flex-col gap-5 border-t border-black/15 pt-5">
            <span className="eyebrow text-12 text-muted">{t("formEyebrow")}</span>
            <WordReveal
              as="h2"
              className="max-w-[14ch] text-balance font-sans text-32 font-bold leading-[1.05] text-black lg:text-45 lg:leading-[1.02]"
            >
              {t("formTitle")}
            </WordReveal>
            <p className="max-w-[46ch] text-pretty text-15 leading-relaxed text-muted">
              {t("formIntro")}
            </p>
          </div>

          {/* NOT wrapped in Reveal: the form rests at opacity 0 until it
              intersects, and `.reveal` is not no-JS safe. A marketing paragraph
              that never appears is a shame; an application form that never
              appears is the page failing at its only job. */}
          <div>
            <StartupApplicationForm />
          </div>
        </div>
      </section>
    </>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  return pageMetadata(locale, "Startups", "/startups");
}

export default async function StartupsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  return (
    <main id="content" tabIndex={-1} className="w-full overflow-x-hidden">
      <Content />
    </main>
  );
}
