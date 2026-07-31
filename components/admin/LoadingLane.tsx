import { Skeleton } from "@/components/ui/skeleton";

type LoadingLaneProps = {
  /** Default 6, capped at 8. */
  rows?: number;
  label: string;
  /**
   * The line that fades in at three seconds, when the default names the wrong
   * system.
   *
   * 🔴 It has to be overridable, because "Rekaz can take up to ten seconds" is a
   * claim about WHICH upstream this route waits on, and since 2026-07-30 not
   * every route waits on that one: `/admin` reads three Postgres counts and
   * nothing else. A boundary that blames a vendor for our own slow query sends
   * whoever is reading it to the wrong place, and it is the sentence they see at
   * exactly the moment they have decided something is broken.
   */
  note?: string;
};

/** A skeleton longer than the real content is its own kind of lie. */
const MAX_ROWS = 8;

/**
 * The loading boundary's body.
 *
 * 🔴 `bg-border` (#E7E0D3), NOT shadcn's `bg-accent`. `--accent` and
 * `--secondary` are the SAME tan in `admin.css`, so tinting a placeholder with
 * `bg-accent` produces a block indistinguishable from a real tan panel, and the
 * reader waits for content that has already "arrived".
 *
 * 🔴 `motion-reduce:animate-none` is required on every pulsing element.
 * globals.css's reduced-motion rule collapses TRANSITION durations and never
 * touches keyframe animations, so `animate-pulse` runs at full strength for a
 * reader who asked for stillness unless it is turned off here.
 *
 * The honest line at the bottom is CSS-only (`.admin-delayed` in `admin.css`
 * fades it in at three seconds), so it costs no client component. Three seconds
 * is the line between "slow" and "broken", and the default names Rekaz because
 * that is what the routes reading it wait on: /products was measured between
 * 1.2s and 10.8s. A route that waits on something else passes its own `note`.
 */
export function LoadingLane({
  rows = 6,
  label,
  note = "Rekaz can take up to ten seconds. It has not failed.",
}: LoadingLaneProps) {
  const count = Math.min(Math.max(rows, 1), MAX_ROWS);

  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading {label}</span>
      <Skeleton className="h-9 w-40 rounded bg-border motion-reduce:animate-none" />
      <div className="mt-6 space-y-2 border-t border-border pt-5">
        {Array.from({ length: count }, (_, i) => (
          <Skeleton
            key={i}
            className="h-11 w-full rounded bg-border/60 motion-reduce:animate-none"
          />
        ))}
      </div>
      <p className="admin-delayed mt-6 text-13 text-subtle-foreground">
        {note}
      </p>
    </div>
  );
}
