import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {pageMetadata} from "@/lib/metadata";
import {useTranslations} from "next-intl";
import PageIntro from "@/components/PageIntro";
import SpaceOffers from "@/components/SpaceOffers";
import Footer from "@/components/Footer";

function Content() {
  const t = useTranslations("SpacesPage");
  return <PageIntro eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} image="/images/spaces/day-desk.jpg" imageRatio="aspect-[4/5]" />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  return pageMetadata(locale, "SpacesPage", "/spaces");
}

export default async function SpacesPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  return (
    <main id="content" tabIndex={-1} className="w-full overflow-x-hidden">
      <Content />
      {/* Absorbs the old /pricing page: all six mazj.sa products, grouped by
          commitment, each with what it includes and where to book it. */}
      <SpaceOffers />
      <Footer />
    </main>
  );
}
