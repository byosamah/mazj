import { cn } from "@/lib/utils";

/**
 * How much of a column matters on a small screen.
 *
 * 🔴 The row's primary identifier and its Status column are ALWAYS
 * `priority="always"` and may never be given anything else. Everything else is
 * negotiable. Hidden cells stay in the DOM, so a screen reader and Cmd-F still
 * reach them: this hides, it does not drop.
 */
type Priority = "always" | "md" | "lg";

const PRIORITY: Record<Priority, string> = {
  always: "",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

const DEFAULT_MIN_WIDTH = "46rem";

type DataTableProps = {
  caption: string;
  minWidth?: string;
  children: React.ReactNode;
};

/**
 * For genuinely tabular data with five or more homogeneous columns. Anything
 * that is really "a status plus a name plus an action" belongs in `RecordList`,
 * which stacks on a phone instead of scrolling sideways.
 *
 * 🔴 THE HEADER DOES NOT STICK, AND IT CANNOT WHILE THIS SCROLLER EXISTS. The
 * div below declares `overflow-x: auto` and nothing on the other axis, and CSS
 * then computes `overflow-y` to `auto` as well (once one axis is not
 * `visible`, the other cannot stay `visible`). That makes this div its own
 * scrollport, so a `position: sticky; top: 0` on a `th` inside it resolves
 * against THIS box rather than the viewport, and this box is auto height, so it
 * never scrolls vertically and the header never detaches. To re-measure rather
 * than take this on trust: on `/admin/preview`, clone the reservations table's
 * rows to 60, put `sticky top-0 z-1` back on the `th`, and read five things.
 * They came back computed `position` "sticky", computed `overflow-y` "auto",
 * `scrollHeight` 2618 equal to `clientHeight` 2618, `scrollTop` still 0 after
 * being assigned 4000, and `th` top minus region top still 0.00 after scrolling
 * the page 2762px. A screenshot is not evidence in either direction here.
 *
 * 🔴 The obvious "fix" of dropping `overflow-x-auto` is not available: the
 * sideways scroll is load-bearing. Same page at a 390 viewport, the region is
 * 398px wide around 784px of table, and `scrollLeft` really moves. At 1024 the
 * lane is 704px (1024 viewport, minus the 240px rail, minus the layout's
 * `lg:px-10`), which the registrations table's `minWidth="56rem"` (896px)
 * overflows by 192px. Making the header stick means giving this div a vertical
 * scrollport of its own (`max-h-*` plus `overflow-y-auto`), which turns every
 * long table into a nested scroll region with the rest of the page stranded
 * below it, on the one screen that has an edit form under the table. That was
 * weighed and declined.
 *
 * `border-separate border-spacing-0` stays, but NOT for the reason originally
 * written here. That reason was Safari dropping a sticky `th`'s borders under
 * `border-collapse: collapse`, and nothing sticks now. Forced to `collapse` on
 * `/admin/preview` the region renders byte-identical at 1440 and at 390 (same
 * SHA-256 of the region screenshot, `th` and `td` bottom borders unchanged), so
 * in Chromium it currently buys nothing visible. It is kept as the precondition
 * for ever making the header stick again, not as a live fix, and the real
 * Safari pass it used to demand is retired with the sticky header.
 *
 * `tabIndex={0}` + `role="region"` + `aria-label` on the scroller: without all
 * three, the off-screen columns are unreachable on a phone with no pointer.
 */
export function DataTable({
  caption,
  minWidth = DEFAULT_MIN_WIDTH,
  children,
}: DataTableProps) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="-mx-6 overflow-x-auto px-6 md:-mx-8 md:px-8 lg:mx-0 lg:px-0"
    >
      <table
        className="w-full min-w-[46rem] border-separate border-spacing-0 text-start text-13"
        // The default lives in the class list so the common case compiles to a
        // real utility. A caller-supplied value has to arrive as an inline
        // style instead: Tailwind's JIT scans source text, so an interpolated
        // `min-w-[${minWidth}]` is a class it never sees and never emits, and
        // the failure is silent (the table simply has no minimum width).
        style={minWidth === DEFAULT_MIN_WIDTH ? undefined : { minWidth }}
      >
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

type CellProps = {
  children: React.ReactNode;
  align?: "start" | "end";
  priority?: Priority;
  className?: string;
};

/**
 * The header cell, and the reason the table stopped being unreadable.
 *
 * It is now the LABEL REGISTER on tan (6.62:1) instead of 14px weight-400 at
 * 3.04:1, so it is no longer the faintest row in its own table. `scope="col"`
 * is on every header here and was on none before, which is what keeps a column
 * name attached to every cell for a screen reader after the header row has
 * scrolled out of sight.
 *
 * 🔴 IT DOES NOT STICK, and `sticky top-0 z-1` was deleted from this class list
 * rather than made to work. The measurement is in the scroller's docblock
 * above. It holds at any width and any row count rather than only at the two
 * measured, because the scroller's height simply follows its content, and a box
 * whose height follows its content has nothing to scroll: those three classes
 * read as a feature and did nothing. A sighted reader on a 41-row list scrolls
 * the header away for good; the CSV download on the events screen is the route
 * out for anything longer.
 */
export function Th({
  children,
  align = "start",
  priority = "always",
  className,
}: CellProps) {
  return (
    <th
      scope="col"
      className={cn(
        "eyebrow whitespace-nowrap border-b border-border bg-secondary px-3 py-2.5 text-11 text-subtle-foreground",
        align === "end" && "text-end",
        PRIORITY[priority],
        className
      )}
    >
      {children}
    </th>
  );
}

/**
 * The body cell.
 *
 * `align="end"` also turns on `tabular-nums` because the only things this admin
 * right-aligns are figures, and a column of figures that does not line up is a
 * column somebody has to read twice.
 *
 * ⚠️ Row height: `py-2.5` is 20px, and a 13px line at the body's inherited
 * leading is roughly 20-22px, so a single-line row measures about 40-42px, just
 * under the 44px target. Rows carrying a StatusDot or a two-line cell clear it
 * comfortably. If a surface ends up with genuinely single-line rows everywhere,
 * raise the padding there rather than adding a height here, because a min-height
 * on a `<td>` is not honoured consistently across engines.
 */
export function Td({
  children,
  align = "start",
  priority = "always",
  className,
}: CellProps) {
  return (
    <td
      className={cn(
        "border-b border-border/70 px-3 py-2.5 align-top",
        align === "end" && "text-end tabular-nums",
        PRIORITY[priority],
        className
      )}
    >
      {children}
    </td>
  );
}
