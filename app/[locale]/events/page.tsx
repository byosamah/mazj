import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {pageMetadata} from "@/lib/metadata";
import {useTranslations} from "next-intl";
import PageIntro from "@/components/PageIntro";
import UpcomingEvents from "@/components/UpcomingEvents";
import PastEvents from "@/components/PastEvents";
import Footer from "@/components/Footer";

function Content() {
  const t = useTranslations("EventsPage");
  return <PageIntro eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} image="/images/spaces/event.jpg" imageRatio="aspect-[4/5]" />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  return pageMetadata(locale, "EventsPage", "/events");
}

export default async function EventsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  return (
    <main id="content" tabIndex={-1} className="w-full overflow-x-hidden">
      <Content />
      {/* What is announced comes first: a visitor asking "is anything on?"
          should not have to scroll past four years of history to find out.
          Renting the hall lives on /spaces/event-hall. */}
      <UpcomingEvents />
      <PastEvents />
      <Footer />
    </main>
  );
}
