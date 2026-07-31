import { Panel } from "./Panel";

type EmptyStateProps = {
  message: string;
  hint?: string;
  action?: React.ReactNode;
};
// 🔴 There is deliberately NO `tone` prop here, nor any other colour register,
// and there never will be. A failure cannot be rendered through this component.
// That is how the empty-versus-error collapse becomes a TypeScript error
// instead of a convention somebody remembers.
//
// ⚠️ `test/admin-page-guards.test.ts` enforces it, in the block that gives four
// primitives one banned string each: it scans THIS FILE for `tone` and asserts
// zero. Re-measure with `npx vitest run test/admin-page-guards.test.ts`, and
// see it fail by adding the prop.
//
// That scan reads the comment-stripped copy, like every other rule in that
// file, so this paragraph can simply name the word. It could not until
// 2026-07-29: it claimed a comment-inclusive grep, told the next author not to
// reword the file, and the assertion did not exist at all. The prose was bent
// around a check nobody had written.

/**
 * "The system asked and the answer is genuinely nothing."
 *
 * Its design is what it CANNOT do. No hue, no mark, no edge rule, no icon.
 * Structurally a different object from `ErrorState`, and the difference
 * survives greyscale, a projector and print, which is the only test that
 * matters here. The single defect this whole redesign exists to remove is
 * "nothing happened" and "we could not find out" rendering as the same pixels.
 *
 * Copy rule (§9.3): empty states describe the WORLD. "No bookings today."
 * Error states describe US. "We could not reach Rekaz."
 */
export function EmptyState({ message, hint, action }: EmptyStateProps) {
  return (
    <Panel pad="loose">
      <p className="text-15 text-subtle-foreground">{message}</p>
      {hint && (
        <p className="mt-1.5 max-w-[62ch] text-13 leading-[1.6] text-subtle-foreground">
          {hint}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </Panel>
  );
}
