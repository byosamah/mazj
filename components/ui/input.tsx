import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Vendored from the shadcn `new-york-v4` registry, then themed for MAZJ.
 * Re-running `scripts/vendor-shadcn.py input` restores the registry version, so
 * re-apply these if it is ever refreshed:
 *
 * - `h-9` to `h-11` (44px, the admin's minimum target height) and `px-3` to
 *   `px-3.5`, so a field, a button and a table row all share one rhythm.
 * - `rounded-md` to `rounded` (6px to 4px), which is DESIGN.md's control radius.
 * - `text-base md:text-sm` to `text-15`: one size at every width, from the
 *   closed set.
 * - `shadow-sm` deleted. This system is flat, and containment comes from a
 *   hairline rather than a raised edge.
 *
 * 🔴 FOCUS IS OWNED BY ONE RULE IN `app/admin/admin.css`, so the registry's
 * `focus-visible:border-ring focus-visible:ring-[3px] ring-ring/50` is gone.
 * Keeping it would paint a 3px box-shadow ring INSIDE the 2px indigo outline
 * that rule draws at 3px offset: two indicators on one control, in two hues.
 * The `outline-none` below is the vendor script's Tailwind-3 compatibility
 * patch (the registry ships v4's rename of that utility, which matches nothing
 * in 3.4) and it does NOT defeat that rule: `.outline-none` and
 * `:where(...):focus-visible` both weigh 0,1,0, and `layout.tsx` imports
 * admin.css after globals.css, so admin.css wins on source order.
 *
 * `focus-visible:outline-offset-[-2px]` pulls the ring inside the control's own
 * edge, which is DESIGN.md's rule for a tightly padded container: at the default
 * +3px, a field sitting flush inside a panel has its ring clipped by the panel.
 *
 * `aria-invalid:border-2` joins the colour so an invalid field is never signalled
 * by hue alone. It compiles ONLY because `tailwind.config.ts` extends Tailwind
 * 3's fixed aria-variant list with `invalid`.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded border border-input bg-transparent px-3.5 text-15 transition-colors outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-subtle-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-offset-[-2px]",
        "aria-invalid:border-2 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
