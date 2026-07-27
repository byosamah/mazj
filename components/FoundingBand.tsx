import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import WordReveal from "./WordReveal";
import CtaButton from "./CtaButton";
import {waLink} from "@/lib/contact";

/**
 * Startups & builders offer band. The i18n namespace stays "Founding" from
 * this section's first life as the founding-members offer; only the copy
 * changed. The offer is a deliberate closed envelope: no terms or prices on
 * the site (amounts + checkout live on mazj.sa). The copy leads with the pain
 * (a café table isn't a company), the perks are three verifiable facts, and
 * the CTA opens a real WhatsApp chat where the offer is told in person.
 *
 * Built on the StepInto split-screen idiom (per owner request): the headline
 * sits top-start, the supporting block (wordmark + eyebrow + body + perks +
 * CTA + note) bottom-start, and a full-height workspace photo carries the same
 * floating square loop-video card StepInto uses on the end side. The headline
 * is smaller
 * than StepInto's (this copy is a full sentence, not two short words), sized to
 * hold "Building something?" on one line across the lg range.
 */
export default function FoundingBand() {
  const t = useTranslations("Founding");
  const perks = t.raw("perks") as string[];

  return (
    <section className="relative w-full overflow-clip bg-purple">
      <div className="grid min-h-svh w-full grid-cols-1 lg:grid-cols-2">
        {/* Text column */}
        <div className="flex flex-col justify-between gap-16 px-6 py-16 lg:px-12 lg:py-[65px]">
          <WordReveal
            as="h2"
            className="font-sans font-bold text-32 leading-[1.05] text-purple-dark lg:text-40 lg:leading-[1.0] lg:tracking-[-0.6px] xl:text-50 xl:tracking-[-1.2px]"
          >
            {t("title")}
          </WordReveal>

          <Reveal className="flex max-w-[460px] flex-col gap-5" delay={120}>
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
            <ul className="flex flex-col gap-2.5">
              {perks.map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-14 text-purple-dark lg:text-15">
                  {/* coral marker: the brand accent (decorative, aria-hidden) */}
                  <span aria-hidden="true" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-1 flex flex-wrap items-center gap-4">
              <CtaButton href={waLink(t("ctaMsg"))} variant="onLavender">
                {t("cta")}
              </CtaButton>
            </div>
            {/* /95 clears WCAG AA 4.5:1 on bg-purple (/70 = 3.85:1 fails). */}
            <p className="max-w-[420px] text-13 leading-[1.5] text-purple-dark/95 text-pretty">{t("note")}</p>
          </Reveal>
        </div>

        {/* Media column — coworking photo with StepInto's floating square loop-video card */}
        <div className="relative min-h-[62vh] overflow-clip lg:min-h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/spaces/day-desk.jpg"
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div
              data-fx="rise"
              className="relative aspect-square w-full max-w-[405px] overflow-clip rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.24),inset_0_0_0_1px_rgba(0,0,0,0.1)]"
            >
              {/* The same ambient loop clip as StepInto's card. Decorative
                  (aria-hidden) and below the fold, so preload="none": the
                  poster shows until the clip is actually requested. */}
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
