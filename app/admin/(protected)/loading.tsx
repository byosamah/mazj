import { LoadingLane, PageHead } from "@/components/admin";

/**
 * The index's loading boundary.
 *
 * 🔴 The head is REAL, not a grey block. The eyebrow and the title are static
 * facts about the route, so withholding them buys nothing and costs the reader
 * the one thing they need while they wait: which screen they are on. A boundary
 * that renders a shapeless placeholder where the h1 belongs makes every slow
 * route look like the same broken page.
 *
 * The strings are literals rather than derived from `nav.ts` because they must
 * match `page.tsx`'s own `PageHead` byte for byte. `nav.ts` carries the rail
 * LABEL ("Dashboard") and its group, which is only coincidentally the same
 * word; deriving the pair from it would let the head visibly rewrite itself the
 * moment the data lands, which is the flash this file exists to prevent. The
 * eyebrow moved from "TODAY" to "OVERVIEW" on 2026-07-30 with the page's, and
 * with the nav group above it: nothing on this screen is about today any more.
 *
 * ⚠️ THIS ROUTE USED TO BE THE SLOWEST SURFACE IN THE ADMIN AND IS NOW THE
 * FASTEST. Its old loader recorded 2.8s to 7.8s of assembly against a Rekaz
 * endpoint measured between 1.2s and 10.8s. The page it wraps today reads three
 * Postgres counts in parallel, measured at ~39ms each from the same city, and the
 * rail one component up has already run the identical `cache()`d call. So two
 * skeleton rows rather than six, because a skeleton longer than the real content
 * is its own kind of lie, and an explicit `note`: `LoadingLane`'s default names
 * Rekaz, which no longer has anything to do with this screen, and it is the
 * sentence somebody reads at the exact moment they have decided this is broken.
 */
export default function AdminIndexLoading() {
  return (
    <div className="space-y-10">
      <PageHead eyebrow="OVERVIEW" title="Dashboard" />
      <LoadingLane
        rows={2}
        label="the dashboard"
        note="This reads MAZJ's own database and is normally instant. If it is not, the database is the thing to look at, not Rekaz."
      />
    </div>
  );
}
