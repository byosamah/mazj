import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Vendored from the shadcn `new-york-v4` registry, then themed for MAZJ.
 *
 * ⚠️ NOTHING IMPORTS IT, so editing this file changes nothing on screen. It was
 * vendored as the intended base for `Chip`; `Chip` renders the span directly, to
 * make `children: string` a compile-time guarantee that a chip always carries a
 * WORD, which a span's props cannot express. See its docblock. This one said "It
 * is the base for `Chip`" until 2026-07-29, while `Chip` said the opposite in
 * the same repo. To re-measure: `grep -rn "components/ui/badge" app components`
 * returns two docblocks, this one and `Chip`'s, and no import statement.
 *
 * It stays on disk anyway: deleting a vendored file fights the `components.json`
 * arrangement, and re-running `scripts/vendor-shadcn.py badge` restores the
 * registry version over every change below.
 *
 * The registry base was wrong here in three ways that a reviewer would read as
 * house style rather than as defects:
 *
 * - `rounded-full`. DESIGN.md: nothing text-bearing is a pill. A pill is what
 *   makes a status read as a product tag on a marketing page.
 * - `text-xs`. Outside the closed type set, and 12px where this register is 11.
 * - `border border-transparent`, which would have ridden into every solid fill
 *   and added 2px to the box. Dropped, so the borders below appear only on the
 *   hollow pairs that actually want one.
 *
 * The variant map is replaced outright. The registry's `destructive` painted
 * `text-white`, and pure white is reserved on this brand for exactly one thing
 * (the marketing site's floating nav pill), so a chip cannot have it. What
 * replaces it is the admin's five tones on two axes:
 *
 *   TONE is what the system knows. `attention` (ink) is not a status hue: it is
 *   "a person must act", which is why a pending application and a room in use
 *   are not painted as warnings.
 *
 *   FILL is how sure we are. `hollow` is the default and covers everything;
 *   `solid` is reserved for exactly two states in the whole admin ("Approved,
 *   not emailed" and "No checkout link ever"), because a surface where every
 *   chip shouts has no way left to shout.
 *
 * 🔴 Colour is never the only signal. Against each other the three status hues
 * measure 1.01:1 (ok/warn), 1.33:1 (ok/destructive) and 1.32:1
 * (warn/destructive), so in greyscale they are the same swatch. A `Chip` always
 * carries a WORD, and `StatusDot` adds a third signal, shape. Do not add a
 * dot-only or icon-only chip variant here.
 *
 * ⚠️ `text-11` beside a tone's text colour is only safe because `lib/utils.ts`
 * teaches tailwind-merge that a bare-integer `text-*` is a FONT SIZE. Untaught,
 * it files one under COLOUR, the size loses the conflict to the tone, and the
 * chip silently inherits 16px. Fixed at the root, not per call site.
 *
 * `overflow-hidden` and the registry's focus ring are dropped for one reason
 * each. The ring, because the single outline rule in `admin.css` is the tool's
 * only focus indicator and a second one beside it is a second answer to the same
 * question. `overflow-hidden`, because that rule is drawn at a 3px OFFSET, so a
 * clipping box would cut it off the moment `asChild` wrapped anything focusable.
 * ⚠️ Nothing does that today, here or in `Chip`, which has no `asChild` prop:
 * this paragraph named a chip-inside-a-link on the events list until 2026-07-29,
 * and that call site does not exist. The list puts its chip BESIDE the link.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 rounded px-2 py-1 text-11 font-medium tracking-[0.05em] whitespace-nowrap uppercase [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      // Both axes are declared empty and resolved in pairs below, because a
      // solid chip must not inherit the hollow chip's border: cva concatenates
      // variants rather than merging them, so "border border-ok/40" would ride
      // along under "bg-ok" and outline a filled chip in its own hue.
      tone: {
        ok: "",
        warn: "",
        destructive: "",
        attention: "",
        quiet: "",
      },
      fill: {
        hollow: "",
        solid: "",
      },
    },
    compoundVariants: [
      { tone: "ok", fill: "hollow", class: "border border-ok/40 text-ok" },
      { tone: "warn", fill: "hollow", class: "border border-warn/40 text-warn" },
      {
        tone: "destructive",
        fill: "hollow",
        class: "border border-destructive/40 text-destructive",
      },
      {
        tone: "attention",
        fill: "hollow",
        class: "border border-foreground/25 text-foreground",
      },
      {
        tone: "quiet",
        fill: "hollow",
        class: "border border-border text-subtle-foreground",
      },
      // Cream on the three status fills measures 6.22 / 6.27 / 8.26:1.
      { tone: "ok", fill: "solid", class: "bg-ok text-ok-foreground" },
      { tone: "warn", fill: "solid", class: "bg-warn text-warn-foreground" },
      {
        tone: "destructive",
        fill: "solid",
        class: "bg-destructive text-destructive-foreground",
      },
      {
        tone: "attention",
        fill: "solid",
        class: "bg-foreground text-background",
      },
      {
        tone: "quiet",
        fill: "solid",
        class: "bg-foreground/[0.06] text-subtle-foreground",
      },
    ],
    defaultVariants: {
      tone: "quiet",
      fill: "hollow",
    },
  }
)

function Badge({
  className,
  tone,
  fill,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  // `asChild` is kept from the registry rather than earned by a call site: it is
  // what a chip inside a link would need, so that a row's status sits inside the
  // click target instead of beside it. No such call site exists (see the
  // `overflow-hidden` note above), and none can while `Chip` is what the admin
  // actually renders.
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-tone={tone ?? "quiet"}
      data-fill={fill ?? "hollow"}
      className={cn(badgeVariants({ tone, fill }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
