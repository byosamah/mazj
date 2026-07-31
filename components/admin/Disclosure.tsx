import { ChevronDown } from "lucide-react";

import { StatusDot, type Tone } from "./StatusDot";

type DisclosureProps = {
  label: string;
  count?: number;
  tone?: Tone;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

/**
 * A native <details> with a real affordance.
 *
 * Native because the dashboard ships ZERO client components and that must
 * survive this redesign. Every alternative (a state hook, a Radix collapsible)
 * costs the whole page its server-only status for the sake of one triangle.
 *
 * The 300ms chevron rotation is DESIGN.md's documented rotate timing.
 *
 * 🔴 The COUNT in the summary is why anyone would open it. The version this
 * replaces was a 3.04:1 line carrying only the UA's default triangle, so the
 * one thing the reader needed in order to decide (are there three cancellations
 * in here, or none) was the one thing it did not say.
 *
 * `list-none` plus the webkit marker rule removes the UA triangle in both
 * engines; dropping either leaves a doubled arrow in one of them.
 */
export function Disclosure({
  label,
  count,
  tone,
  defaultOpen = false,
  children,
}: DisclosureProps) {
  return (
    <details className="group rounded-none bg-card" open={defaultOpen}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-5 py-3 text-14 font-medium [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="size-4 shrink-0 text-subtle-foreground [transition:transform_300ms] group-open:rotate-180"
          aria-hidden
        />
        {/* When there is a register to show, the StatusDot IS the label rather
            than sitting beside a second copy of it. StatusDot's whole contract
            is that a hue always arrives with a shape AND a word, so passing the
            label through it satisfies that without announcing the same string
            twice to a screen reader. */}
        {tone ? (
          <StatusDot tone={tone} label={label} />
        ) : (
          <span>{label}</span>
        )}
        {count != null && (
          <span className="ms-auto text-13 tabular-nums text-subtle-foreground">
            {count}
          </span>
        )}
      </summary>
      <div className="px-5 pb-5 pt-1">{children}</div>
    </details>
  );
}
