import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {pageMetadata} from "@/lib/metadata";
import {useTranslations} from "next-intl";
import PageIntro from "@/components/PageIntro";
import FaqSection from "@/components/FaqSection";
import Footer from "@/components/Footer";

function Content() {
  const t = useTranslations("FaqPage");
  return <PageIntro eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} />;
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

  return (
    <main id="content" tabIndex={-1} className="w-full overflow-x-hidden">
      <Content />
      {/* Same Q&As as the landing section: one shared "Faq" namespace */}
      <FaqSection showHeader={false} />
      <Footer />
    </main>
  );
}
