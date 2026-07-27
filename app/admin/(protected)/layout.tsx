import { signOut } from "../_lib/actions";
import { requireAdmin } from "../_lib/auth";

/**
 * Everything under here requires a signed-in `@mazj.org` admin.
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
 * `/admin/login` deliberately sits OUTSIDE this group. Inside it, the guard
 * would redirect an anonymous visitor to the login page, whose own render would
 * redirect them again, forever.
 */
export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAdmin();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-10 flex flex-wrap items-baseline justify-between gap-4 border-b border-black/10 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MAZJ Admin</h1>
          <p className="mt-1 text-sm text-black/50">
            Operations, live from Rekaz
          </p>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-black/60">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-black/15 px-4 py-1.5 text-sm transition-colors hover:border-black/40 hover:bg-black/5"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {children}
    </div>
  );
}
