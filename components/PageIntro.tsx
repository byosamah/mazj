import Reveal from "./Reveal";

/**
 * Standard sub-page opener: eyebrow + display title + optional intro on beige.
 * Top padding clears the fixed header pill. Pages pass already-translated
 * strings, so this stays i18n-agnostic.
 */
export default function PageIntro({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  return (
    <section className="relative w-full bg-beige px-6 pb-10 pt-[150px] lg:px-10 lg:pb-14 lg:pt-[190px]">
      <div className="mx-auto w-full max-w-[1400px]">
        <Reveal className="flex flex-col gap-5">
          <p className="font-mono text-12 uppercase tracking-[0.05em] text-muted">{eyebrow}</p>
          <h1 className="max-w-[900px] whitespace-pre-line font-sans font-bold text-40 leading-[1.04] text-black lg:text-70 lg:leading-[1.02] lg:tracking-[-1.4px]">
            {title}
          </h1>
          {intro && (
            <p className="max-w-[620px] text-15 leading-relaxed text-muted lg:text-18">{intro}</p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
