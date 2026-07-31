import { cn } from "@/lib/utils";

type EyebrowProps = {
  children: React.ReactNode;
  size?: 11 | 12;
  tone?: "subtle" | "ink" | "ok" | "warn" | "destructive";
  className?: string;
};

const TONE = {
  subtle: "text-subtle-foreground",
  ink: "text-foreground",
  ok: "text-ok",
  warn: "text-warn",
  destructive: "text-destructive",
} as const;

/**
 * The system's grouping device, and the single change that stops the admin
 * reading as a bootstrap panel. Used 40+ times across the redesign; used ZERO
 * times in the admin that shipped before it.
 *
 * The `.eyebrow` class itself is global (weight 500 + uppercase +
 * `var(--eyebrow-tracking)`), and the admin inherits it because
 * `app/admin/layout.tsx` imports `globals.css` before `admin.css`. Colour and
 * size stay Tailwind utilities at the call site rather than variants of the
 * class, so they never fight it on specificity. That is the same contract the
 * marketing site uses, and it is keyed on WEIGHT because `uppercase` and
 * `letter-spacing` are both no-ops in Arabic.
 */
export function Eyebrow({
  children,
  size = 12,
  tone = "subtle",
  className,
}: EyebrowProps) {
  return (
    <p
      className={cn(
        "eyebrow",
        size === 11 ? "text-11" : "text-12",
        TONE[tone],
        className
      )}
    >
      {children}
    </p>
  );
}
