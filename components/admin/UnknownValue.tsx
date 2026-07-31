import { UNKNOWN_MARK } from "./StatusDot";

type UnknownValueProps = {
  /**
   * "unknown" = we could not find out. "Rekaz said nothing", "Not counted",
   * "Not recorded", "No reason recorded".
   *
   * "none" = not applicable. "Free event", "Not needed", "No code".
   */
  reason: "unknown" | "none";
  /**
   * 🔴 REQUIRED, and there is NO default phrase, because a default is exactly
   * how the two meanings re-merge. The caller has to say which nothing this is.
   */
  children: string;
};

/**
 * The primitive that kills the bare hyphen.
 *
 * A "-" meant four different things on one screen: no payment status was
 * reported, no ticket exists, no reference was returned, and nothing has been
 * decided yet. It also rendered at 25% ink, which measures 1.74:1 and is
 * therefore not readable text by any standard.
 *
 * What it replaces, concretely: `page.tsx:427`'s `{row.paymentStatus ?? "-"}`;
 * the two "-" cells at `events/[id]/page.tsx:148,152`; `startups/page.tsx:144`;
 * and every silently dropped clause, which is the worse case because a missing
 * sentence leaves no mark at all (the booking card's missing start time, the
 * room card's missing customer name).
 *
 * The two marks differ in weight, not only in wording: a 1.5px ring for a fact
 * we went looking for and did not get, a 1px hairline ring for a fact that was
 * never going to exist. The marks themselves live in `StatusDot.tsx`, which is
 * the one file in the admin allowed to write the pill radius utility.
 */
export function UnknownValue({ reason, children }: UnknownValueProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className={UNKNOWN_MARK[reason]} />
      <span className="text-13 text-subtle-foreground">{children}</span>
    </span>
  );
}
