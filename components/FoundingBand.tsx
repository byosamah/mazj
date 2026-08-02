import Image from "next/image";
import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import WordReveal from "./WordReveal";
import AmbientVideo from "./motion/AmbientVideo";
import CtaButton from "./CtaButton";
import {STARTUP_OFFER} from "@/lib/links";

/**
 * Startups & builders offer band. The i18n namespace stays "Founding" from
 * this section's first life as the founding-members offer; only the copy
 * changed. The offer is a deliberate closed envelope: no terms or amounts on
 * the site. The perks are three verifiable facts, never offer terms.
 *
 * 🔴 The CTA goes to `/startups` (owner decision, 2026-07-28), where the offer
 * is explained and applied for. It used to open a prefilled WhatsApp chat. The
 * envelope stays closed either way: the page sells what MAZJ gives a young
 * company and says the offer itself arrives with the approval email.
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
              {/* 🔴 Goes to `/startups`, NOT to WhatsApp (owner decision,
                  2026-07-28). This band used to open a prefilled chat, which
                  meant every interested founder arrived as an unstructured
                  message at an arbitrary hour, nothing recorded who had asked,
                  and there was no way to answer one properly. `CtaButton`
                  routes an internal path through the locale-aware Link rather
                  than opening a new tab, which is right: applying is part of
                  the journey, not a departure from it.

                  The `Founding.ctaMsg` key that fed the old prefilled message
                  was deleted from both message files in the same change. */}
              <CtaButton href={STARTUP_OFFER} variant="onLavender">
                {t("cta")}
              </CtaButton>
            </div>
            {/* /95 clears WCAG AA 4.5:1 on bg-purple (/70 = 3.85:1 fails). */}
            <p className="max-w-[420px] text-13 leading-[1.5] text-purple-dark/95 text-pretty">{t("note")}</p>
          </Reveal>
        </div>

        {/* Media column — coworking photo with StepInto's floating square loop-video card */}
        <div className="relative min-h-[62vh] overflow-clip lg:min-h-full">
          <Image
            src="/images/spaces/day-desk.jpg"
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center p-8">
            {/* Hairline via `after:`, the MediaFrame idiom, and this is the one
                card on the site where dropping the shadow costs something real:
                it floats over a photograph rather than sitting on the cream
                page, so the shadow WAS doing separation work. It goes anyway,
                because the inset half never rendered (an inset shadow paints
                under the opaque poster filling this overflow-clip box) and
                DESIGN.md lists exactly two things that may float, the
                navigation pill and the skip link. Separation now comes from the
                bright clip against the darker photo plus the rise on scroll. */}
            <div
              data-fx="rise"
              className="relative aspect-square w-full max-w-[405px] overflow-clip rounded-[16px] after:pointer-events-none after:absolute after:inset-0 after:rounded-[16px] after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] after:content-['']"
            >
              {/* The same ambient loop clip as StepInto's card, decorative and
                  below the fold. It carried `preload="none"`, which `autoPlay`
                  overrode: measured at 199 KB fetched in the first 80ms of a
                  cold load. AmbientVideo holds it back until the card is
                  actually approaching. */}
              <AmbientVideo
                src="/videos/step-into.mp4"
                poster="/images/step-into-video.jpg"
                sizes="(min-width: 1024px) 405px, 100vw"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
