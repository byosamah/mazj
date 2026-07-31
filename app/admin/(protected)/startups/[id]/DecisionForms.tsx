"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Btn, Field, Notice, Panel } from "@/components/admin";

import {
  decideApplication,
  redeemApplicationCode,
  resendApplicationEmail,
  type DecisionState,
} from "../../../_lib/actions";

/**
 * The controls that change an application.
 *
 * A client component because each of these needs pending state and a message
 * back; the page around it stays a Server Component reading the row directly.
 *
 * 🔴 Nothing here is the security boundary. Every action calls `requireAdmin()`
 * itself, because a Server Action is a public POST endpoint reachable by its id
 * from this very bundle. Hiding a button hides nothing.
 *
 * ⚠️ No `confirm()` anywhere, and no `AlertDialog`, on purpose. A browser modal
 * blocks the event loop and every automated check that ever drives this screen,
 * so the guard is in the LABEL instead: the button says exactly what will
 * happen, including that an email goes out. "Approve and send the code" and
 * "Send the no, with the reason" ARE the safety mechanism and may not be
 * shortened to "Approve" and "Reject".
 */

const INITIAL: DecisionState = { message: null, ok: false };

/**
 * Where each form's one message lands, so focus can be moved to it by id.
 *
 * 🔴 By id rather than by `[data-admin-notice]`. The reject panel carries a
 * permanent warning that is also a `Notice`, so a query for the attribute would
 * return whichever happened to be first in the document, which is the shape of
 * bug that only appears once somebody reorders the panels.
 */
const DECISION_NOTICE = "decision-outcome";
const RESEND_NOTICE = "resend-outcome";
const REDEEM_NOTICE = "redeem-outcome";

export function DecideForm({ id }: { id: string }) {
  // The third value is true while EITHER form is in flight, because both post
  // through this one action. That is what lets the sibling button go inert
  // without either form knowing about the other.
  const [state, formAction, isPending] = useActionState(decideApplication, INITIAL);
  useNoticeFocus(state, DECISION_NOTICE);

  return (
    <div className="space-y-6">
      <DecisionOutcome state={state} noticeId={DECISION_NOTICE} />

      {/* Two columns at md, one again at lg: from lg up these panels live in a
          380px sticky column beside the pitch, and two of them side by side in
          380px would put four words on a line. */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
        <Panel pad="default">
          {/* Approve. The note is optional and is NOT emailed: it is the record
              of why an unusual one was let through. */}
          <form action={formAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="decision" value="approved" />

            <h3 className="text-15 font-medium">Approve</h3>
            <p className="mt-1 text-13 leading-[1.6] text-subtle-foreground">
              Mints a code good for 30 days and emails it to them, in their own
              language.
            </p>

            <div className="mt-4">
              <Field
                id="approve-note"
                name="note"
                label="Internal note"
                as="textarea"
                rows={2}
                maxLength={1000}
                hint="Not sent to them. Only shown here."
              />
            </div>

            <DecisionSubmit
              variant="solid"
              idle="Approve and send the code"
              busy="Approving"
              blocked={isPending}
            />
          </form>
        </Panel>

        <Panel pad="default">
          {/* Reject. The reason IS the email. */}
          <form action={formAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="decision" value="rejected" />

            <h3 className="text-15 font-medium">Not this time</h3>

            {/* 🔴 Promoted out of the same grey the approve panel's neutral
                description is set in. An admin who reads this as an internal
                note writes "too early" and a founder reads "too early". The
                warn tone carries the emphasis: there is no emoji, and no status
                colour is written at this call site (the primitives own the
                hues, so a greyscale reader still gets the mark and the weight). */}
            <div className="mt-3">
              <Notice tone="warn">
                <span className="font-medium">
                  What you write here is emailed to them, word for word.
                </span>
              </Notice>
            </div>

            <div className="mt-4">
              <Field
                id="reject-note"
                name="note"
                label="Your reason"
                as="textarea"
                rows={5}
                minLength={10}
                maxLength={1000}
                aria-required="true"
                placeholder="Give them something they can act on."
                hint="At least ten characters. This is the whole message they receive."
                // 🔴 P12. React resets an uncontrolled form once the action
                // resolves, so without this a rejection reason of up to 1000
                // characters vanishes the moment the save conflicts, and
                // somebody has to write again, from memory, the careful
                // paragraph explaining to a founder why the answer is no.
                defaultValue={state.note ?? ""}
              />
            </div>

            <DecisionSubmit
              variant="danger"
              idle="Send the no, with the reason"
              busy="Sending"
              blocked={isPending}
            />
          </form>
        </Panel>
      </div>
    </div>
  );
}

/** Re-attempts a decision email that failed, once the cause is fixed. */
export function ResendForm({ id }: { id: string }) {
  const [state, formAction] = useActionState(resendApplicationEmail, INITIAL);
  useNoticeFocus(state, RESEND_NOTICE);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {/* A success here never reaches this slot: the action redirects with
          `?resent=1`, which is what stopped the confirmation destroying itself.
          So anything rendered below is a failure, and it is assertive. */}
      {state.message && (
        <Notice id={RESEND_NOTICE} tone="destructive" live="assertive">
          {state.message}
        </Notice>
      )}
      <Submit idle="Try sending it again" busy="Sending" variant="solid" />
    </form>
  );
}

/**
 * Marks a code as honoured.
 *
 * The ONLY way redemption is ever recorded: Rekaz has no coupon API, so no
 * software consumes this code. A person applies the offer in the room and a
 * person presses this. It keeps its full size and its full label for that
 * reason, and the page offers it on an expired code too.
 */
export function RedeemForm({ id }: { id: string }) {
  const [state, formAction] = useActionState(redeemApplicationCode, INITIAL);
  useNoticeFocus(state, REDEEM_NOTICE);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {state.message && (
        <Notice
          id={REDEEM_NOTICE}
          tone={state.ok ? "ok" : "destructive"}
          live={state.ok ? "polite" : "assertive"}
        >
          {state.message}
        </Notice>
      )}
      <Submit idle="Mark this code as used" busy="Saving" variant="quiet" />
    </form>
  );
}

/**
 * The decision's one message slot, above both panels.
 *
 * 🔴 THREE outcomes, not two, and the middle one keys on DELIVERY rather than
 * on `ok`. An approval whose mail failed is a success that still needs a human,
 * so wearing the success skin is how a founder ends up waiting on a code that
 * exists only in our database. A failure is assertive because "The decision was
 * not recorded" must not be announced at the same urgency as "Marked as used."
 */
function DecisionOutcome({
  state,
  noticeId,
}: {
  state: DecisionState;
  noticeId: string;
}) {
  if (!state.message) return null;

  const tone = !state.ok
    ? "destructive"
    : state.delivered === false
      ? "warn"
      : "ok";

  return (
    <Notice
      id={noticeId}
      tone={tone}
      live={tone === "ok" ? "polite" : "assertive"}
    >
      {state.message}
    </Notice>
  );
}

/**
 * Moves focus to the message once one arrives.
 *
 * Keyed on the state OBJECT, and it deliberately does nothing on the first
 * render: `useActionState` hands back the same `INITIAL` reference until an
 * action resolves, so comparing by identity distinguishes "nothing has happened
 * yet" from "the same message came back twice", which a string comparison
 * cannot.
 */
function useNoticeFocus(state: DecisionState, noticeId: string) {
  const seen = useRef<DecisionState>(state);

  useEffect(() => {
    if (seen.current === state) return;
    seen.current = state;
    if (!state.message) return;
    document.getElementById(noticeId)?.focus();
  }, [state, noticeId]);
}

/**
 * A submit button that knows about its sibling.
 *
 * `useFormStatus` reports only the form this sits inside, which is what keeps
 * the label swap on the button that was actually pressed. `blocked` carries the
 * other form's state in, so both go inert together while either is in flight.
 *
 * 🔴 `aria-disabled`, never `disabled`. A real `disabled` on the focused button
 * drops keyboard focus to `<body>` at the exact moment somebody submitted, so
 * the click is stopped in the handler instead.
 */
function DecisionSubmit({
  variant,
  idle,
  busy,
  blocked,
}: {
  variant: "solid" | "danger";
  idle: string;
  busy: string;
  blocked: boolean;
}) {
  const { pending } = useFormStatus();
  const inert = pending || blocked;

  return (
    <Btn
      type="submit"
      variant={variant}
      pending={pending}
      pendingLabel={busy}
      aria-disabled={inert || undefined}
      onClick={(event) => {
        if (inert) event.preventDefault();
      }}
      className="mt-4 w-full"
    >
      {idle}
    </Btn>
  );
}

/** The same control, for the two forms that stand alone. */
function Submit({
  idle,
  busy,
  variant,
}: {
  idle: string;
  busy: string;
  variant: "solid" | "quiet";
}) {
  const { pending } = useFormStatus();

  return (
    <Btn
      type="submit"
      variant={variant}
      pending={pending}
      pendingLabel={busy}
      onClick={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      {idle}
    </Btn>
  );
}
