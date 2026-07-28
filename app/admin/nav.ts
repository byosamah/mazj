/**
 * The admin's navigation, and the one place to add a feature.
 *
 * Adding a section is two steps and no refactor: append an entry here, and
 * create `app/admin/(protected)/<segment>/page.tsx`. The guard, the chrome and
 * the active state all come for free, because the layout owns them.
 *
 * 🔴 This file must stay dependency-free. It is imported by `Sidebar.tsx`, which
 * is a client component, so anything it pulls in ships to the browser. In
 * particular it must never import from `_lib/`, which is a sanctioned crossing
 * into `@/server` and can reach the Supabase secret key and the admin-scope
 * Rekaz credential. Plain data only.
 */

export type AdminNavItem = {
  /** Path under `/admin`. Use `""` for the index. */
  segment: string;
  label: string;
  /** One line under the label in the sidebar. Keep it concrete. */
  hint: string;
};

export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    segment: "",
    label: "Dashboard",
    hint: "Today, occupancy, renewals",
  },
] as const;

/** Absolute href for a nav item. */
export function adminHref(item: AdminNavItem): string {
  return item.segment ? `/admin/${item.segment}` : "/admin";
}

/**
 * Which item is active for a given pathname.
 *
 * 🔴 The index (`/admin`) has to be matched EXACTLY, not by prefix. Every admin
 * URL starts with `/admin`, so a `startsWith` test would light up Dashboard on
 * every page and the sidebar would show two active items the moment a second
 * section exists.
 *
 * Non-index items DO match by prefix, so a future `/admin/bookings/123` still
 * highlights Bookings.
 */
export function isActiveAdminItem(item: AdminNavItem, pathname: string): boolean {
  const href = adminHref(item);
  if (!item.segment) return pathname === "/admin" || pathname === "/admin/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
