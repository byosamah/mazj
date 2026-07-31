import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

type BtnProps = React.ComponentProps<"button"> & {
  variant?: "solid" | "quiet" | "danger" | "link";
  size?: "md" | "sm";
  pending?: boolean;
  pendingLabel?: string;
  asChild?: boolean;
};

/**
 * 🔴 The transition list NAMES `transform`.
 *
 * `active:scale-[0.96]` compiles to the `transform` property, so a transition
 * watching `scale`, or a blanket transition on the `all` keyword, animates
 * nothing and the press SNAPS with no easing. Debugged twice in this repo
 * already (the contact socials and the LocationHours map card both shipped
 * broken this way).
 */
const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded text-14 font-medium [transition:opacity_200ms,background-color_200ms,border-color_200ms,transform_120ms] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const VARIANT = {
  solid: "bg-primary text-primary-foreground hover:opacity-90",
  quiet: "border border-border bg-transparent hover:bg-accent",
  /**
   * 🔴 Outlined, never a filled red button. The filled red button is both the
   * SaaS tell and a false emphasis: on the two irreversible startup decisions
   * the LABEL is the safety mechanism ("Send the no, with the reason"), not the
   * colour. A red fill invites the reader to skip reading it.
   */
  danger:
    "border border-destructive/40 bg-transparent text-destructive hover:bg-destructive/[0.06]",
  link: "underline underline-offset-4 decoration-border hover:decoration-foreground",
} as const;

const SIZE = {
  md: "h-11 px-5",
  // The `before:` pseudo-element is a 44px hit pad on a 36px control, so a
  // small button still meets the touch target without changing the layout.
  sm: "relative h-9 px-3.5 text-13 before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']",
} as const;

/**
 * The admin's only button, and it bakes the three things this repo has been
 * bitten by, once.
 *
 * 🔴 NEVER use the marketing site's shared CTA class here. It presses via the
 * CSS `scale` PROPERTY; stacking it with a Tailwind `scale-[0.96]` (which is
 * `transform`) compounds to roughly 0.92, a visible double-shrink.
 *
 * 🔴 `pending` sets `aria-disabled`, NOT `disabled`. A real `disabled` on the
 * focused button drops keyboard focus to `<body>` mid-flow, which strands
 * anyone driving the form from the keyboard at the exact moment they submitted
 * it. Preventing the second submit is the owning form's job (its handler
 * no-ops while pending); it cannot be done here, because doing it would need a
 * click handler and this must stay a server component.
 *
 * 🔴 NOT built on `components/ui/button.tsx`, and the surviving reason is ONE
 * class rather than a general distrust of the merge.
 *
 * ⚠️ The size half of this argument used to run the other way and no longer
 * does. `lib/utils.ts` now extends tailwind-merge with a bare-integer font-size
 * validator, so `cn("text-sm", "text-14")` returns `"text-14"`: Button's
 * t-shirt size would be DISPLACED, not left to fight. Its radius loses to
 * `rounded` the same way. Measured 2026-07-29 against tailwind-merge 3.6.0;
 * re-measure by calling `cn` from `@/lib/utils` in a node script. This docblock
 * argued the opposite until that date, off the pre-fix behaviour plus a
 * byte-offset story about which utility Tailwind emits first. That arbitration
 * cannot happen once the two classes are in one group, so the story was
 * describing a mechanism that no longer runs.
 *
 * What does NOT resolve is Button's blanket transition on the `all` keyword. It
 * sits in a different class group from an arbitrary `[transition:…]` property,
 * so merging Button's base with `BASE` keeps BOTH (verified the same day), and
 * which of the two takes the `transition` property is then settled by emission
 * order in the compiled CSS rather than by anything readable here. That is
 * exactly the defect the explicit list above exists to remove, and preservation
 * rule 71 forbids the blanket form in admin source by name.
 *
 * The shadcn inventory says to USE `button.tsx` and override at the call site.
 * Rendering the element directly is a deliberate deviation from it, and a small
 * one. Between the overrides that inventory itself names (radius, height, font
 * size, focus ring, transition) and the variant and size maps above, which share
 * no definition with Button's, nothing of the base would survive except the one
 * class we would then have to fight.
 *
 * Focus comes from the single `admin.css` outline rule. No variant declares its
 * own, and none should.
 */
export function Btn({
  className,
  variant = "solid",
  size = "md",
  pending = false,
  pendingLabel,
  asChild = false,
  children,
  ...props
}: BtnProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      className={cn(BASE, VARIANT[variant], SIZE[size], className)}
      {...props}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </Comp>
  );
}
