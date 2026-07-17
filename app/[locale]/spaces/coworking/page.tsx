import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {pageMetadata} from "@/lib/metadata";
import {useTranslations} from "next-intl";
import PageIntro from "@/components/PageIntro";
import SpaceDetail from "@/components/SpaceDetail";
import Footer from "@/components/Footer";
import {BOOKING} from "@/lib/links";

function Content() {
  const t = useTranslations("SpaceCoworking");
  const includes = t.raw("includes") as string[];
  const facts = t.raw("facts") as Array<{label: string; value: string}>;

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} />
      <SpaceDetail
        image="/images/spaces/day-desk.jpg"
        imageAlt={t("title")}
        body={t("body")}
        facts={facts}
        includesTitle={t("includesTitle")}
        includes={includes}
        ctas={[
          {label: t("ctaDay"), href: BOOKING.dayDesk},
          {label: t("ctaMembership"), href: BOOKING.membership, variant: "light"},
        ]}
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
  return pageMetadata(locale, "SpaceCoworking", "/spaces/coworking");
}

export default async function CoworkingPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  return (
    <main id="content" tabIndex={-1} className="w-full overflow-x-hidden">
      <Content />
      <Footer />
    </main>
  );
}
