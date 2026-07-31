import { cn } from "@/lib/utils";
import type { Tone } from "./StatusDot";

type ChipProps = {
  tone: Tone;
  fill?: "hollow" | "solid";
  /**
   * A string, never a node. The chip IS the word: it is the row's headline
   * state, so there is nothing to compose into it.
   */
  children: string;
  className?: string;
};

const BASE =
  "inline-flex w-fit items-center gap-1.5 rounded px-2 py-1 text-11 font-medium uppercase tracking-[0.05em] whitespace-nowrap";

const HOLLOW: Record<Tone, string> = {
  ok: "border border-ok/40 text-ok",
  warn: "border border-warn/40 text-warn",
  destructive: "border border-destructive/40 text-destructive",
  attention: "border border-foreground/25 text-foreground",
  quiet: "border border-border text-subtle-foreground",
};

const SOLID: Record<Tone, string> = {
  ok: "bg-ok text-ok-foreground",
  warn: "bg-warn text-warn-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  attention: "bg-foreground text-background",
  quiet: "bg-foreground/[0.06] text-subtle-foreground",
};

/**
 * The row-level badge: at most ONE per row, and only where the state IS the
 * row's headline. Everything quieter than that is a StatusDot.
 *
 * 🔴 `fill="solid"` is reserved for exactly two states in the whole admin:
 * "Approved, not emailed" and "No checkout link ever". Both are somebody out of
 * their chair. Spending solid on a third state spends the signal.
 *
 * Never the pill radius: DESIGN.md rules that nothing text-bearing is a pill.
 * Cream on the three solid fills measures 6.22 / 6.27 / 8.26:1.
 *
 * 🔴 NOT built on `components/ui/badge.tsx`, and the reason is the CHILD TYPE,
 * not the classes. On classes the two now agree: `badge.tsx` was themed in this
 * same redesign, so its base already carries the 11px size, the crisp radius and
 * no border, and its variant map is these same five tones on the same two axes.
 * `cn` also displaces a t-shirt size with a numeric one since `lib/utils.ts`
 * gained a bare-integer font-size validator, so composing it would not resize
 * anything silently.
 *
 * ⚠️ This paragraph said the opposite until 2026-07-29: that Badge carried a
 * t-shirt-sized font utility `twMerge` could not displace, that its transparent
 * border would survive into the solid fills, and that a Badge-based Chip would
 * render at 12px forever. Measured against the file it names, none of the three
 * is true, and the byte-offset argument under them describes an arbitration that
 * no longer happens. Do not reason from it.
 *
 * What survives is `children: string`. `Badge` takes a span's props, so its
 * children are any node and an icon-only or dot-only chip is one call site away.
 * That is the one thing this system cannot allow: the closest pair of status
 * hues measures 1.01:1, so a chip without a WORD is the same swatch to a reader
 * in greyscale, on a projector or in print. Chip makes that a compile error,
 * which `Badge` cannot do while keeping `asChild` and its icon slot.
 */
export function Chip({ tone, fill = "hollow", children, className }: ChipProps) {
  return (
    <span
      className={cn(BASE, fill === "solid" ? SOLID[tone] : HOLLOW[tone], className)}
    >
      {children}
    </span>
  );
}
