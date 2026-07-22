import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {pageMetadata} from "@/lib/metadata";
import SpaceBreadcrumbs from "@/components/SpaceBreadcrumbs";
import {useTranslations} from "next-intl";
import PageIntro from "@/components/PageIntro";
import SpaceDetail from "@/components/SpaceDetail";
import SpacesGrid from "@/components/SpacesGrid";
import LocationHours from "@/components/LocationHours";
import Footer from "@/components/Footer";
import {BOOKING} from "@/lib/links";

function Content() {
  const t = useTranslations("SpaceOffice");
  const ts = useTranslations("Spaces");
  const tf = useTranslations("Faq");
  const includes = t.raw("includes") as string[];
  const facts = t.raw("facts") as Array<{label: string; value: string}>;

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} image="/images/spaces/office-month.jpg" imageRatio="aspect-[4/5]" index="02" />
      {/* One CTA: daily and monthly (Hayz) are now durations chosen at mazj.sa
          checkout, not separate products, so both buttons hit the same URL. */}
      <SpaceDetail
        image="/images/spaces/office-month.jpg"
        imageAlt={t("photoAlt")}
        body={t("body")}
        facts={facts}
        includesTitle={t("includesTitle")}
        includes={includes}
        ctas={[{label: t("ctaBook"), href: BOOKING.privateOffice}]}
        aboutTitle={t("aboutTitle")}
        about={t.raw("about") as string[]}
        faqTitle={t("faqTitle")}
        faq={t.raw("faq") as Array<{q: string; a: string}>}
        faqAllLabel={tf("allCta")}
      />
      {/* Sibling strip: someone landing here from search could not reach
          any other space without the global nav. SpacesGrid already had
          `detail`/`showHeader` props built for exactly this. */}
      <SpacesGrid detail showHeader={false} exclude="privateOffice" heading={ts("otherTitle")} />
      {/* Legitimacy tail: these four routes ask for money and carried no
          address, staffed hours, or VAT number anywhere on the page. */}
      <LocationHours />
    </>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  return pageMetadata(locale, "SpaceOffice", "/spaces/private-office");
}

export default async function PrivateOfficePage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  return (
    <main id="content" tabIndex={-1} className="w-full overflow-x-hidden">
      <SpaceBreadcrumbs locale={locale} namespace="SpaceOffice" path="/spaces/private-office" />
      <Content />
      <Footer />
    </main>
  );
}
