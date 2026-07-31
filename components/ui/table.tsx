import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Vendored from the shadcn `new-york-v4` registry, then themed for MAZJ.
 * Re-running `scripts/vendor-shadcn.py table` restores the registry version and
 * drops every change below.
 *
 * ⚠️ The numeric sizes below (`text-11`, `text-13`) are only safe because
 * `lib/utils.ts` teaches tailwind-merge that a bare-integer `text-*` is a FONT
 * SIZE. Out of the box it recognises only `text-xs…text-9xl` as sizes and files
 * everything else under COLOUR, so `cn("text-11 text-subtle-foreground")`
 * returned the colour ALONE and the header silently inherited 16px. That was
 * measured and fixed at the root rather than worked around per call site. If the
 * `isNumericFontSize` validator ever leaves `lib/utils.ts`, this file and every
 * other consumer of `cn()` regress at once, with no error and correct CSS.
 */

/**
 * The registry wraps every table in its own `overflow-x-auto` div. It is gone
 * because `DataTable` supplies the scroller, and that container is not
 * decoration: it carries `role="region"`, `aria-label` and `tabIndex={0}` so a
 * keyboard or touch reader can actually reach the off-screen columns. Nested,
 * the focusable region would be the outer element while the scrolling happened
 * in an inner one it does not control, which is worse than having no region at
 * all because it looks handled.
 *
 * `border-separate border-spacing-0` is kept to match `DataTable`, whose
 * docblock carries the measurement. The Safari reason it was written down for
 * (Safari drops a sticky `th`'s borders under `border-collapse: collapse`) does
 * not apply to either file any more, because no header in this admin sticks.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="table"
      className={cn(
        "w-full caption-bottom border-separate border-spacing-0 text-start text-13",
        className
      )}
      {...props}
    />
  )
}

/**
 * The registry's `[&_tr]:border-b` is dropped rather than retinted: in the
 * separated-borders model a border on a row or a row group is not painted at
 * all, so it was already drawing nothing. `TableHead` carries the rule.
 */
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn(className)} {...props} />
}

/**
 * The registry's `[&_tr:last-child]:border-0` is dropped for the same reason as
 * the header's row rule: it addressed a border on a `tr`, which the separated
 * model does not paint. The closing hairline now comes from the last row's own
 * cells, which is what closes the table off from whatever follows it.
 */
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("bg-secondary font-medium", className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("transition-colors hover:bg-card", className)}
      {...props}
    />
  )
}

/**
 * The header is the label register on tan, not a slightly bolder body row. The
 * registry's `font-medium` at the inherited size measured 3.04:1 in this admin,
 * which made the header the FAINTEST row in its own table; `.eyebrow` (weight
 * 500, uppercase, +0.05em, from globals.css) on `bg-secondary` with
 * `text-subtle-foreground` measures 6.62:1.
 *
 * 🔴 It does NOT stick. `sticky top-0 z-1` was here and was deleted, in step
 * with `DataTable`, whose docblock holds the measurement: inside an
 * `overflow-x-auto` scroller those classes are inert at every width and every
 * row count. `scope="col"` sits before the prop spread so a caller can still
 * pass `scope="row"`, and it is what keeps the column name attached to a cell
 * once the header row has scrolled away.
 */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn(
        "eyebrow border-b border-border bg-secondary px-3 py-2.5 text-start align-middle whitespace-nowrap text-11 text-subtle-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * `align-top` rather than `align-middle`, and no `whitespace-nowrap`: a cell in
 * this admin routinely carries a value plus a second explanatory line (a status
 * word under a name, "price when picked" under an amount), and those must sit
 * against the top of the row rather than float in the middle of it.
 *
 * `border-border/70` is a lighter hairline than the header's, so the header rule
 * stays the strongest horizontal line in the table.
 */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "border-b border-border/70 px-3 py-2.5 align-top [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-13 text-subtle-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
