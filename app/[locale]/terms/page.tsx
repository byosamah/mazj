import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {pageMetadata} from "@/lib/metadata";
import {useTranslations} from "next-intl";
import PageIntro from "@/components/PageIntro";
import LegalSections from "@/components/LegalSections";

function Content() {
  const t = useTranslations("TermsPage");
  const sections = t.raw("sections") as Array<{h: string; body: string}>;

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} />
      <LegalSections
        effectiveLabel={t("effectiveLabel")}
        effectiveDate={t("effectiveDate")}
        sections={sections}
        footLines={[t("cr")]}
      />
    </>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  return pageMetadata(locale, "TermsPage", "/terms", {noindex: true});
}

export default async function TermsPage({
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
