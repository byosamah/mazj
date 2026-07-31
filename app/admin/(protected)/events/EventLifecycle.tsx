import {Chip} from "@/components/admin/Chip";
import {StatusDot} from "@/components/admin/StatusDot";

import type {AdminEventRow} from "../../_lib/events";

/**
 * The word for each phase.
 *
 * 🔴 "live" IS RETIRED and must not come back. It used to mean two opposite
 * things inside one component: phase `upcoming` rendered as "live" (meaning
 * published) while phase `live` rendered "on now". Any badge set built from the
 * phase enum therefore inverted, and the two states an operator most needs to
 * tell apart, "next Tuesday" and "happening right now", were the pair it swapped.
 */
const PHASE_LABEL = {
  upcoming: "Coming up",
  live: "Happening now",
  past: "Ended",
} as const;

/**
 * Status and phase, as TWO axes, in one cell.
 *
 * They are different facts and an operator needs both: a published event that
 * has already happened and a published event next Tuesday share a status and
 * want completely different attention.
 *
 * `published` renders NO chip, deliberately. It is the norm, and a badge on the
 * norm is a badge nobody reads. Only the two exceptions get one.
 *
 * Shared by the list and the detail head so the retired word above cannot come
 * back through one of them.
 */
export function EventLifecycle({
  event,
}: {
  event: Pick<AdminEventRow, "status" | "phase">;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <StatusDot
        tone={event.phase === "live" ? "attention" : "quiet"}
        label={PHASE_LABEL[event.phase]}
      />
      {event.status === "draft" && <Chip tone="quiet">Draft</Chip>}
      {event.status === "cancelled" && (
        <Chip tone="destructive" fill="hollow">
          Cancelled
        </Chip>
      )}
    </div>
  );
}
