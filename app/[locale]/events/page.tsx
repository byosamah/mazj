import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {useTranslations} from "next-intl";

import PageIntro from "@/components/PageIntro";
import PastEvents from "@/components/events/PastEvents";
import UpcomingEvents from "@/components/events/UpcomingEvents";
import {pageMetadata} from "@/lib/metadata";

import {loadEventsPage} from "./_lib/events";

/**
 * The events programme.
 *
 * ⚠️ This route was static copy until 2026-07-28: three fabricated "Example"
 * cards and 41 hand-typed archive rows living in `messages/{en,ar}.json`. It now
 * reads real rows, and an event moves itself from "coming up" into the archive
 * when its end time passes. That transition is computed at read time from
 * `ends_at`, so there is no scheduled job, no status to flip, and nothing to
 * forget.
 *
 * ⚠️ `Event` JSON-LD still does NOT belong on THIS page, though the reason has
 * changed. It used to be forbidden because the entries were invented; now it is
 * simply the wrong page. Google wants one `Event` node per event, on that
 * event's own URL, which is what `/events/[slug]` emits. A list page marking up
 * everything on it, including events that finished in 2022, is markup with no
 * rich result available and a manual-action surface for no gain.
 * The sitewide `LocalBusiness` node in `[locale]/layout.tsx` already covers this
 * page.
 */
export const dynamic = "force-dynamic";

function Content() {
  const t = useTranslations("EventsPage");
  return (
    <PageIntro
      variant="hero"
      eyebrow={t("eyebrow")}
      title={t("title")}
      intro={t("intro")}
      image="/images/spaces/event.jpg"
    />
  );
}

/**
 * The honest failure.
 *
 * 🔴 NOT a fallback to the old hardcoded archive. If the database cannot be
 * reached, this page says so. Quietly serving a frozen copy of the programme
 * would hide a broken data path behind a page that looks fine, and the first
 * person to notice would be somebody who turned up to an event that had been
 * cancelled a week earlier.
 */
function LoadFailed() {
  const t = useTranslations("EventsPage");
  return (
    <section className="relative w-full bg-beige px-6 py-24 lg:px-10 lg:py-32">
      <div className="grid-overlay" aria-hidden="true" />
      <div className="relative z-[2] mx-auto w-full max-w-[1400px]">
        <p
          role="status"
          className="max-w-[52ch] text-pretty border-t border-black/15 pt-6 text-15 leading-relaxed text-muted"
        >
          {t("loadFailed")}
        </p>
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
  return pageMetadata(locale, "EventsPage", "/events");
}

export default async function EventsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  const data = await loadEventsPage(locale);

  return (
    <main id="content" tabIndex={-1} className="w-full overflow-x-hidden">
      <Content />
      {/* What is announced comes first: a visitor asking "is anything on?"
          should not have to scroll past four years of history to find out.
          Renting the hall lives on /spaces/event-hall. */}
      {data ? (
        <>
          <UpcomingEvents events={data.upcoming} />
          <PastEvents events={data.past} />
        </>
      ) : (
        <LoadFailed />
      )}
    </main>
  );
}
