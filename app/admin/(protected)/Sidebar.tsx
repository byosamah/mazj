"use client";

import { CalendarDays, LayoutDashboard, Rocket } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { Chip, StatusDot } from "@/components/admin";

import { ADMIN_NAV, adminHref, isActiveAdminItem, type AdminNavItem } from "../nav";

/**
 * The admin's persistent navigation: a rail on desktop, a header plus a tab grid
 * below it.
 *
 * 🔴 `"use client"` for EXACTLY ONE reason, `usePathname`, plus `useLinkStatus`
 * for the pending bar. It holds no state, and that is a property to defend
 * rather than a coincidence: no drawer, no collapse toggle, no persisted open
 * state, no command palette (owner ruling). Responsive behaviour is three class
 * lists on one markup tree, so there is nothing that can jam open, jam shut, or
 * disagree with the URL.
 *
 * `test/admin-page-guards.test.ts` asserts zero `useState` and `useReducer` in
 * this file's CODE; it blanks comments before scanning, which is why they can be
 * named here. That assertion was written on 2026-07-29. This sentence claimed it
 * for some time before it existed, which is how the next person who wants a
 * collapsible rail would have added state, seen a green suite, and shipped the
 * drawer the ruling above refuses.
 *
 * 🔴 IT IMPORTS NOTHING PRIVILEGED. `../nav` is plain data and `_lib/` is never
 * imported here, because anything reachable from a client component ships to the
 * browser and `_lib/` is a sanctioned crossing into `@/server` that can reach the
 * Supabase secret key and the admin-scope Rekaz credential. Both the counts and
 * the sign-out FORM arrive as props, already rendered on the server.
 *
 * 🔴 `next/link` and `next/navigation`, NEVER next-intl's locale-aware
 * equivalents. Those prepend `/en` or `/ar`, and `/en/admin` does not exist
 * because `proxy.ts` excludes admin from next-intl's matcher, so every link
 * would 404. (The forbidden import path is deliberately not spelled out here:
 * the preservation check for this rule is a plain grep for it across
 * `app/admin`, and a comment quoting it is a false positive.)
 */

type Props = {
  email: string;
  /**
   * Keyed by nav segment, plus `"startups:alarm"`.
   *
   * Restated structurally rather than imported as `NavCounts` from
   * `_lib/nav-counts.ts`, which is the module that owns it: a type-only import
   * is erased at build time, but it puts a path into this file that one dropped
   * `type` keyword turns into a server module in the browser bundle. The two
   * cannot drift regardless, because `(protected)/layout.tsx` passes the real
   * `NavCounts` in and a mismatch is a compile error at that seam.
   */
  counts: Partial<Record<string, number | null>>;
  /** Mirrors `AdminEnvironment` in `_lib/env-marker.ts`, restated for the same reason. */
  env: "local" | "preview" | "live";
  /** `<SignOutForm />`, rendered on the server and handed down. */
  signOut: React.ReactNode;
};

/**
 * The six-glyph budget starts here: three of them.
 *
 * The map is what lets `nav.ts` carry `icon: "events"` as a STRING and stay
 * dependency-free. Every glyph is monochrome `currentColor`, never coral, and
 * never rendered without its text label beside it.
 */
const ICONS = {
  dashboard: LayoutDashboard,
  events: CalendarDays,
  startups: Rocket,
} as const;

/**
 * 🔴 CORAL USE #1 OF 2 IN THE ENTIRE ADMIN: the مزج wordmark.
 *
 * Masked over a solid fill rather than tinted, so the colour is exactly
 * `#FF5A48` and not an approximation of it. The idiom already ships in
 * `components/FoundingBand.tsx:44-58`. There is no icon-only MAZJ symbol; the
 * wordmark PNG is the only mark, and its transparent alpha is what makes this
 * work at all.
 *
 * Module scope, so the object is not rebuilt on every render, and shared by the
 * rail and the phone header, which differ only in box size.
 */
const WORDMARK: React.CSSProperties = {
  backgroundColor: "#FF5A48",
  WebkitMaskImage: "url(/logos/mazj-wordmark.png)",
  maskImage: "url(/logos/mazj-wordmark.png)",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskSize: "contain",
  maskSize: "contain",
  WebkitMaskPosition: "left",
  maskPosition: "left",
};

/**
 * ⚠️ The `COUNT_LABEL` map that stood here moved to `nav.ts` as
 * `AdminNavItem.countLabel` on 2026-07-30, and its own docblock argued against
 * exactly that move: the word belonged "next to where it renders" rather than in
 * `nav.ts`, which stays plain data.
 *
 * That argument held while the rail was the ONLY surface rendering it. `/admin`
 * became an index on the same day and its section cards print the same word
 * visibly, as the label on the figure, so the choice stopped being proximity
 * versus plain data and became one definition versus two copies of one word. A
 * `Record<string, string>` was always plain data; the reason to keep it here was
 * that nothing else read it.
 *
 * A bare "3" in the chrome of every page is still the reason the word exists at
 * all: visually the section label sits beside it, but announced in sequence
 * "Startups 3 2" is noise.
 */

/**
 * Column count for the phone tab grid, resolved to a LITERAL class.
 *
 * Tailwind only emits classes it can see in the source, so
 * `grid-cols-${ADMIN_NAV.length}` compiles to nothing and the grid silently
 * collapses to one column. A fourth section makes it `grid-cols-4`; a fifth
 * wraps onto a second row of the same four columns, which is the whole reason
 * this is a grid and not an `overflow-x-auto` strip that cannot be discovered.
 */
const TAB_COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};
const TAB_GRID = TAB_COLUMNS[ADMIN_NAV.length] ?? "grid-cols-4";

/**
 * The rail's groups, in order of first appearance, computed once at module load
 * because `ADMIN_NAV` is a module constant.
 *
 * `index` is carried through because the numeral is the item's 1-based position
 * in the WHOLE nav, not within its group: `01 02 03` reads as a table of
 * contents, `01 01 02` reads as a bug.
 */
const NAV_GROUPS: { name: AdminNavItem["group"]; items: { item: AdminNavItem; index: number }[] }[] =
  ADMIN_NAV.reduce<
    { name: AdminNavItem["group"]; items: { item: AdminNavItem; index: number }[] }[]
  >((groups, item, index) => {
    const group = groups.find((g) => g.name === item.group);
    if (group) group.items.push({ item, index });
    else groups.push({ name: item.group, items: [{ item, index }] });
    return groups;
  }, []);

/**
 * The second pending signal, after the four `loading.tsx` boundaries.
 *
 * `useLinkStatus` only reports inside its own `<Link>`, which is why this is a
 * component rather than a hook call in the item. If a future Next removes it,
 * DELETE this component and change nothing else: the route-level boundaries are
 * the load-bearing feedback and this is the confirmation that the click landed.
 */
function NavPending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span aria-hidden className="absolute inset-x-2 bottom-0 h-[2px] bg-foreground/25" />
  ) : null;
}

/**
 * Does this count get a badge at all?
 *
 * 🔴 TWO DIFFERENT SILENCES COLLAPSE HERE ON PURPOSE, AND ONLY HERE. `null` is
 * "we could not find out", `0` is "there is nothing", and everywhere else in
 * this admin those must render differently. In a 240px rail there is no room to
 * say either, so both render as absence. Both directions are deliberate: a
 * permanent "0" trains the eye to skip the row it exists to make you notice,
 * and a failed count rendered as "0" is the exact lie the redesign is against.
 * The surface that CAN tell you which one it was is the section's own page, one
 * click away.
 */
function shows(value: number | null | undefined): value is number {
  return typeof value === "number" && value !== 0;
}

/** An ordinary count. No status hue, because a quantity is not a status. */
function CountBadge({
  value,
  label,
}: {
  value: number | null | undefined;
  label?: string;
}) {
  if (!shows(value)) return null;

  return (
    <span className="ms-auto rounded bg-foreground/[0.06] px-1.5 py-0.5 text-11 tabular-nums">
      {value}
      {/* Announced, never drawn. Beside its section label a bare number reads
          fine; in sequence, "Startups 3 2" is noise. */}
      {label ? <span className="sr-only"> {label}</span> : null}
    </span>
  );
}

/**
 * A founder was told nothing.
 *
 * 🔴 A `Chip`, not the raw `bg-destructive` span §4.5 sketches, and the reason
 * is a rule the spec itself enforces: `test/admin-page-guards.test.ts` allows
 * the three status hues ONLY under `components/admin/`, because a raw class
 * carries hue without the shape and the word that make a status survive
 * greyscale. Its own failure message says it: reach for the primitive. This is
 * also literally the state `Chip`'s docblock reserves `fill="solid"` for, so
 * the budget is spent where it was allocated rather than widened. The rendered
 * fill is identical; `px-1.5 py-0.5 tabular-nums` restores the badge geometry.
 */
function AlarmBadge({ value }: { value: number | null | undefined }) {
  if (!shows(value)) return null;

  return (
    <>
      <Chip tone="destructive" fill="solid" className="ms-auto px-1.5 py-0.5 tabular-nums">
        {String(value)}
      </Chip>
      <span className="sr-only"> approved or rejected with no email sent</span>
    </>
  );
}

export default function Sidebar({ email, counts, env, signOut }: Props) {
  const pathname = usePathname();

  /**
   * Rendered in the rail AND in the phone header, and NEVER on production.
   *
   * Absence is the all-clear, the same zero-suppression the badges use. This is
   * the first data the shell has ever rendered, and it exists because a real,
   * valid magic link once landed on `localhost:3000` while every screen involved
   * looked correct (root `CLAUDE.md`).
   *
   * 🔴 Both labels are FIXED LITERALS chosen by our code. `adminEnvironment()`
   * deliberately never returns the host, because caller-controlled text rendered
   * inside MAZJ chrome is the shape of a phishing message. The cost is that a
   * one-off preview deployment also reads "Staging · mazj-tau"; the signal that
   * matters, "this is not production", is still true.
   *
   * The `text-11` on the wrapper does NOT reach the word: `StatusDot` sets its
   * own size and an ancestor cannot beat a class on the element itself. What
   * `.eyebrow` contributes is weight, uppercase and tracking, and those DO
   * inherit, so the label keeps the register the rail's other labels have.
   */
  const envChip =
    env === "live" ? null : (
      <p className="eyebrow text-11">
        {env === "local" ? (
          <StatusDot tone="quiet" fill="hollow" label="Local" size="sm" />
        ) : (
          <StatusDot tone="warn" fill="solid" label="Staging · mazj-tau" size="sm" />
        )}
      </p>
    );

  return (
    <>
      {/* ============================================================
          DESKTOP RAIL, lg and up. 240px on cream, separated from the cream
          content lane by a single hairline at 1.23:1. The hairline IS the
          signal here and must never be removed as redundant.

          There is no desktop header band. It was 65px of full-width chrome
          whose only visible child was one pill at the far right, sitting above
          an <h1> that already named the page.
          ============================================================ */}
      <nav
        aria-label="Admin sections"
        className="hidden shrink-0 flex-col border-e border-border bg-background lg:sticky lg:top-0 lg:flex lg:h-svh lg:w-60"
      >
        <div className="px-5 pb-5 pt-6">
          <Link href="/admin" className="block">
            <span aria-hidden="true" className="block h-[22px] w-[30px]" style={WORDMARK} />
            {/* The mark carries no text, so this is the accessible name of the
                link home. "MAZJ Admin" as a visible string is deleted. */}
            <span className="sr-only">MAZJ Admin</span>
            <p className="eyebrow mt-2 text-11 text-subtle-foreground">Operations</p>
          </Link>
        </div>

        {envChip ? <div className="border-t border-border px-5 py-3">{envChip}</div> : null}

        {/* `min-h-0` is what makes `overflow-y-auto` work inside a flex column:
            a flex item's default `min-height: auto` refuses to shrink below its
            content, so without it the list grows past `h-svh` and the rail foot
            leaves the screen instead of the list scrolling. */}
        <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.name} className="mt-6 border-t border-border px-5 pt-5">
              <p className="eyebrow text-11 text-subtle-foreground">{group.name}</p>
              <ul className="mt-3 -mx-2">
                {group.items.map(({ item, index }) => {
                  const active = isActiveAdminItem(item, pathname);
                  const numeral = String(index + 1).padStart(2, "0");

                  return (
                    <li key={item.segment || "index"}>
                      <Link
                        href={adminHref(item)}
                        aria-current={active ? "page" : undefined}
                        className={`group relative flex min-h-11 items-baseline gap-3 rounded px-3 py-2.5 [transition:background-color_200ms,color_200ms,transform_120ms] active:scale-[0.96] ${
                          active
                            ? "bg-accent font-medium text-foreground before:absolute before:inset-y-1 before:-start-2 before:w-[2px] before:rounded-sm before:bg-foreground before:content-['']"
                            : "text-foreground hover:bg-accent/60"
                        }`}
                      >
                        {/* 🔴 CORAL USE #2 OF 2: the index numerals, at 2.90:1
                            on cream. Deliberately below AA and deliberately
                            fine, because they carry nothing the 15.1:1 label
                            beside them does not. NEVER put a word in coral. */}
                        <span
                          aria-hidden="true"
                          className="text-11 font-medium tabular-nums text-orange/70 group-aria-[current=page]:text-orange"
                        >
                          {numeral}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-14 font-medium">{item.label}</span>
                          {/* Desktop-only: on the phone tab grid this hint would
                              force every item wide enough to push the rest off
                              screen. */}
                          <span className="mt-0.5 hidden text-12 text-subtle-foreground lg:block">
                            {item.hint}
                          </span>
                        </span>
                        <CountBadge
                          value={counts[item.segment]}
                          label={item.countLabel}
                        />
                        <AlarmBadge value={counts[`${item.segment}:alarm`]} />
                        <NavPending />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-auto border-t border-border px-5 py-4">
          <p className="eyebrow text-11 text-subtle-foreground">Signed in</p>
          {/* `break-all` is load-bearing: an address long enough to overflow a
              240px rail would otherwise widen the whole sidebar and shove the
              content lane sideways. */}
          <p className="mt-1 break-all text-12 text-subtle-foreground">{email}</p>
          <div className="mt-3">{signOut}</div>
        </div>
      </nav>

      {/* ============================================================
          PHONE AND TABLET, below lg. Two rows: identity plus sign-out, then
          the sections.

          🔴 THE EMAIL IS NOT IN THIS HEADER. It was the flex child whose
          `truncate` was a no-op for want of `min-w-0`, and whose overflow
          pushed "Sign out" off the right edge under `body{overflow-x:hidden}`.
          It reappears at the END of `<main>`, in `(protected)/layout.tsx`
          directly after `{children}`, as an `lg:hidden` line reading "Signed in
          as" followed by the address: there it has the full lane and cannot
          displace a control. It is one element, and
          `grep -n "Signed in as" "app/admin/(protected)/layout.tsx"` returns
          exactly that one line. It is also the ONLY place the SIGNED-IN admin's
          own address renders below `lg`: the rail foot above is the only other
          render of it anywhere, and it is hidden below `lg`. If you delete that
          line, delete this paragraph too rather than leaving it describing
          something that is gone.
          ============================================================ */}
      <header className="flex h-12 items-center justify-between gap-4 border-b border-border bg-background px-5 lg:hidden">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="block h-[18px] w-[24px]" style={WORDMARK} />
          {envChip}
        </div>
        {signOut}
      </header>

      {/* The landmark is not decoration here. `display:none` takes the desktop
          rail out of the accessibility tree entirely, so below `lg` this is the
          only navigation region on the page and an unlabelled <ul> would leave
          it unreachable by landmark. Only ever one of the two is exposed. */}
      <nav aria-label="Admin sections" className="lg:hidden">
        {/* 🔴 A GRID, NEVER `overflow-x-auto`. The strip this replaces measured
            298px of content in a 390px box, so it never actually scrolled and
            nobody would have discovered that it could. A grid cannot overflow
            and cannot get stuck. Targets go from a measured 36px to 44px. */}
        <ul
          className={`grid ${TAB_GRID} border-b border-border bg-background md:flex md:h-14 md:items-center md:gap-1 md:px-8`}
        >
          {ADMIN_NAV.map((item) => {
            const active = isActiveAdminItem(item, pathname);
            const Icon = ICONS[item.icon];

            return (
              <li key={item.segment || "index"} className="md:flex-1">
                <Link
                  href={adminHref(item)}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-11 flex-col items-center justify-center gap-1 px-2 py-1.5 text-11 md:min-h-10 md:flex-row md:justify-center md:gap-2 md:rounded md:text-13 ${
                    active
                      ? "bg-card text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-foreground after:content-[''] md:bg-accent"
                      : ""
                  }`}
                >
                  <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
