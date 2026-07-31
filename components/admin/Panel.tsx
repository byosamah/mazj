import { cn } from "@/lib/utils";

type PanelProps = {
  /** card = beige-1, the default. inset = tan, and only INSIDE a card. */
  tier?: "card" | "inset";
  pad?: "tight" | "default" | "loose";
  ruled?: boolean;
  className?: string;
  children: React.ReactNode;
};

const PAD = {
  tight: "px-5 py-4",
  default: "px-6 py-5",
  loose: "p-6 lg:p-8",
} as const;

/**
 * Tier-1 containment without a card. Square, no radius, no shadow, full lane
 * width, and no side or bottom border.
 *
 * DESIGN.md: "Don't reintroduce a white card with a drop shadow, which is the
 * generic look this system exists to avoid."
 *
 * 🔴 SURFACE SCARCITY. A screen may contain at most ONE `tier="inset"` region.
 * On /admin/startups/[id] that one region is the pitch. Being the only tan block
 * on a cream page is what marks the thing a reader came for at
 * peripheral-vision distance with zero ornament, and a second one spends the
 * signal.
 *
 * ⚠️ This rule used to name `/admin`'s "Find a booking" box as the other
 * example. That box was deleted on 2026-07-30 with the rest of the Rekaz
 * dashboard, so `/admin` now spends its inset budget on NOTHING, which is the
 * correct reading of a scarcity rule rather than a slot waiting to be filled.
 * The index's section cards are `tier="card"` (beige-1), and adding a tan block
 * there would make the quietest screen in the tool shout.
 *
 * Tan against cream measures only 1.17:1, so a tan block that abuts cream
 * content ALWAYS carries `ruled`. Without the hairline the edge is invisible to
 * anyone whose screen is not calibrated.
 */
export function Panel({
  tier = "card",
  pad = "default",
  ruled = false,
  className,
  children,
}: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-none",
        tier === "inset" ? "bg-secondary" : "bg-card",
        PAD[pad],
        ruled && "border-t border-border",
        className
      )}
    >
      {children}
    </div>
  );
}
