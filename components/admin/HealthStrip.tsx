import { cn } from "@/lib/utils";
import { Eyebrow } from "./Eyebrow";
import { MARK } from "./StatusDot";

type HealthTone = "warn" | "destructive";

export type HealthItem = {
  tone: HealthTone;
  text: string;
  detail?: string;
};

type HealthStripProps = { items: HealthItem[] };

/**
 * Page-level degradation aggregator: ONE zero-suppressed strip, rendered in
 * `PageHead`'s `notice` slot, above everything it invalidates.
 *
 * It renders `null` when `items` is empty, so its PRESENCE is the signal. That
 * is why there is no "all systems normal" state: a strip that is always there
 * is a strip nobody reads.
 *
 * 🔴 It replaces the old truncation banner outright. There is no separate
 * PartialNotice, and a `log.warn` is not a control: a warning nobody on the
 * screen can see has not been surfaced, it has been filed.
 */
export function HealthStrip({ items }: HealthStripProps) {
  if (items.length === 0) return null;

  // Destructive before warn. "We could not find out" outranks "this is partial"
  // because the operator's next action differs, not because it is louder.
  const sorted = [...items].sort((a, b) =>
    a.tone === b.tone ? 0 : a.tone === "destructive" ? -1 : 1
  );
  const worst: HealthTone = sorted[0].tone;

  const heading =
    sorted.length > 1
      ? "SOME OF THIS IS INCOMPLETE"
      : worst === "destructive"
        ? "COULD NOT LOAD"
        : "NOT THE WHOLE LIST";

  return (
    <div
      className={cn(
        "border-t-2 bg-card px-6 py-5",
        worst === "destructive" ? "border-t-destructive" : "border-t-warn"
      )}
    >
      <Eyebrow tone={worst}>{heading}</Eyebrow>
      <ul className="mt-3 space-y-2.5">
        {sorted.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span aria-hidden className={cn(MARK[item.tone].solid, "mt-1.5")} />
            <div>
              <p className="text-15 leading-[1.6]">{item.text}</p>
              {item.detail && (
                <p className="mt-1 text-13 leading-[1.6] text-subtle-foreground">
                  {item.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
