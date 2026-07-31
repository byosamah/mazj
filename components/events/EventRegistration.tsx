"use client";

import {useActionState} from "react";
import {useFormStatus} from "react-dom";
import {useLocale, useTranslations} from "next-intl";

import {
  submitRegistration,
  type RegistrationFormState,
} from "@/app/[locale]/events/_lib/actions";

/**
 * The registration form, for a FREE event only.
 *
 * Deliberately short. Three fields, one of them optional, no account, no
 * password, no confirmation step: the entire ask is "who are you and how do we
 * reach you", which is all MAZJ has ever needed to let somebody into a room.
 *
 * 🔴 It sends a slug and three strings. It does NOT send a price, an amount, a
 * seat count or an event id. Everything that consumes capacity is resolved
 * server-side in `server/services/event-registration.ts`, because everything a
 * browser sends is a suggestion.
 *
 * ⚠️ It took a `ticketed` flag and an `amount` until 2026-07-30, and redirected
 * to a Rekaz checkout it had created. A paid event no longer renders this
 * component at all: it renders a link to the Rekaz storefront, because Rekaz
 * publishes no write endpoint for a one-time product. The service refuses a
 * ticketed slug independently, so a crafted post cannot reach one either.
 */

const INITIAL: RegistrationFormState = {status: "idle"};

export default function EventRegistration({slug}: {slug: string}) {
  const t = useTranslations("EventDetail");
  const locale = useLocale();
  const [state, formAction] = useActionState(submitRegistration, INITIAL);

  if (state.status === "confirmed" || state.status === "already_registered") {
    const confirmed = state.status === "confirmed";
    return (
      <div
        // Announced rather than silently swapped in: a visitor using a screen
        // reader has just submitted a form and the only feedback is this box.
        role="status"
        className="rounded-[16px] bg-beige-card p-8 lg:p-10"
      >
        <h3 className="font-sans text-24 font-bold leading-[1.1] text-brown lg:text-32">
          {confirmed ? t("confirmedTitle") : t("alreadyTitle")}
        </h3>
        <p className="mt-3 max-w-[46ch] text-pretty text-15 leading-relaxed text-brown/85">
          {confirmed ? t("confirmedBody") : t("alreadyBody")}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="eventSlug" value={slug} />
      {/* The locale is stored on the registration so the admin can see which
          half of the site somebody came from, and so any future message goes
          out in the language they read. */}
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="name"
          label={t("name")}
          required
          autoComplete="name"
          invalid={state.status === "error" && state.field === "name"}
        />
        <Field
          name="mobile"
          label={t("mobile")}
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          // Forced LTR even in Arabic. A phone number is a Latin-digit sequence
          // and the bidi algorithm reorders a leading "+" against it, so an
          // Arabic reader sees "966+" and corrects a number that was right.
          dir="ltr"
          invalid={state.status === "error" && state.field === "mobile"}
        />
        <Field
          name="email"
          label={t("email")}
          type="email"
          autoComplete="email"
          dir="ltr"
          className="sm:col-span-2"
        />
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-15 text-orange">
          <ErrorCopy code={state.code} reason={state.reason} />
        </p>
      )}

      <Submit />
    </form>
  );
}

/**
 * Copy by CODE, from the message files.
 *
 * 🔴 The action deliberately never returns a message. `AppError.message` on
 * this path can carry Rekaz's raw ProblemDetails body, which arrives in Arabic
 * regardless of `Accept-Language`, plus their traceId and our internal paths,
 * and Next does not redact a RETURNED action value the way it redacts a thrown
 * error. That exact leak shipped once on the booking form: 300 characters of
 * upstream Arabic printed onto the English checkout page.
 *
 * `conflict` is narrowed by `reason` because one code covers three different
 * situations. Anything without its own line falls back to `error.unknown`
 * rather than rendering nothing at all.
 */
function ErrorCopy({code, reason}: {code: string; reason?: string}) {
  const t = useTranslations("EventDetail");

  const specific = reason ? `error.${code}_${reason}` : null;
  if (specific && t.has(specific)) return <>{t(specific)}</>;
  if (t.has(`error.${code}`)) return <>{t(`error.${code}`)}</>;
  return <>{t("error.unknown")}</>;
}

function Submit() {
  const t = useTranslations("EventDetail");
  const {pending} = useFormStatus();

  return (
    <div>
      <button
        type="submit"
        disabled={pending}
        // 🔴 NOT the site's `.cta` class. That class sets
        // `background: var(--cta-bg, transparent)` and paints its label through
        // a `.cta__label` child, so applying it bare to a plain <button> yields
        // a transparent button with an invisible label. It belongs to
        // `CtaButton`, which supplies the custom properties and the sweep span.
        //
        // 🔴 The transition list names `transform`, NOT `scale`. Tailwind's
        // `active:scale-[0.96]` compiles to the `transform` property, so
        // `transition-[scale]` would watch a property that never changes and
        // the press would snap with zero easing. That bug has shipped twice in
        // this repo. 120ms is the press standard.
        className="w-full rounded-full bg-black px-8 py-4 font-medium text-beige [transition:opacity_200ms,transform_120ms] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </div>
  );
}

function Field({
  name,
  label,
  invalid,
  className = "",
  ...input
}: {
  name: string;
  label: string;
  invalid?: boolean;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-14 text-black/60">
        {label}
        {input.required && <span className="text-orange"> *</span>}
      </span>
      <input
        name={name}
        aria-invalid={invalid || undefined}
        {...input}
        className={`mt-1.5 w-full rounded-lg border bg-white/60 px-4 py-2.5 outline-none transition-colors focus:border-black/40 ${
          invalid ? "border-orange" : "border-black/15"
        }`}
      />
    </label>
  );
}
