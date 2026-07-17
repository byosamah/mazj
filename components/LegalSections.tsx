import Reveal from "./Reveal";

/**
 * Legal skeleton body for /terms and /privacy: a review-pending notice,
 * heading + body sections, and closing registration lines (ZATCA, CR).
 * All strings arrive already translated.
 */
export default function LegalSections({
  reviewNote,
  sections,
  footLines = [],
}: {
  reviewNote: string;
  sections: Array<{h: string; body: string}>;
  footLines?: string[];
}) {
  return (
    <section className="relative w-full bg-beige px-6 py-16 lg:px-10 lg:py-24">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-10">
        {/* TODO(owner): the body below is a placeholder skeleton pending legal
            review; replace with counsel-approved text before launch. */}
        <Reveal className="rounded-[16px] bg-beige-card p-6">
          <p className="font-mono text-12 uppercase tracking-[0.05em] text-brown/70">{reviewNote}</p>
        </Reveal>

        {sections.map((s, i) => (
          <Reveal as="div" key={i} className="flex flex-col gap-3 border-t border-black/10 pt-8">
            <h2 className="font-sans text-20 font-medium leading-snug text-black lg:text-24">{s.h}</h2>
            <p className="whitespace-pre-line text-15 leading-relaxed text-muted">{s.body}</p>
          </Reveal>
        ))}

        {footLines.length > 0 && (
          <Reveal className="flex flex-col gap-2 border-t border-black/10 pt-8">
            {footLines.map((line, i) => (
              <p key={i} className="font-mono text-12 uppercase tracking-[0.05em] text-muted">
                {line}
              </p>
            ))}
          </Reveal>
        )}
      </div>
    </section>
  );
}
