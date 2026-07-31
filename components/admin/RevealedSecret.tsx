import { Btn } from "./Btn";
import { ErrorState } from "./ErrorState";
import { Eyebrow } from "./Eyebrow";
import { Panel } from "./Panel";
import { formatStamp } from "./Stamp";
import { StatusDot, type Tone } from "./StatusDot";

/**
 * The bearer-capability primitive, built so the payment-link rules cannot be
 * lost in a refactor.
 *
 * ⚠️ 🔴 **THIS FILE IS MOUNTED ON NO ROUTE. It is dead code, like
 * `components/MotionToggle.tsx` on the marketing side, so a grep hit here is not
 * live behaviour.** Its only caller was `/admin`'s "Find a booking" panel, which
 * was deleted on 2026-07-30 when the Rekaz dashboard went (owner ruling: MAZJ
 * manages bookings in Rekaz's own platform, so this tool no longer mirrors
 * them). Nothing in the admin reads a stored checkout link any more, and
 * `server/db/bookings.ts`'s `getBookingPaymentLink` and `bookingsByMobile` are
 * back to zero callers with it.
 *
 * 🔴 It is KEPT rather than deleted for one reason: it is the only correct
 * rendering of a capability this repo has, and the reasoning below was paid for
 * once.
 *
 * 🔴 IF A REVEAL CONTROL EVER RETURNS, ITS TEST MUST BE WRITTEN FROM SCRATCH.
 * `test/admin-booking-lookup.test.ts` covered it and was deleted on 2026-07-30
 * with the feature; it had never been committed, and the owner confirmed on
 * 2026-07-31 that it should not be kept, so **there is nothing to restore and no
 * copy anywhere.** It was the sole assertion behind the entire access check, and
 * these are the two properties it pinned, which is the part worth keeping:
 *
 *   1. A booking id the typed mobile number did NOT match must not reveal a
 *      link, so `?reveal=<uuid>` is never a key on its own.
 *   2. In that case the database must not be asked AT ALL, rather than asked and
 *      the answer discarded: a link read out of the data layer has already left
 *      it.
 *
 * Rebuilding the panel without both of those is how a bare `?reveal=<uuid>`
 * becomes a working link to a stranger's payment page.
 *
 * 🔴 SIX states in ONE discriminated union so that two can never be merged.
 * `retired` ("we took it away after 72 hours") and `never` ("Rekaz never gave
 * us one, so there is a person to ring") must not share a sentence: the first
 * means issue a new link, the second means this customer may be holding a
 * booking they have no way to pay for. `never` is the only one that escalates
 * to a full ErrorState.
 */
type RevealedSecretProps =
  | { state: "shown"; url: string }
  | { state: "gone" }
  | { state: "failed"; message: string }
  | { state: "offer"; mobile: string; bookingId: string }
  | { state: "retired"; at: string }
  | { state: "never" };

/**
 * 🔴 THIS COMPONENT HAS NO `href` PROP AND NO ANCHOR ELEMENT ANYWHERE IN ITS
 * TREE, and that is a safety property, not a style. The URL is selectable text.
 * A checkout link is a bearer capability: one click from the front desk lands a
 * MAZJ colleague on a stranger's payment page, and there is no undo for what
 * happens next.
 *
 * `test/admin-page-guards.test.ts` asserts zero anchor open tags in this file,
 * in the block that gives four primitives one banned string each. It reads the
 * comment-stripped copy, so the constraint is on the CODE. Until 2026-07-29
 * this sentence said the tag could not appear even in prose, and named an
 * enforcement that had never been written.
 */
export function RevealedSecret(props: RevealedSecretProps) {
  switch (props.state) {
    case "shown":
      return (
        <Panel
          tier="inset"
          pad="tight"
          className="border-s-2 border-foreground/20"
        >
          <Eyebrow size={11}>Checkout link · send it, do not open it</Eyebrow>
          <p className="mt-1.5 select-all break-all text-13 leading-[1.5] tracking-[0.02em]">
            {props.url}
          </p>
        </Panel>
      );

    case "offer":
      return (
        <RevealButton mobile={props.mobile} bookingId={props.bookingId} />
      );

    case "gone":
      return (
        <StatusNote tone="quiet" label="Checkout link just retired">
          Links are kept for 72 hours.
        </StatusNote>
      );

    case "retired":
      return (
        <StatusNote tone="quiet" label="Checkout link retired">
          {formatStamp(props.at)}. Links are kept for 72 hours.
        </StatusNote>
      );

    case "failed":
      // The wording is fixed and chosen here. `props.message` is deliberately
      // NOT rendered: Rekaz's failures arrive in Arabic naming their own
      // internal fields, and Next serialises a RETURNED action value verbatim
      // even though it redacts a thrown one. It travels on the props so the
      // caller can log it.
      return (
        <StatusNote tone="warn" label="Could not read that link">
          It probably still exists.
        </StatusNote>
      );

    case "never":
      return (
        <ErrorState
          title="No checkout link was ever issued"
          message="Rekaz never gave us one."
          next="Find the booking in Rekaz by the customer's mobile number before telling them anything."
        />
      );
  }
}

/**
 * A status mark and its WORD, with the sentence underneath instead of inside.
 *
 * 🔴 PROSE DOES NOT GO THROUGH `StatusDot`. Its contract is a hue, a shape and
 * a word, and its wrapper is `whitespace-nowrap` so a status can never break
 * across two lines in a table cell or a nav row. Three states here used to hand
 * it whole sentences, and on a 390px phone the `retired` one measured 453.3px
 * inside a 294px column (390 minus the lane's `px-6` and the inset panel's
 * `px-6`), so its right edge landed at 501px. `body` sets `overflow-x: hidden`,
 * which propagates to the viewport, and a hidden viewport is scrollable by
 * script but NOT by a reader: the tail was cut with no scrollbar, no ellipsis
 * and no way to reach it. Walking a Range one character at a time to the
 * viewport edge, 54 of the 74 characters survived. The operator on the phone
 * with a customer read "Checkout link retired Wed 29 Jul 2026, 14:32. Links ar"
 * and lost "e kept for 72 hours.", i.e. the retention rule exactly.
 *
 * Same probe after the split: the three rows are 164.9px, 139.5px and 155.0px,
 * so all three clear the 294px column outright and the sentence below them
 * wraps (the `retired` one to two lines in its 278px text column). Re-measure by
 * rendering these three states at a 390 viewport and reading
 * `getBoundingClientRect().width` on the `StatusDot` span.
 *
 * 🔴 The fix is here and NOT in `StatusDot`'s base class. `cn` would happily
 * resolve a `whitespace-normal` override at the call site, but the nowrap is
 * what pins every OTHER status in the tool to one line, so relaxing it there to
 * rescue three sentences would un-pin all of them silently.
 *
 * `ps-4` hangs the sentence under the word: 8px of mark (`size-2`) plus 8px of
 * `gap-2` in `StatusDot`. If either changes there, this changes with it.
 *
 * `fill` is left to `StatusDot`'s own per-register default rather than a second
 * rule invented here, which is what `Notice` does too. `quiet` and `warn` both
 * default to hollow, so the three marks render exactly as they did.
 */
function StatusNote({
  tone,
  label,
  children,
}: {
  tone: Tone;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <StatusDot tone={tone} label={label} />
      <p className="mt-1 ps-4 text-13 text-subtle-foreground">{children}</p>
    </div>
  );
}

type RevealButtonProps = { mobile: string; bookingId: string };

/**
 * The control that asks for the link, and the hidden inputs that survive the
 * round trip.
 *
 * It renders INSIDE the existing GET form on the dashboard, never as a Server
 * Action. A query parameter on a page that already guards itself needs no
 * separate guard, survives a reload, and can be pasted to a colleague. The two
 * hidden inputs are why pressing Refresh mid-phone-call no longer wipes the
 * customer's booking and the revealed link: both travel in the query string.
 *
 * 🔴 The reveal is honoured only for a booking THIS MOBILE just matched. That
 * check lives in `dashboard.ts` and is the only access control on the one
 * function that hands back a capability, so `bookingId` alone is not a key.
 */
export function RevealButton({ mobile, bookingId }: RevealButtonProps) {
  return (
    <>
      <input type="hidden" name="mobile" value={mobile} />
      <input type="hidden" name="reveal" value={bookingId} />
      <Btn type="submit" variant="quiet" size="sm">
        Show payment link
      </Btn>
    </>
  );
}
