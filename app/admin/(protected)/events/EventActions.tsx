import {ChevronDown} from "lucide-react";

import {Btn} from "@/components/admin/Btn";
import {Disclosure} from "@/components/admin/Disclosure";

import {changeEventStatus, removeEvent} from "../../_lib/event-actions";
import type {EventScope} from "../../_lib/event-outcomes";

/**
 * Publish, unpublish, cancel and delete, from wherever the operator already is.
 *
 * Added 2026-08-01, owner request. Both of these already existed and both lived
 * at the bottom of the event's own page: the status was a select in the
 * PUBLISHING section of a fourteen-field bilingual form, applied by pressing
 * Save, and deleting was a collapsed panel below it that asked you to type the
 * event's link out by hand. The events LIST, which is where anybody actually
 * decides what to publish, had no controls at all, and `RecordRow` had been
 * carrying an unused `action` slot since the redesign.
 *
 * 🔴 A SERVER COMPONENT, AND IT HAS TO STAY ONE. `/admin` ships exactly six
 * client components, asserted BY NAME in `test/admin-page-guards.test.ts`, and
 * the reason is not bundle size: anything reachable from a client component
 * ships to the browser, and `app/admin/_lib` is a sanctioned crossing into
 * `@/server` that can reach the Supabase secret key and the admin-scope Rekaz
 * credential. So there is no `useState` here, no `useActionState`, and no
 * `confirm()`. The menu is a native `details`, the controls are plain forms
 * posting to a Server Action, and the outcome comes back in the URL through
 * `_lib/event-outcomes.ts`.
 *
 * ⚠️ Everything here works with JavaScript off, which is a side effect rather
 * than a goal, but it is also why an automated check can drive this screen: a
 * blocking `confirm()` would stop the event loop and every such check with it.
 *
 * 🔴 NOTHING HERE IS THE SECURITY BOUNDARY. Both actions call `requireAdmin()`
 * themselves, because a Server Action is a public POST endpoint reachable by its
 * id from the client bundle. Not rendering a button hides nothing.
 */

/** The little an action needs to know about an event. */
export type ManageableEvent = {
  id: string;
  slug: string;
  status: string;
  /** 🔴 `null` is "we could not count", never zero. See `_lib/events.ts`. */
  seatsTaken: number | null;
};

type Move = {
  to: "draft" | "published" | "cancelled";
  label: string;
  /** What is true of the SITE afterwards. */
  consequence: string;
};

/**
 * Where each status can go, and what that costs.
 *
 * 🔴 The consequence line is not a tooltip, it is the control. "Cancel" and
 * "Take off the site" both mean "this leaves the site" and differ only in what
 * they say to somebody who already signed up, which is the fact an operator is
 * actually choosing between and the one a bare verb hides.
 *
 * ⚠️ A draft can be cancelled, which reads redundant and is not: an event that
 * was written, scheduled and then called off is a different record from one
 * still being drafted, and the archive shows it. `status` is `text` plus a check
 * constraint rather than an enum, so an unknown value is possible and falls
 * through to no moves at all rather than to a guess.
 */
const MOVES: Record<string, Move[]> = {
  draft: [
    {
      to: "published",
      label: "Publish",
      consequence: "Goes on the site now, English page and Arabic page.",
    },
    {
      to: "cancelled",
      label: "Cancel it",
      consequence: "Filed as cancelled. It never reached the site.",
    },
  ],
  published: [
    {
      to: "draft",
      label: "Take off the site",
      consequence: "Back to a draft. Everyone who signed up is kept.",
    },
    {
      to: "cancelled",
      label: "Cancel it",
      consequence: "Off the site and marked cancelled. Sign-ups are kept.",
    },
  ],
  cancelled: [
    {
      to: "published",
      label: "Publish",
      consequence: "Back on the site, English page and Arabic page.",
    },
    {
      to: "draft",
      label: "Back to a draft",
      consequence: "Off the site, and no longer marked cancelled.",
    },
  ],
};

/**
 * The trigger, styled as a quiet button rather than built from one.
 *
 * ⚠️ A real `Btn` cannot go inside the `summary`: a nested button swallows the
 * click that toggles the disclosure in some engines, so the summary IS the
 * control. `list-none` plus the webkit marker rule removes the default triangle
 * in both engines, exactly as `Disclosure` does; dropping either leaves a
 * doubled arrow in one of them.
 *
 * The pseudo-element is a 44px hit pad over a 36px control, the same idiom
 * `Btn`'s small size uses, so a compact trigger in a table row still meets the
 * touch target without changing the row's height.
 */
const TRIGGER =
  "relative inline-flex h-9 cursor-pointer list-none items-center gap-2 " +
  "rounded border border-border px-3.5 text-13 font-medium " +
  "[transition:background-color_200ms] hover:bg-accent " +
  "before:absolute before:inset-x-0 before:top-1/2 before:h-11 " +
  "before:-translate-y-1/2 before:content-[''] " +
  "[&::-webkit-details-marker]:hidden";

export function EventActions({
  event,
  scope,
}: {
  event: ManageableEvent;
  scope: EventScope;
}) {
  const moves = MOVES[event.status] ?? [];

  // 🔴 The group below is NAMED, and the name is load-bearing. The delete
  // control is a `Disclosure`, which is itself a details element carrying a
  // plain unnamed group, and Tailwind's unnamed variant compiles to a selector
  // matching ANY open group ancestor. Sharing the name would rotate the closed
  // delete disclosure's chevron whenever this menu was open, which reads as a
  // panel that is open and empty.
  return (
    <details className="group/menu relative inline-block text-start">
      <summary className={TRIGGER}>
        Change
        {/* 🔴 The accessible name has to differ per row. Forty summaries all
            announcing "Change" is a list a screen reader cannot navigate, and
            the title cannot be used for it: an event's title may be Arabic and
            this is an English document, so it would need its own `lang` and
            `dir` inside a control's name. The slug is always lowercase ASCII
            and always unique, which is exactly what is needed here. */}
        <span className="sr-only"> {event.slug}</span>
        <ChevronDown
          className="size-4 shrink-0 text-subtle-foreground [transition:transform_300ms] group-open/menu:rotate-180"
          aria-hidden
        />
      </summary>

      {/* Absolutely positioned so opening a menu never reflows the row under
          it, which on a forty-row list would move every row the operator was
          reading.

          🔴 THE ANCHOR FLIPS AT md, AND IT HAS TO. `RecordRow` stacks below
          that breakpoint and its action cell loses its end-alignment, so the
          trigger moves from the right of the row to the left of a stacked
          block. A panel anchored to the inline END then hangs its whole 288px
          off the START edge of a 390px screen, which the admin's own
          `overflow-x` means cannot even be scrolled to: the menu simply is not
          there. Anchored to the START below md it opens inward from the
          trigger and clears the lane with room to spare. */}
      <div className="absolute start-0 z-10 mt-1 w-72 rounded border border-border bg-card p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)] md:start-auto md:end-0">
        {moves.length === 0 ? (
          <p className="px-3 py-2 text-13 leading-[1.6] text-subtle-foreground">
            This event has a status this build does not know, so there is
            nothing safe to move it to.
          </p>
        ) : (
          moves.map((move) => (
            <StatusForm
              key={move.to}
              event={event}
              move={move}
              scope={scope}
            />
          ))
        )}

        <div className="mt-2 border-t border-border pt-2">
          <DeleteControl event={event} scope={scope} />
        </div>
      </div>
    </details>
  );
}

/**
 * One transition, as its own form.
 *
 * 🔴 `from` travels with it and is the PRECONDITION, not a hint. The action
 * refuses when the stored status is not the one this page rendered, so a list
 * left open since this morning cannot silently republish something a colleague
 * pulled down. See `setEventStatus` in `server/db/events.ts`, where the same
 * value is the conditional half of the UPDATE.
 */
function StatusForm({
  event,
  move,
  scope,
}: {
  event: ManageableEvent;
  move: Move;
  scope: EventScope;
}) {
  return (
    <form action={changeEventStatus}>
      <input type="hidden" name="id" value={event.id} />
      <input type="hidden" name="from" value={event.status} />
      <input type="hidden" name="status" value={move.to} />
      <input type="hidden" name="scope" value={scope} />

      <button
        type="submit"
        className="w-full rounded px-3 py-2 text-start [transition:background-color_200ms] hover:bg-accent"
      >
        <span className="block text-14 font-medium">{move.label}</span>
        <span className="mt-0.5 block text-12 leading-[1.5] text-subtle-foreground">
          {move.consequence}
        </span>
      </button>
    </form>
  );
}

/**
 * Deleting, behind a second click and no typing at all.
 *
 * ⚠️ THE TYPED CONFIRMATION IS GONE, by owner decision on 2026-08-01, and it is
 * worth recording what replaced it rather than letting a later reader read this
 * as a guard that was simply dropped. Three things carry it now:
 *
 * 1. The disclosure. Nothing destructive is one click from a row.
 * 2. The LABEL, which is this repo's stated pattern for an irreversible control
 *    (`DecisionForms.tsx` argues the same case for "Send the no, with the
 *    reason"). It states the count, so a delete of an event twelve people are
 *    coming to cannot be read as a delete of an empty draft.
 * 3. 🔴 The slug comparison on the server, which is the part that is actually
 *    NEW. The typed field proved the operator meant this event; the comparison
 *    proves the PAGE meant this event, and refuses when the row has moved under
 *    a stale list. Neither the typed field nor its `pattern` could catch that.
 *
 * ⚠️ A SEPARATE `form`, never nested inside another. Nested forms are invalid
 * HTML and the inner one is silently dropped, which would attach this button to
 * whatever action wraps it.
 */
function DeleteControl({
  event,
  scope,
}: {
  event: ManageableEvent;
  scope: EventScope;
}) {
  return (
    <Disclosure label="Delete this event" tone="destructive">
      <form action={removeEvent} className="space-y-3">
        <input type="hidden" name="id" value={event.id} />
        <input type="hidden" name="slug" value={event.slug} />
        <input type="hidden" name="scope" value={scope} />

        <p className="text-13 leading-[1.6]">
          {whatGoes(event.seatsTaken)} There is no undo. To take it off the site
          and keep who signed up, use Cancel instead.
        </p>

        <Btn type="submit" variant="danger" size="sm">
          Delete permanently
        </Btn>
      </form>
    </Disclosure>
  );
}

/**
 * What is about to be destroyed, counted, as a whole sentence.
 *
 * 🔴 A FAILED SEAT COUNT READS AS "EVERY SIGN-UP", NEVER AS ZERO. The two are
 * opposite instructions to somebody with a finger over a delete: one says this
 * is an empty draft, the other says people are coming. `_lib/events.ts` carries
 * `null` precisely so that distinction survives this far.
 *
 * ⚠️ A whole sentence rather than a noun phrase slotted into one, because the
 * zero case cannot be written as a phrase. Interpolating a count produced "its
 * poster and the sign-ups, of which there are none", which is the shape a
 * fragment forces and reads like a lawyer clearing their throat on the one
 * control that has to be understood at a glance. Zero drops the clause instead
 * and states the fact plainly.
 */
function whatGoes(seatsTaken: number | null): string {
  if (seatsTaken === null) {
    return "This removes the event, its poster and every sign-up for it.";
  }
  if (seatsTaken === 0) {
    return "This removes the event and its poster. Nobody has signed up.";
  }
  return seatsTaken === 1
    ? "This removes the event, its poster and its 1 sign-up."
    : `This removes the event, its poster and its ${seatsTaken} sign-ups.`;
}
