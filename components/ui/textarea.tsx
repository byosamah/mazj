import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Vendored from the shadcn `new-york-v4` registry, then themed for MAZJ.
 * The same four changes as `input.tsx` (radius, size, flatness, one focus
 * indicator owned by admin.css), and one of its own:
 *
 * `min-h-16` to `min-h-24` (64px to 96px). The two textareas in this admin are
 * the rejection reason and the event summary, both of which are read by someone
 * outside MAZJ, and a three-line box invites a one-line answer.
 *
 * Re-running `scripts/vendor-shadcn.py textarea` restores the registry version.
 * The reasoning for each change is in `input.tsx`; it is written once there
 * rather than twice.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded border border-input bg-transparent px-3.5 py-2.5 text-15 leading-[1.6] transition-colors outline-none placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-offset-[-2px]",
        "aria-invalid:border-2 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
