"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { Btn, Chip, Notice, Panel } from "@/components/admin";

import { requestLoginLink, signOut, type LoginState } from "../_lib/actions";

/**
 * The magic-link request form, and the owner of this screen's ONE alert slot.
 *
 * 🔴 IT DOES NOT VALIDATE THE EMAIL DOMAIN. Doing that here would be a usability
 * feature at best and a liability at worst: it would tell an outsider, in the
 * browser and before any request is made, exactly which domain MAZJ admins use.
 * The check happens on the server, where the answer is not shown to the person
 * asking, and where a refused address and an accepted one produce the identical
 * reply. See `server/services/admin-auth.ts`.
 *
 * 🔴 EXACTLY ONE `Notice` may exist on this screen, which is why every message
 * the page can show is funnelled through here rather than rendered beside the
 * form by the page. That is the structural fix for the contradictory pair the
 * old admin shipped: "That sign-in link was invalid" sitting directly above
 * "Check your inbox". Two messages cannot coexist if there is only one slot.
 */

/**
 * Why the visitor arrived at a login screen, already narrowed by the page to a
 * fixed literal.
 *
 * 🔴 Every one of these is chosen by our own code from a query shape we
 * ourselves wrote (`?state=…`, `?bye=1`). Nothing Supabase said ever reaches
 * this component, because text supplied by an upstream and rendered inside MAZJ
 * chrome, on a page an anonymous visitor can reach, is the shape of a
 * convincing phishing message. Same reasoning as `?error=1` staying a literal.
 */
export type LoginArrival =
  /** Supabase Auth gave us no verdict, so we could not check the session (P1). */
  | "outage"
  /** A verified session whose address the domain rule now refuses (P2). */
  | "revoked"
  /** A credential was presented and no longer works. */
  | "expired"
  /** Sign-out worked and the auth server confirms there is no session. */
  | "signed-out"
  /** Sign-out ran and the session is demonstrably still valid. */
  | "sign-out-failed"
  /** Sign-out ran and the auth server could not tell us whether it took. */
  | "sign-out-unconfirmed";

type LoginFormProps = {
  /**
   * `?error=1`: the link they clicked did not work.
   *
   * The spec's name, kept, because it is its own query shape rather than a
   * member of `?state=`. It is suppressed the instant a submission produces a
   * message of its own, which is what actually kills the contradictory pair:
   * copy alone could not.
   */
  linkError?: boolean;
  /** `?state=…` or `?bye=1`, resolved against the live session by the page. */
  arrival?: LoginArrival | null;
  /**
   * Their own address, going back to them, and only on `sign-out-failed`.
   * Naming it is the difference between "the button is broken" and "you are
   * still signed in on this machine".
   */
  signedInAs?: string;
};

const INITIAL: LoginState = { message: null, sent: false };

export default function LoginForm({
  linkError = false,
  arrival = null,
  signedInAs,
}: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(
    requestLoginLink,
    INITIAL
  );

  /**
   * Move focus to the notice, but ONLY when a submission produced one.
   *
   * `INITIAL` carries neither flag, so this cannot fire on first paint. That
   * matters twice: an arrival notice is already in the DOM when the page loads,
   * so announcing it costs nothing and stealing focus would fight the input's
   * `autoFocus`; and the notice sits ABOVE the form in DOM order, so a reader
   * sent there tabs straight back into the address they need to correct.
   */
  useEffect(() => {
    if (!state.sent && !state.message) return;
    document.querySelector<HTMLElement>("[data-admin-notice]")?.focus();
  }, [state]);

  // Precedence, and it is the whole contract of the single slot: what just
  // happened beats why they arrived. Our own redirects never produce two of
  // these query shapes at once, so the order below only decides a URL somebody
  // typed by hand.
  const notice =
    submissionNotice(state) ??
    (linkError ? <LinkErrorNotice /> : arrivalNotice(arrival, signedInAs));

  return (
    <div className="mt-6 space-y-4">
      {notice}

      {/*
        The screen's one tan block. `ruled` because tan on cream measures 1.17:1
        and a tan region that abuts cream content needs the hairline to have an
        edge at all (see `components/admin/Panel.tsx`).
      */}
      <Panel tier="inset" pad="loose" ruled>
        {/*
          `aria-busy` on the FORM as well as the button, read from
          `useActionState` rather than `useFormStatus`: the hook reports a
          form's status only to components rendered inside it, so the form
          element itself cannot ask. Both readings describe the same submission.
        */}
        <form action={formAction} aria-busy={isPending || undefined}>
          {/*
            🔴 Hand-rolled rather than `<Field required />`, and both halves of
            that are measured rather than preferred.

            `Field`'s `required` prop renders the words "required to publish",
            which are the events form's, and it deliberately does NOT set the
            native attribute (a draft must save without it), so it would put
            wrong copy on the first screen anyone sees and still leave the
            control unvalidated. And the native attribute is the one thing
            standing between an empty box and a lie: `requestAdminMagicLink`
            reports the same hedged success for an unusable address as for a
            real one, so submitting nothing at all would answer "Check your
            inbox" for an address that was never typed.

            The rest is `Field`'s markup, and the two differences are both
            subtractions: the control drops `aria-invalid:border-2
            aria-invalid:border-destructive`, which cannot fire here because
            this screen's errors go to the one Notice rather than inline, and
            the label drops `flex items-center gap-2`, which exists only to
            align the marker that is not being rendered.
          */}
          <div className="grid gap-1.5">
            <label htmlFor="email" className="text-13 font-medium">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              spellCheck={false}
              placeholder="you@mazj.org"
              /*
                Echoed straight back so a send does not cost the typed value.
                React resets an uncontrolled form once the action resolves, and
                before this the whole address had to be retyped from memory to
                fix one character. It reveals nothing: it is the submitter's own
                input going back to the submitter.
              */
              defaultValue={state.email}
              className="h-11 w-full rounded border border-input bg-transparent px-3.5 text-15 placeholder:text-subtle-foreground focus-visible:outline-offset-[-2px]"
            />
          </div>

          <SubmitRow sent={state.sent} />
        </form>
      </Panel>
    </div>
  );
}

/**
 * The submit control, plus the announcement of its own label change.
 *
 * Its own component because `useFormStatus` may only be read from inside the
 * form it reports on.
 */
function SubmitRow({ sent }: { sent: boolean }) {
  const { pending } = useFormStatus();

  return (
    <>
      <Btn
        type="submit"
        variant="solid"
        size="md"
        className="mt-5 w-full"
        pending={pending}
        pendingLabel="Sending"
        /*
          🔴 `Btn` sets `aria-disabled`, never `disabled`, because a real
          `disabled` on the focused button drops keyboard focus to <body> at the
          exact moment somebody submits. Refusing the second press is therefore
          the owning form's job, and this is it.
        */
        onClick={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        {/*
          After a send the form stays mounted and the label changes, so
          `omar@mazj.or` is one keystroke from fixed rather than a page reload
          away.
        */}
        {sent ? "Send another link" : "Send me a sign-in link"}
      </Btn>

      {/*
        The label change, mirrored where a screen reader will hear it. A change
        to the accessible NAME of the control the reader is already sitting on
        is not reliably announced, so the pending state is spoken from a live
        region beside it instead.
      */}
      <span aria-live="polite" className="sr-only">
        {pending ? "Sending" : ""}
      </span>
    </>
  );
}

/**
 * The notice a submission produced, or null.
 *
 * 🔴 Three outcomes share the "Check your inbox" wording: a real send, a
 * refused address, and a send that failed silently. That is why its tone is
 * `quiet` and never `ok`. See the copy note below.
 */
function submissionNotice(state: LoginState): React.ReactNode | null {
  if (state.sent) {
    return (
      <Notice
        tone="quiet"
        detail={
          <>
            If that address can use the admin, a sign-in link is on its way. It
            is good for one use and expires shortly.
            <span className="mt-2 block">
              Nothing arrived? Check spam, and make sure you typed the address
              you use at work. We cannot tell you whether an address is
              authorised from this screen.
            </span>
          </>
        }
      >
        {/*
          🔴 PRESERVED VERBATIM, and the hedge is the point rather than a
          softening of it. This wording is truthful across a real send, a
          refused address and a swallowed send failure alike, which is exactly
          the anti-enumeration property made visible. "We have sent you a link"
          would make the screen lie in two of those three states.
        */}
        <span className="font-medium">Check your inbox</span>
      </Notice>
    );
  }

  if (!state.message) return null;

  if (state.code === "upstream_unavailable") {
    return (
      <Notice tone="destructive">
        {/*
          🔴 The one failure on this screen that means "this is us, not you",
          and the only one wearing both the alarm grammar and a label.

          The label is a `Chip` and not the spec's `Eyebrow`, for one measured
          reason: `Eyebrow` renders a <p> and `Notice` already puts its children
          inside a <p>. A browser reparses <p><p> into siblings, which React 19
          reports as a hydration error, and the one state that says our system
          is broken is the worst possible place to also break the page. `Chip`
          is a <span> in the same 11px uppercase register, and it keeps the hue
          inside a primitive that carries a word, which is what the enforcement
          rule in `test/admin-page-guards.test.ts` is actually protecting.
        */}
        <span className="mb-2 block">
          <Chip tone="destructive">System</Chip>
        </span>
        {state.message}
      </Notice>
    );
  }

  // Rate limited, or anything else. Both are answers about this attempt rather
  // than about our systems, and the sentence is always chosen by code in
  // `_lib/actions.ts`, never lifted from an upstream error.
  return <Notice tone="warn">{state.message}</Notice>;
}

/** `?error=1`. A fixed literal: the callback forwards no upstream string. */
function LinkErrorNotice() {
  return (
    <Notice tone="warn">
      That sign-in link was invalid or had expired. Please request a new one.
    </Notice>
  );
}

/** Why they were sent here, when a submission has not yet said anything. */
function arrivalNotice(
  arrival: LoginArrival | null,
  signedInAs?: string
): React.ReactNode | null {
  switch (arrival) {
    case "outage":
      return (
        <Notice tone="destructive">
          We could not check your sign-in. This is our system, not your account.
          Try again in a minute before requesting a new link.
        </Notice>
      );

    case "revoked":
      return (
        <Notice tone="warn">
          This address can no longer use the admin. Ask whoever manages MAZJ
          accounts.
        </Notice>
      );

    case "expired":
      return <Notice tone="quiet">Your session ended. Sign in again.</Notice>;

    case "signed-out":
      return <Notice tone="ok">You are signed out.</Notice>;

    case "sign-out-failed":
      return (
        <Notice tone="destructive" action={<SignOutAgain />}>
          {/*
            One string rather than JSX text around an expression, so the full
            stop cannot drift away from the address across a reformat. The
            branch is not a fallback: without an address the sentence still
            states the fact that matters, and printing "undefined" beside "you
            are still signed in as" would undo the only reason to name it.
          */}
          {signedInAs
            ? `We could not end your session. You are still signed in as ${signedInAs}.`
            : "We could not end your session. You are still signed in."}
        </Notice>
      );

    case "sign-out-unconfirmed":
      return (
        <Notice
          tone="destructive"
          action={<SignOutAgain />}
          detail="Try again in a moment. If this is a shared computer, close the browser as well."
        >
          We could not confirm that your session ended, so you may still be
          signed in.
        </Notice>
      );

    default:
      return null;
  }
}

/**
 * The retry on a sign-out that did not take.
 *
 * `signOut` is deliberately unguarded (`UNGUARDED_BY_DESIGN` in
 * `test/admin-page-guards.test.ts`): requiring a session to END one strands
 * anyone whose token has just expired on a page whose only button cannot work.
 *
 * Importing it here rather than taking a rendered form as a prop costs nothing:
 * this file already imports `requestLoginLink` from the same `"use server"`
 * module, and such a module never reaches the browser bundle. What ships is a
 * reference the client posts to.
 */
function SignOutAgain() {
  return (
    <form action={signOut}>
      <Btn type="submit" variant="quiet" size="sm">
        Try signing out again
      </Btn>
    </form>
  );
}
