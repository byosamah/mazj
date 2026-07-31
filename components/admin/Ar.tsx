import { cn } from "@/lib/utils";

type ArProps = {
  children: React.ReactNode;
  block?: boolean;
  className?: string;
};

/**
 * The wrapper every Arabic value from Rekaz renders inside: product names,
 * price labels, room names, ticket option text.
 *
 * Before this they rendered in an LTR cell with no `dir` and no `lang`, which
 * mis-orders any string mixing Arabic with a number or a Latin word, and leaves
 * a screen reader announcing Arabic in an English voice.
 *
 * `inline-block` plus `text-start` is what keeps the RTL run from dragging the
 * surrounding LTR cell around: the box stays where the table put it and only
 * its contents mirror.
 *
 * 🔴 It NEVER translates. Rekaz's Arabic catalog is deliberately not mapped to
 * English: everyone with an @mazj.org address reads Arabic, and a map would be
 * a second copy of a catalog Rekaz owns and can rename at will, i.e. a copy
 * that goes stale silently and is believed anyway.
 */
export function Ar({ children, block = false, className }: ArProps) {
  return (
    <span
      dir="rtl"
      lang="ar"
      className={cn("inline-block text-start", block && "block", className)}
    >
      {children}
    </span>
  );
}
