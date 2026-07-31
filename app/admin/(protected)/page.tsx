import { ExternalLink } from "lucide-react";
import Link from "next/link";

import {
  Btn,
  Metric,
  Notice,
  PageHead,
  Panel,
  Section,
} from "@/components/admin";

import { requireAdmin } from "../_lib/auth";
import { loadNavCounts } from "../_lib/nav-counts";
import { ADMIN_NAV, adminHref, type AdminNavItem } from "../nav";

/**
 * The admin's index.
 *
 * 🔴 IT READS NOTHING FROM REKAZ, AND THAT IS THE POINT (owner ruling,
 * 2026-07-30). This page used to be an operations dashboard: a live room
 * occupancy board, today's bookings, the next seven days, subscription totals
 * and renewals, all crawled out of the Rekaz API on every open. All of it is
 * deleted, because MAZJ manages bookings and memberships in Rekaz's own
 * platform and a second copy of somebody else's records is worth less than
 * nothing: it can only ever be staler than the screen it duplicates, and the
 * day the two disagree the reader has no way to tell which one is lying.
 *
 * What the deletion also buys, and the reason not to reintroduce a tile "just
 * for reference": that API is the SAME instance that serves mazj.sa's live
 * checkout. It was recorded answering between 1.2s and 10.8s, this page took
 * 2.8s to 7.8s to assemble, and it needed a 60-second shared cache plus a
 * Refresh button plus three separate "this may be incomplete" warnings to be
 * honest about what it was showing. All of that machinery existed to manage one
 * dependency. The dependency is gone, so the machinery is gone with it: no
 * cache, no refresh control, no health strip, and nothing on this screen that
 * can be stale by more than one Postgres query.
 *
 * `force-dynamic` still applies, and for the original reason: the page reads the
 * auth cookie, so it must never be prerendered or shared between admins.
 *
 * 🔴 It still ships ZERO client components. The two that render on this route
 * both arrive from elsewhere (the layout's rail, and the `error.tsx` boundary
 * beside this file), and `test/admin-page-guards.test.ts` pins that set by name.
 */
export const dynamic = "force-dynamic";

/**
 * Where MAZJ's bookings, rooms, memberships and money actually live.
 *
 * The same host the API base is built on (`REKAZ_API_BASE` in `.env.example`,
 * whose own comment routes you to "platform.rekaz.io > User Management > API
 * Keys" for the credential), so this is Rekaz's real operator sign-in and not a
 * marketing page. It is deliberately a bare origin: any deeper path is a route
 * inside somebody else's product, and a link that 404s from our chrome reads as
 * our fault.
 */
const REKAZ_PLATFORM = "https://platform.rekaz.io";

export default async function AdminIndexPage() {
  // 🔴 AUTHORISED HERE TOO, not only by the layout, and above the first data
  // read. React renders a route's components concurrently rather than
  // parent-then-child, so the layout's `redirect()` throw does not stop this
  // component: measured on an anonymous `curl /admin` before this line existed,
  // the response was a correct 307 to `/admin/login` AND carried 28KB of
  // rendered dashboard. `test/admin-page-guards.test.ts` fails if any page under
  // `(protected)/` omits it, or puts it below the load.
  //
  // Belt and braces: `loadNavCounts` REQUIRES the `AdminUser` this returns, so
  // forgetting the guard is a compile error rather than a leak a regex has to
  // notice.
  const admin = await requireAdmin();

  // 🔴 THE SAME CALL THE RAIL MAKES, on purpose, and it costs nothing extra:
  // `loadNavCounts` is wrapped in React's `cache()`, so the layout and this page
  // share ONE execution per request. Two loaders would be two definitions of
  // "coming up" and "waiting on you", and the badge in the chrome disagreeing
  // with the card in the content is the exact class of defect this admin is
  // built against. Postgres only, ~40ms, and a failed count arrives as `null`
  // rather than as a confident zero.
  const counts = await loadNavCounts(admin);

  const sections = ADMIN_NAV.filter((item) => item.segment);
  const unsent = counts["startups:alarm"];

  return (
    <div className="space-y-10 lg:space-y-12">
      <PageHead
        eyebrow="OVERVIEW"
        title="Dashboard"
        lede="What is waiting on you. Bookings, rooms and memberships live in Rekaz, not here."
        /* 🔴 ABOVE EVERYTHING IT AFFECTS, and absent on every ordinary day.
           Absence is the all-clear here, the same zero-suppression the rail's
           badges use: a notice that is always present is a notice nobody reads.
           This is the one state in the whole admin where somebody outside MAZJ
           is waiting on an answer we already decided and never sent, and it is
           invisible on the application row itself, which looks answered.

           🔴 A FUNCTION CALL, NOT `<UnsentDecisions />`. `PageHead` renders its
           notice slot inside `{notice && <div className="mt-6">…</div>}`, and a
           React element is truthy even when the component returns nothing, so a
           component here would open an empty 24px box above the first section on
           every quiet day. `undefined` is the only value that closes the slot. */
        notice={unsentDecisions(unsent)}
      />

      <Section
        eyebrow="OPEN WORK"
        title="What needs you"
        subtitle="The same figures as the rail, from the same query"
        ruled={false}
      >
        {/* Derived from `nav.ts` rather than written out here, so a section added
            there gets a card without anybody remembering this file. The index
            entry is filtered out above: a card linking to the page it is on. */}
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((item) => (
            <SectionCard
              key={item.segment}
              item={item}
              count={counts[item.segment]}
            />
          ))}
        </div>
      </Section>

      <Section
        eyebrow="ELSEWHERE"
        title="Bookings, rooms and memberships"
        subtitle="Rekaz's records, on Rekaz's screens"
      >
        <p className="max-w-[62ch] text-pretty text-14 leading-[1.6] text-subtle-foreground">
          Reservations, room occupancy, subscriptions and payments are managed in
          the Rekaz platform. No screen here reads them, so nothing in this tool
          can disagree with what Rekaz shows you.
        </p>

        <p className="mt-4">
          {/* The underlined-anchor idiom, matching the public event links on
              `/admin/events/[id]`: this is a departure from the tool, not a
              control inside it, and a solid button would read as the latter. */}
          <a
            href={REKAZ_PLATFORM}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center gap-2 text-13 underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            Open the Rekaz platform
            <span className="sr-only"> (opens in a new tab)</span>
            <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
          </a>
        </p>
      </Section>
    </div>
  );
}

/**
 * One section of the admin, with the one number that says whether it needs you.
 *
 * 🔴 `?? null` is load-bearing rather than defensive. `NavCounts` is a
 * `Partial` record, so an absent key reads as `undefined`, and `Metric` renders
 * `null` as the WORDS "Not counted" while it renders `0` as a figure. Coercing
 * either silence to a zero would put "0 waiting on you" on the screen for a
 * query that failed, which is the one lie this admin is most careful about: a
 * founder's application sitting unread behind a confident nought.
 *
 * The hint is `nav.ts`'s own, not a second sentence written here. The rail says
 * the same thing under the same label, and one fact stated twice is two places
 * to keep true.
 */
function SectionCard({
  item,
  count,
}: {
  item: AdminNavItem;
  count: number | null | undefined;
}) {
  return (
    <Panel className="flex flex-col gap-5">
      {/* The figure sits BESIDE the name rather than under it. Stacked, each card
          was three blocks tall to carry four short lines, and at the 1120px lane
          two of them left the whole right half of every card empty. `items-start`
          because the hint wraps to two lines at some widths and the number must
          stay on the name's baseline row, not drift down with it. */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h3 className="text-15 font-medium">{item.label}</h3>
          <p className="mt-1 text-13 text-subtle-foreground">{item.hint}</p>
        </div>

        {item.countLabel && (
          <div className="shrink-0 text-end">
            <Metric label={item.countLabel} value={count ?? null} />
          </div>
        )}
      </div>

      {/* `mt-auto` so the controls line up across cards whose hints wrap to
          different heights. Two ragged buttons read as two different kinds of
          card. */}
      <div className="mt-auto">
        <Btn asChild variant="quiet" size="sm">
          <Link href={adminHref(item)}>Open {item.label}</Link>
        </Btn>
      </div>
    </Panel>
  );
}

/**
 * Decisions that were made and never delivered.
 *
 * 🔴 A DECISION AND ITS EMAIL ARE TWO FACTS. The decision commits before the
 * email is attempted and a mail failure deliberately does not roll it back
 * (`server/services/startup-application.ts`), so this state is normal, silent,
 * and invisible on the application row, which looks answered. Somebody outside
 * MAZJ is waiting on a code that exists only in our database.
 *
 * Renders nothing on `0`, on `null` and on `undefined`, which collapses "there
 * are none" and "we could not find out" into the same silence. That collapse is
 * wrong nearly everywhere else in this admin and is right here: the count is an
 * ALARM, and an alarm that fires because a query failed is an alarm people learn
 * to ignore. The section it points at reports its own failures honestly.
 *
 * A function rather than a component, because the caller needs a real
 * `undefined` to close `PageHead`'s notice slot. See the call site.
 */
function unsentDecisions(count: number | null | undefined): React.ReactNode {
  if (typeof count !== "number" || count === 0) return undefined;

  return (
    <Notice
      tone="destructive"
      detail="The decision saved. The email did not leave the building, so nothing has reached them yet."
      action={
        <Btn asChild variant="quiet" size="sm">
          <Link href="/admin/startups">Open Startups</Link>
        </Btn>
      }
    >
      {count === 1
        ? "One startup application was decided and the founder was never told."
        : `${count} startup applications were decided and the founders were never told.`}
    </Notice>
  );
}
