import { signOut } from "../_lib/actions";
import { requireAdmin } from "../_lib/auth";
import Sidebar from "./Sidebar";

/**
 * Everything under here requires a signed-in `@mazj.org` admin, and everything
 * under here gets the sidebar.
 *
 * A route group, so `(protected)` never appears in a URL: this layout wraps
 * `/admin` itself, and every page added beside it, without changing a path.
 *
 * 🔴 The guard is in the LAYOUT, not in each page. A new admin page is
 * protected because of where it sits in the tree, not because whoever added it
 * remembered a call. The alternative is one forgotten line away from a page
 * that serves MAZJ's booking data to anyone who guesses its URL, and that line
 * gets forgotten on the day someone is in a hurry.
 *
 * That property is the reason the sidebar lives here too. Adding a section is
 * an entry in `../nav.ts` plus a `page.tsx`; it inherits the auth check and the
 * chrome without either being wired by hand.
 *
 * `/admin/login` deliberately sits OUTSIDE this group. Inside it, the guard
 * would redirect an anonymous visitor to the login page, whose own render would
 * redirect them again, forever.
 */
export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAdmin();

  return (
    <div className="lg:flex">
      <Sidebar email={user.email} />

      {/* `min-w-0` is load-bearing next to a flex sidebar: without it a wide
          child (the reservations table, which scrolls horizontally on purpose)
          sets the flex item's minimum size to its own content width and pushes
          the sidebar off screen instead of scrolling inside its own box. */}
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-end gap-4 border-b border-black/10 px-6 py-4">
          <span className="truncate text-sm text-black/60 lg:hidden">
            {user.email}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-black/15 px-4 py-1.5 text-sm [transition:opacity_200ms,transform_120ms] hover:border-black/40 hover:bg-black/5 active:scale-[0.96]"
            >
              Sign out
            </button>
          </form>
        </header>

        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
