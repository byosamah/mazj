import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import CtaButton from "./CtaButton";
import {waLink} from "@/lib/contact";

/**
 * Founding Members: the launch offer. MAZJ is new, so the honest, on-guardrail
 * play is exclusivity, not fake popularity: the first 15 to join become
 * founding members. No prices here (amounts + checkout live on mazj.sa); the
 * CTA opens a real WhatsApp chat to claim a spot.
 */
export default function FoundingBand() {
  const t = useTranslations("Founding");
  const perks = t.raw("perks") as string[];

  return (
    <section className="relative w-full bg-purple px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col items-center gap-8 text-center">
        <Reveal className="flex flex-col items-center gap-5">
          {/* purple-dark/80 is the lowest step on Tailwind's opacity scale that clears
              WCAG AA 4.5:1 on bg-purple: /70 composites to #5f4b90 = 3.85:1 (fail),
              /80 to #503c81 = 4.83:1 (pass). The true 1% minimum is /77 (4.51:1), too
              thin a margin to spend on an 11-12px label. */}
          <p className="eyebrow text-12 text-purple-dark/80">{t("eyebrow")}</p>
          <h2 className="whitespace-pre-line text-balance font-sans font-bold text-40 leading-[1.0] text-purple-dark lg:text-70 lg:leading-[0.98] lg:tracking-[-1.2px]">
            {t("title")}
          </h2>
          <p className="mt-2 max-w-[560px] text-pretty text-15 leading-relaxed text-purple-dark/90 lg:text-18">{t("body")}</p>
        </Reveal>

        <Reveal
          as="ul"
          delay={120}
          className="flex flex-col flex-wrap items-center justify-center gap-x-8 gap-y-3 sm:flex-row"
        >
          {perks.map((p) => (
            <li key={p} className="flex items-center gap-2 text-14 text-purple-dark lg:text-15">
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-purple-dark/50" />
              {p}
            </li>
          ))}
        </Reveal>

        <Reveal delay={200} className="mt-2 flex flex-col items-center gap-3">
          <CtaButton href={waLink(t("ctaMsg"))} variant="onLavender">
            {t("cta")}
          </CtaButton>
          <p className="eyebrow text-11 text-purple-dark/80">{t("note")}</p>
        </Reveal>
      </div>
    </section>
  );
}
