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
  /**
   * The word after this section's number, e.g. "3 coming up".
   *
   * 🔴 IT LIVES HERE BECAUSE TWO SURFACES RENDER IT. `Sidebar` announces it to a
   * screen reader after the badge (a bare "Startups 3 2" is noise in sequence),
   * and `/admin`'s index card prints it visibly as the figure's label. It was a
   * `COUNT_LABEL` map inside `Sidebar.tsx` while that was the only surface, on
   * the deliberate ground that the word should sit beside where it renders. It
   * now renders in two places, so the choice is no longer proximity versus
   * plain data, it is one definition versus two copies of the same word.
   *
   * Absent where a section publishes no count. Each of these is quoted in the
   * comment above its own query in `_lib/nav-counts.ts`, so a query that changes
   * meaning meets its word.
   */
  countLabel?: string;
  /** Rail grouping. Plain string, mapped to a heading in Sidebar. */
  group: "Overview" | "Programme";
  /**
   * lucide glyph key. 🔴 A STRING, mapped to a component in `Sidebar.tsx`, and
   * that indirection is the whole reason this field is not the icon itself.
   * Importing `LayoutDashboard` here would make this file depend on
   * `lucide-react`, and every module that reads the nav (including the server
   * layout) would pull the icon library with it. A string keeps the promise at
   * the top of this file intact: plain data, no imports, nothing to ship.
   */
  icon: "dashboard" | "events" | "startups";
};

export const ADMIN_NAV: readonly AdminNavItem[] = [
  {
    segment: "",
    // ⚠️ The hint read "Today, occupancy, renewals" until 2026-07-30, when the
    // Rekaz-fed dashboard was deleted (owner ruling: bookings and memberships
    // are managed in Rekaz's own platform, so a second copy of them here is
    // worth less than nothing). Not one of those three words survives on the
    // page, and the group above it was "Today" for the same reason.
    label: "Dashboard",
    hint: "Open work, and where bookings live",
    group: "Overview",
    icon: "dashboard",
  },
  {
    segment: "events",
    label: "Events",
    hint: "Publish events, see who signed up",
    countLabel: "Coming up",
    group: "Programme",
    icon: "events",
  },
  {
    segment: "startups",
    label: "Startups",
    hint: "Applications, offer codes, redemptions",
    countLabel: "Waiting on you",
    group: "Programme",
    icon: "startups",
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
