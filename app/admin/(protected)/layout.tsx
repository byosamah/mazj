import { requireAdmin } from "../_lib/auth";
import { adminEnvironment } from "../_lib/env-marker";
import { loadNavCounts } from "../_lib/nav-counts";
import Sidebar from "./Sidebar";
import SignOutForm from "./SignOutForm";

/**
 * Everything under here requires a signed-in `@mazj.org` admin, and everything
 * under here gets the chrome.
 *
 * A route group, so `(protected)` never appears in a URL: this layout wraps
 * `/admin` itself, and every page added beside it, without changing a path.
 *
 * 🔴 THIS GUARD IS NOT THE SECURITY BOUNDARY, and it stays anyway.
 *
 * It is not the boundary for two independent reasons. React renders a route's
 * components concurrently rather than parent-then-child, so this `redirect()`
 * throw does not cancel the page: measured on an anonymous `curl /admin`, a
 * correct `307 -> /admin/login` whose body still carried 28KB of rendered
 * dashboard including live Rekaz room names and subscription totals. And a
 * crafted `Next-Router-State-Tree` plus `Rsc: 1` makes Next treat this segment
 * as already-rendered and never call it at all.
 *
 * So every page under here calls `await requireAdmin()` above its own first
 * data read, and `test/admin-page-guards.test.ts` fails if one does not. What
 * this call still buys is the thing that check cannot: a human who is simply
 * signed out lands on the login screen instead of a bare refusal.
 *
 * `/admin/login` deliberately sits OUTSIDE this group. Inside it, the guard
 * would redirect an anonymous visitor to the login page, whose own render would
 * redirect them again, forever.
 */
export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAdmin();

  // 🔴 Postgres only, never Rekaz, and it cannot throw. This runs on every
  // admin request; Rekaz is recorded answering between 1.2s and 10.8s and also
  // serves mazj.sa's live checkout, so one call here would make every route as
  // slow as the worst one. See `_lib/nav-counts.ts`.
  const counts = await loadNavCounts(user);

  // "local" | "preview" | "live". Async because `headers()` is async in Next 16.
  const env = await adminEnvironment();

  return (
    <div className="lg:flex">
      {/* `SignOutForm` is a SERVER component passed in as a prop. That is what
          lets `Sidebar` be a client component without importing `_lib/`, which
          can reach the Supabase secret key and the admin-scope Rekaz
          credential. */}
      <Sidebar email={user.email} counts={counts} env={env} signOut={<SignOutForm />} />

      {/* 🔴 `min-w-0` is load-bearing next to a flex sidebar: without it the
          horizontally-scrolling reservation table sets the flex item's minimum
          size to its own content width and pushes the rail off screen instead
          of scrolling inside its own box. */}
      <div className="min-w-0 flex-1">
        {/*
          🔴 THE LANE IS 1120px AND THE SHELL OWNS IT. Derived, not picked:
          1440 viewport − 240 rail − 80 padding = 1120, so it exactly fills a
          laptop and caps beyond it. No page under `(protected)/` may set its
          own `max-w-*` on its root element: four different self-invented caps
          (`max-w-5xl`, `4xl`, `3xl`, `md`) made four screens four widths.
          Narrower measures come from `max-w-[62ch]` on prose and grid templates
          on forms, INSIDE the lane.

          `tabIndex={-1}` is what makes the root layout's skip link move focus
          rather than only scroll.
        */}
        <main
          id="content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1120px] px-6 pb-16 pt-8 md:px-8 lg:px-10 lg:pt-12"
        >
          {children}

          {/* 🔴 WHOSE SESSION THIS IS, BELOW `lg` (1024px, Tailwind's default;
              `tailwind.config.ts` sets no `screens` key).

              The phone and tablet header in `Sidebar.tsx` deliberately drops the
              address: it was the flex child whose `truncate` was a no-op for
              want of `min-w-0`, and whose overflow pushed "Sign out" off the
              right edge. But it cannot simply be absent either. `/admin` is a
              shared internal tool, read on a handed-over phone as often as on a
              laptop, and every irreversible control on `/admin/startups`
              (approve, reject, mark a code used) sends an email in MAZJ's name
              attributed to whoever is signed in. At the END of `<main>` it has
              the whole content lane to itself, with no control beside it to
              displace.

              `lg:hidden` because at 1024 and up the rail foot already carries
              the same address under an eyebrow reading "Signed in"
              (`Sidebar.tsx`), and one fact rendered twice is two places to keep
              true. Those two are the only places the signed-in address is
              RENDERED anywhere under `(protected)/`; the third `user.email` in
              this file is the prop pass to `Sidebar` on line 53.

              `break-all` is load-bearing, the same as in the rail. Measured on
              this class list at a real 390px viewport (Chrome device-metrics
              override, asserted `window.innerWidth === 390`, NOT a cropped wide
              capture) with a 61-character address, against the served admin CSS
              via `/admin/preview`, because the protected route itself cannot be
              photographed without a magic link. WITH `break-all` the span ends
              at x=362.9, inside the lane's 366px right edge, and nothing
              overflows (`scrollWidth` 390 = `clientWidth` 390). WITHOUT it the
              span ends at x=397.9, past both the lane and the viewport, and
              since `app/globals.css:116` sets `body { overflow-x: hidden }`
              there is no scrollbar and no pan to reach the tail: it is simply
              unreadable. Re-measure by overriding device metrics to 390 and
              comparing `getBoundingClientRect().right` on the span against the
              paragraph's.

              Verified at 390 / 768 / 1023 (visible, inside the lane) and at
              1024 / 1440 (`display: none`, so desktop keeps exactly one copy). */}
          <p className="mt-12 border-t border-border pt-4 text-12 text-subtle-foreground lg:hidden">
            Signed in as <span className="break-all">{user.email}</span>
          </p>
        </main>
      </div>
    </div>
  );
}
