import type {Metadata} from "next";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {pageMetadata} from "@/lib/metadata";
import JsonLd from "@/components/JsonLd";
import {faqPageSchema} from "@/lib/schema";
import {useTranslations} from "next-intl";
import PageIntro from "@/components/PageIntro";
import FaqSection from "@/components/FaqSection";
import Reveal from "@/components/Reveal";
import CtaButton from "@/components/CtaButton";
import Footer from "@/components/Footer";
import {waLink} from "@/lib/contact";

function Content() {
  const t = useTranslations("FaqPage");
  return <PageIntro eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} />;
}

/**
 * Closing plate. The route used to dead-end into the footer: a visitor who read
 * every answer and was ready to book had no CTA anywhere on the page, while the
 * intro copy pointed at "the contact page" as plain unlinked text. Sits on the
 * tan surface so the page ends on a different colour world than the Q&A list.
 */
function Closing() {
  const t = useTranslations("FaqPage");
  return (
    <section className="relative w-full bg-beige px-6 pb-24 lg:px-10 lg:pb-32">
      {/* shares PageIntro's 1400px container, with the plate start-aligned to
          the same 860px reading column the questions use */}
      <div className="mx-auto w-full max-w-[1400px]">
        <Reveal className="flex w-full max-w-[860px] flex-col items-start gap-5 rounded-[16px] bg-beige-card p-10 lg:p-16">
        <h2 className="max-w-[16ch] text-balance font-sans text-32 font-medium leading-[1.05] text-brown lg:text-45">
          {t("closingTitle")}
        </h2>
        <p className="max-w-[52ch] text-pretty text-15 leading-relaxed text-brown/85 lg:text-16">
          {t("closingBody")}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <CtaButton href="/spaces" variant="onTan">
            {t("closingCta")}
          </CtaButton>
          <CtaButton href={waLink(t("closingMsg"))} variant="light">
            {t("closingAlt")}
          </CtaButton>
        </div>
        </Reveal>
      </div>
    </section>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  return pageMetadata(locale, "FaqPage", "/faq");
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  // FAQPage schema off the same `Faq` groups FaqSection renders, flattened.
  // Google requires the marked-up answer to be present on the page: it is, the
  // accordion is a checkbox + CSS-grid collapse, so every answer ships in the
  // HTML and is only visually hidden. Read the groups here rather than passing
  // them down so the schema can never drift from a component's local slice
  // (the landing renders the same section with `limit`, which must NOT be
  // marked up as the full FAQ).
  const t = await getTranslations({locale, namespace: "Faq"});
  const groups = t.raw("groups") as {label: string; items: {q: string; a: string}[]}[];
  const faq = faqPageSchema(groups.flatMap((g) => g.items));

  return (
    <main id="content" tabIndex={-1} className="w-full overflow-x-hidden">
      <JsonLd data={faq} />
      <Content />
      {/* grouped => every question, categorised, each category a real <h2> */}
      <FaqSection showHeader={false} grouped />
      <Closing />
      <Footer />
    </main>
  );
}
