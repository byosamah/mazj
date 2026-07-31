import { cn } from "@/lib/utils";
import { Panel } from "./Panel";
import { MARK } from "./StatusDot";

type ErrorStateProps = {
  tone?: "destructive" | "warn";
  /**
   * A fixed sentence, chosen by CODE.
   *
   * 🔴 `message` is never `result.error.message`, and neither is this. Next
   * redacts THROWN errors but serialises RETURNED action values verbatim, and
   * Rekaz's errors arrive in Arabic naming their own internal field names. This
   * repo has already shipped that leak once, on a public booking form. Where a
   * call site allows it, type these as a union of our own sentences.
   */
  title: string;
  message: string;
  /** 🔴 Required: what the operator does now. "Could not load" with no instruction is half a message. */
  next: string;
  retry?: React.ReactNode;
};

/**
 * "We could not find out." Cannot be rendered without saying what to do next.
 *
 * The 2px top edge in the tone is the structural tell, and it is what makes
 * this a different OBJECT from `EmptyState` rather than the same panel in a
 * different colour. Greyscale keeps the edge; it does not keep a hue.
 */
export function ErrorState({
  tone = "destructive",
  title,
  message,
  next,
  retry,
}: ErrorStateProps) {
  return (
    <Panel
      pad="default"
      className={cn(
        "border-t-2",
        tone === "warn" ? "border-t-warn" : "border-t-destructive"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span aria-hidden className={cn(MARK[tone].solid, "mt-1.5")} />
        <div>
          <p
            className={cn(
              "text-14 font-medium",
              tone === "warn" ? "text-warn" : "text-destructive"
            )}
          >
            {title}
          </p>
          <p className="mt-1 max-w-[62ch] text-14 leading-[1.6]">{message}</p>
          <p className="mt-2 text-13 text-subtle-foreground">{next}</p>
          {retry && <div className="mt-4">{retry}</div>}
        </div>
      </div>
    </Panel>
  );
}
