import { cn } from "@/lib/utils";
import { mark } from "./StatusDot";

type NoticeTone = "ok" | "warn" | "destructive" | "quiet";

type NoticeProps = {
  tone: NoticeTone;
  children: React.ReactNode;
  detail?: React.ReactNode;
  live?: "polite" | "assertive";
  action?: React.ReactNode;
  id?: string;
};

const EDGE: Record<NoticeTone, string> = {
  ok: "border-t-ok",
  warn: "border-t-warn",
  destructive: "border-t-destructive",
  quiet: "border-t-border",
};

/**
 * The one alert slot per screen.
 *
 * 🔴 EXACTLY ONE `Notice` element may exist on a screen, owned by one
 * component. That is the structural fix for the contradictory pair the old
 * admin shipped: "That sign-in link was invalid" sitting directly above "Check
 * your inbox". Two messages cannot coexist if only one slot exists.
 *
 * `live="assertive"` is mandatory for "The decision was not recorded" and
 * "Still not sending". Before this, those were announced at the same urgency as
 * "Marked as used."
 *
 * Focus is moved by the CLIENT form that owns the notice, via
 * `document.querySelector('[data-admin-notice]')?.focus()` in an effect keyed on
 * the state object. That is why `tabIndex={-1}` and `data-admin-notice` are
 * here and why this component itself stays a server component: the dashboard
 * ships zero client components and this must not be what changes that.
 */
export function Notice({
  tone,
  children,
  detail,
  live = "polite",
  action,
  id,
}: NoticeProps) {
  return (
    <div
      id={id}
      data-admin-notice
      tabIndex={-1}
      role={live === "assertive" ? "alert" : "status"}
      aria-live={live}
      className={cn("rounded-none border-t-2 bg-card px-5 py-4", EDGE[tone])}
    >
      <div className="flex items-start gap-2.5">
        {/* The fill follows StatusDot's own per-register default rather than a
            second rule invented here: solid where we hold data that asserts
            this, hollow where we inferred it from absence. */}
        <span aria-hidden className={cn(mark(tone), "mt-1.5")} />
        <div>
          <p className="text-14 leading-[1.6]">{children}</p>
          {detail && (
            <p className="mt-1.5 text-13 leading-[1.6] text-subtle-foreground">
              {detail}
            </p>
          )}
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>
    </div>
  );
}
