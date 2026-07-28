"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestLoginLink, type LoginState } from "../_lib/actions";

const INITIAL: LoginState = { message: null, sent: false };

/**
 * The magic-link request form.
 *
 * The only client component in the admin. It exists for the pending state and
 * the confirmation swap, both of which need to change without a full
 * navigation.
 *
 * 🔴 Note what it does NOT do: validate the email domain. Doing that here would
 * be a usability feature at best and a liability at worst, because it would
 * tell an outsider, in the browser and before any request, exactly which domain
 * MAZJ admins use. The check happens on the server, where the answer is not
 * shown to the person asking. See `server/services/admin-auth.ts`.
 */
export default function LoginForm() {
  const [state, formAction] = useActionState(requestLoginLink, INITIAL);

  if (state.sent) {
    return (
      <div className="rounded-xl border border-black/10 bg-white/50 px-6 py-5">
        <p className="font-medium">Check your inbox</p>
        <p className="mt-2 text-sm leading-relaxed text-black/60">
          If that address can use the admin, a sign-in link is on its way. The
          link is valid for one hour and can only be used once.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-black/45">
          Nothing arrived? Check spam, then ask whoever manages the site. We
          cannot tell you whether an address is authorised from this screen.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-black/60">
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
          className="mt-1.5 w-full rounded-lg border border-black/15 bg-white/60 px-4 py-2.5 outline-none transition-colors focus:border-black/40"
        />
      </div>

      {state.message && (
        <p role="alert" className="text-sm text-orange">
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  // `useFormStatus` must be read from inside the form, which is why this is its
  // own component rather than a flag on the parent.
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-black px-4 py-2.5 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Sending..." : "Email me a sign-in link"}
    </button>
  );
}
