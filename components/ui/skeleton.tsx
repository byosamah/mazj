import { cn } from "@/lib/utils"

/**
 * Vendored from the shadcn `new-york-v4` registry, then themed for MAZJ.
 * Re-running `scripts/vendor-shadcn.py skeleton` restores the registry version
 * and drops all three changes below, so re-apply them if it is ever refreshed.
 *
 * `bg-border` (#E7E0D3) rather than the registry's `bg-accent`: in admin.css
 * `--accent` and `--secondary` are the SAME tan (#F0E5CF), so a placeholder
 * tinted `accent` is pixel-identical to a real tan panel and reads as content
 * that has already arrived rather than content still on its way.
 *
 * `rounded` (4px) rather than `rounded-md` (6px), which is shadcn's house
 * radius and the one thing that makes a MAZJ surface read as a template.
 *
 * `motion-reduce:animate-none` is required rather than nice to have: the
 * reduced-motion rule in globals.css collapses TRANSITION durations and never
 * touches keyframe animations, so without this the pulse keeps running for a
 * reader who asked the operating system for no motion.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded bg-border motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
