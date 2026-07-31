import { cn } from "@/lib/utils";

/**
 * The five registers a status may occupy in /admin.
 *
 * `attention` is deliberately NOT a status hue. It is the attention register:
 * ink, not colour. A pending application, a room occupied right now and the
 * active nav item are neither good nor bad, they are unanswered, in use, and
 * here. Painting those with `warn` is what collapsed four unrelated facts into
 * one coral on the old dashboard, which is the defect the palette exists to end.
 */
export type Tone = "ok" | "warn" | "destructive" | "attention" | "quiet";

/**
 * The second axis, and it carries meaning rather than decoration.
 *
 * solid  = we hold data that asserts this.
 * hollow = we inferred it from absence.
 *
 * So an outage, a missing amount and an unreported payment status can never
 * wear a solid mark.
 */
export type Fill = "solid" | "hollow";

/**
 * 🔴 THE ONLY PLACE `rounded-full` MAY APPEAR IN THE ADMIN.
 *
 * Every round or square status mark in the tool is one of these strings, and
 * `UNKNOWN_MARK` below is here for the same reason rather than living in
 * `UnknownValue.tsx`, where its markup is otherwise defined. The enforcement
 * grep in `test/admin-page-guards.test.ts` asserts zero `rounded-full` outside
 * this file, and a rule that has to be remembered in six files is a rule that
 * erodes. Baseline before the redesign: 14 occurrences.
 *
 * SHAPE IS KEYED TO TONE AND CANNOT BE OVERRIDDEN: disc = ok/attention,
 * ring = warn/quiet, square = destructive (the only square in the system).
 * That is not a stylistic choice. Measured against each other the three status
 * hues are 1.01:1 (ok/warn), 1.33:1 (ok/destructive) and 1.32:1
 * (warn/destructive), i.e. separated by HUE ALONE. In greyscale, on a
 * projector, or to a reader with monochromacy they are the same dot. Shape and
 * the required `label` are the two signals that survive all three.
 */
export const MARK: Record<Tone, Record<Fill, string>> = {
  ok: {
    solid: "size-2 shrink-0 rounded-full bg-ok",
    hollow: "size-2 shrink-0 rounded-full border-[1.5px] border-ok",
  },
  warn: {
    solid: "size-2 shrink-0 rounded-full bg-warn",
    hollow: "size-2 shrink-0 rounded-full border-[1.5px] border-warn",
  },
  destructive: {
    solid: "size-2 shrink-0 rounded-sm bg-destructive",
    hollow: "size-2 shrink-0 rounded-sm border-[1.5px] border-destructive",
  },
  attention: {
    solid: "size-2 shrink-0 rounded-full bg-foreground",
    hollow: "size-2 shrink-0 rounded-full border-[1.5px] border-foreground",
  },
  quiet: {
    solid: "size-2 shrink-0 rounded-full bg-subtle-foreground",
    hollow: "size-2 shrink-0 rounded-full border border-subtle-foreground",
  },
};

/**
 * The default fill per tone.
 *
 * The spec states four of the five: solid for ok and attention, hollow for warn
 * and quiet. `destructive` defaults to solid because both places that render a
 * destructive mark without choosing a fill (`ErrorState`, `HealthStrip`) ask for
 * solid explicitly, so any other default would make those two call sites the
 * exception rather than the rule.
 */
export const DEFAULT_FILL: Record<Tone, Fill> = {
  ok: "solid",
  attention: "solid",
  destructive: "solid",
  warn: "hollow",
  quiet: "hollow",
};

/**
 * The mark class list for a tone, honouring the per-tone default fill.
 * Every other primitive that draws a status mark reads it through here so the
 * shape/fill pairing has exactly one implementation.
 */
export function mark(tone: Tone, fill?: Fill): string {
  return MARK[tone][fill ?? DEFAULT_FILL[tone]];
}

/**
 * The two marks `UnknownValue` draws. They live here, not there, so that the
 * `rounded-full` grep above stays a single-file assertion. The rendered classes
 * are byte-identical to the ones the spec writes inside `UnknownValue`.
 */
export const UNKNOWN_MARK = {
  /** We could not find out. A ring, borrowed from the hollow register. */
  unknown: "size-2 shrink-0 rounded-full border-[1.5px] border-subtle-foreground",
  /** Not applicable. A fainter ring: nothing is missing, there is nothing to hold. */
  none: "size-2 shrink-0 rounded-full border border-border",
} as const;

const WORD: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  destructive: "text-destructive",
  attention: "text-foreground font-medium",
  quiet: "text-subtle-foreground",
};

type StatusDotProps = {
  tone: Tone;
  /**
   * 🔴 REQUIRED, and that is the whole point of this component. A hue without a
   * word will not compile. There is no default and there must never be one:
   * the three status hues are indistinguishable in greyscale (see MARK above),
   * so the word is the only signal that always survives.
   */
  label: string;
  fill?: Fill;
  /** md (default) sets the word at 13px, sm at 12px for a table sub-line. */
  size?: "sm" | "md";
  className?: string;
};

/**
 * The ONLY place a status hue may enter the admin.
 *
 * Three signals, always, and none of them optional: hue (the tone), shape (the
 * mark, keyed to tone and not overridable) and a word (the required label).
 * There is deliberately no `className` on the mark span, so a call site cannot
 * recolour or reshape it from outside.
 */
export function StatusDot({
  tone,
  label,
  fill,
  size = "md",
  className,
}: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap",
        className
      )}
    >
      <span aria-hidden="true" className={mark(tone, fill)} />
      <span className={cn(size === "sm" ? "text-12" : "text-13", WORD[tone])}>
        {label}
      </span>
    </span>
  );
}
