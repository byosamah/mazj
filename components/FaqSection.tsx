import {useTranslations} from "next-intl";
import Reveal from "./Reveal";

/**
 * FAQ list. Reads the shared "Faq" namespace so the landing section and the
 * /faq page render the identical Q&As. Plain stacked text on hairline rules;
 * no new interactive pattern.
 */
export default function FaqSection({showHeader = true}: {showHeader?: boolean}) {
  const t = useTranslations("Faq");
  const items = t.raw("items") as Array<{q: string; a: string}>;

  return (
    <section className="relative w-full bg-beige px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-12">
        {showHeader && (
          <Reveal className="flex flex-col items-center gap-5 text-center">
            <p className="font-mono text-12 uppercase tracking-[0.05em] text-muted">{t("eyebrow")}</p>
            <h2 className="whitespace-pre-line font-sans text-32 font-medium leading-[1.05] text-black lg:text-50">
              {t("title")}
            </h2>
          </Reveal>
        )}

        <dl className="flex flex-col">
          {items.map((item, i) => (
            <Reveal as="div" key={i} delay={Math.min(i, 3) * 60} className="border-t border-black/10 py-7">
              <dt className="font-sans text-18 font-medium leading-snug text-black lg:text-20">{item.q}</dt>
              <dd className="mt-3 max-w-[720px] text-15 leading-relaxed text-muted">{item.a}</dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
