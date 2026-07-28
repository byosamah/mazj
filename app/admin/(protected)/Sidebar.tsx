"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_NAV, adminHref, isActiveAdminItem } from "../nav";

/**
 * The admin's persistent navigation.
 *
 * 🔴 Uses `next/link` and `next/navigation`, NOT `@/i18n/navigation`. Those are
 * the locale-aware versions, and they would prepend `/en` or `/ar` to every
 * href. The admin sits deliberately outside the locale system (`proxy.ts`
 * excludes it), so `/en/admin/...` does not exist and every link would 404.
 *
 * A client component only because the active item depends on the current path.
 * It reads no data and imports nothing privileged: `../nav` is plain data, which
 * matters because anything reachable from here ships to the browser.
 *
 * Responsive without JavaScript: a fixed rail on desktop, a horizontal strip
 * above the content on small screens. No hamburger, no open/closed state, no
 * way for the menu to get stuck. With one item today and a handful later, a
 * scrolling row is honestly better than a drawer.
 */
export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="flex shrink-0 flex-col border-black/10 lg:h-svh lg:w-64 lg:border-e lg:sticky lg:top-0"
    >
      <div className="border-b border-black/10 px-6 py-5 lg:border-b-0">
        <Link href="/admin" className="block">
          <span className="block text-lg font-semibold tracking-tight">
            MAZJ Admin
          </span>
          <span className="mt-0.5 block text-xs text-black/45">
            Operations, live from Rekaz
          </span>
        </Link>
      </div>

      {/* Horizontal and scrollable on small screens, vertical on desktop. */}
      <ul className="flex gap-1 overflow-x-auto px-4 py-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-4 lg:py-2">
        {ADMIN_NAV.map((item) => {
          const active = isActiveAdminItem(item, pathname);
          return (
            <li key={item.segment || "index"} className="shrink-0 lg:shrink">
              <Link
                href={adminHref(item)}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 transition-colors lg:px-3 lg:py-2.5 ${
                  active
                    ? "bg-black text-beige"
                    : "text-black/70 hover:bg-black/5 hover:text-black"
                }`}
              >
                <span className="block text-sm font-medium">{item.label}</span>
                {/* The hint is desktop-only: on a horizontal strip it would
                    force every item wide enough to push the rest off screen. */}
                <span
                  className={`mt-0.5 hidden text-xs lg:block ${
                    active ? "text-beige/60" : "text-black/40"
                  }`}
                >
                  {item.hint}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="hidden border-t border-black/10 px-6 py-4 lg:block">
        {/* `break-all` because an address long enough to overflow a 256px rail
            would otherwise widen the whole sidebar and shove the content over. */}
        <p className="break-all text-xs text-black/45">{email}</p>
      </div>
    </nav>
  );
}
