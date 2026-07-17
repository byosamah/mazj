import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {pageMetadata} from "@/lib/metadata";
import {useTranslations} from "next-intl";
import PageIntro from "@/components/PageIntro";
import SpaceDetail from "@/components/SpaceDetail";
import Footer from "@/components/Footer";
import {BOOKING} from "@/lib/links";

function Content() {
  const t = useTranslations("SpaceMeeting");
  const includes = t.raw("includes") as string[];
  const facts = t.raw("facts") as Array<{label: string; value: string}>;

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} />
      <SpaceDetail
        image="/images/spaces/meeting.jpg"
        imageAlt={t("title")}
        body={t("body")}
        facts={facts}
        includesTitle={t("includesTitle")}
        includes={includes}
        ctas={[{label: t("cta"), href: BOOKING.meeting}]}
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
  return pageMetadata(locale, "SpaceMeeting", "/spaces/meeting-room");
}

export default async function MeetingRoomPage({
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
