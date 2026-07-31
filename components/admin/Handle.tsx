import { cn } from "@/lib/utils";

type HandleProps = {
  children: React.ReactNode;
  size?: "sm" | "lg" | "block";
  selectAll?: boolean;
};

const SIZE = {
  sm: "inline-block rounded bg-card px-1.5 py-0.5 text-12 tracking-[0.06em] tabular-nums",
  lg: "text-24 font-bold tracking-[0.12em] tabular-nums",
  block:
    "block break-all rounded bg-card px-3 py-2 text-13 leading-[1.5] tracking-[0.02em]",
} as const;

/**
 * The honest replacement for the monospace font utility.
 *
 * That utility is a documented NO-OP in this repo: the monospace and the sans
 * custom properties in `globals.css` both resolve to "Thmanyah Sans", so the 14
 * machine-readable values it marked across the admin (invoice ids, Rekaz
 * references, redemption codes) were marked with nothing at all. All 45 of its marketing usages were deleted
 * for the same reason, and the enforcement table in the spec's §8.6 requires it
 * to reach 0 occurrences across `app/admin` and `components/admin`.
 *
 * Tracking plus tabular figures plus a warm plate is the correct signal in a
 * one-typeface system. A second face would break the brand for the sake of a
 * reference number.
 *
 * `tabular-nums` is already inherited from `body` in `admin.css`; it is
 * repeated here so a Handle keeps aligning if it is ever rendered outside the
 * admin document.
 */
export function Handle({ children, size = "sm", selectAll = false }: HandleProps) {
  return (
    <span className={cn(SIZE[size], selectAll && "select-all cursor-text")}>
      {children}
    </span>
  );
}
