import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Vendored from the shadcn `new-york-v4` registry, then themed for MAZJ.
 *
 * ⚠️ NOTHING IMPORTS IT, so editing this file changes nothing on screen. It was
 * vendored as the intended base for `Notice`, `ErrorState` and `HealthStrip`,
 * whose shape it fits exactly: the registry's `grid-cols-[0_1fr]` /
 * `has-[>svg]:grid-cols-[1rem_1fr]` layout is a mark plus a sentence plus a
 * quieter second line, with the mark's column collapsing to zero width when
 * there is no mark. All three ended up rendering their own
 * `flex items-start gap-2.5` row instead. Retune the tone map here and the admin
 * looks identical, with no error to say why. To re-measure:
 * `grep -rn "components/ui/alert" app components` returns this docblock and
 * nothing else. It claimed the composition in the present tense until
 * 2026-07-29.
 *
 * It stays on disk anyway: deleting a vendored file fights the `components.json`
 * arrangement, and re-running `scripts/vendor-shadcn.py alert` restores the
 * registry version over every change below.
 *
 * What changed, and why:
 *
 * - `rounded-lg border` becomes `rounded-none border-t-2` in the tone. A boxed,
 *   rounded, four-sided alert is the generic SaaS panel this system exists to
 *   avoid; a 2px rule along the top edge is the structural tell, and it survives
 *   greyscale and print, which colour alone does not.
 * - The two-variant map (`default` / `destructive`) becomes the four tones the
 *   admin actually speaks. `quiet` is not a lesser warning: it is the tone for
 *   "we are telling you something and nothing is wrong", which is why the
 *   hedged sign-in copy uses it rather than `ok`.
 * - `text-sm` becomes `text-14`, from the closed set.
 *
 * `role="alert"` sits ahead of the prop spread so a caller could pass
 * `role="status"`. That patch is not cosmetic, and it exists because a notice
 * has to announce a recorded decision politely and a failed one assertively:
 * hard-coding `alert` would read out "Marked as used" at the urgency of "The
 * decision was not recorded". `Notice` reaches the same end without this file,
 * by computing `role` from its own `live` prop.
 */
const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-none border-t-2 bg-card px-5 py-4 text-14 has-[>svg]:grid-cols-[1rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      tone: {
        ok: "border-t-ok",
        warn: "border-t-warn",
        destructive: "border-t-destructive",
        quiet: "border-t-border",
      },
    },
    defaultVariants: {
      tone: "quiet",
    },
  }
)

function Alert({
  className,
  tone,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-tone={tone ?? "quiet"}
      role="alert"
      className={cn(alertVariants({ tone }), className)}
      {...props}
    />
  )
}

/**
 * The registry's `line-clamp-1` is removed. Every title on this surface is a
 * fixed sentence chosen by code, and truncating one is the exact failure this
 * redesign exists to end: a clamped "We could not reach Rekaz, so this list may
 * be short" reads as a complete statement that says something else.
 */
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 min-h-4 font-medium", className)}
      {...props}
    />
  )
}

/**
 * The quieter second line: what the operator does now, or the detail behind the
 * headline. ⚠️ `text-13` beside a text colour is only safe because
 * `lib/utils.ts` teaches tailwind-merge that a bare-integer `text-*` is a FONT
 * SIZE; untaught, the size loses the conflict and this line inherits 16px.
 */
function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-13 leading-[1.6] text-subtle-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
