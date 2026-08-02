"use client";

import {useActionState, useEffect, useMemo, useRef, useState} from "react";
import {useFormStatus} from "react-dom";
import {useLocale, useTranslations} from "next-intl";

import {Link} from "@/i18n/navigation";
import {
  submitApplication,
  type ApplicationFormState,
} from "@/app/[locale]/startups/_lib/actions";

/**
 * The startups & builders application.
 *
 * Eight fields, because that was the owner's call: enough to judge without a
 * founder abandoning it at midnight. Everything it collects is validated again
 * server-side; nothing typed here is trusted, including the locale.
 *
 * 🔴 ERROR COPY COMES FROM i18n BY CODE, never from the action. The action
 * deliberately returns a code, because a returned `AppError.message` serialises
 * to the browser verbatim and this path's messages carry database and provider
 * detail. See the comment on `ApplicationFormState`.
 */

const INITIAL: ApplicationFormState = {status: "idle"};

const STAGES = ["idea", "building", "earning"] as const;
const SPACES = [
  "shared_seat",
  "private_office",
  "meeting_room",
  "event_hall",
] as const;

export default function StartupApplicationForm() {
  const t = useTranslations("Startups");
  const locale = useLocale();
  const [state, formAction] = useActionState(submitApplication, INITIAL);
  const [stage, setStage] = useState<string>(STAGES[0]);

  /**
   * One key per mounted form, resubmitted unchanged on a retry.
   *
   * That is the whole double-submit defence: press Send twice, or press it once
   * on a flaky connection the browser retries, and the server replays the first
   * result instead of filing a second application. `useMemo` with no deps so it
   * survives every re-render of this component but not a fresh mount.
   */
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const doneRef = useRef<HTMLHeadingElement>(null);

  // Focus moves to the confirmation when the form is replaced by it. Without
  // this a keyboard or screen-reader user is left on a button that no longer
  // exists and hears nothing about what happened.
  useEffect(() => {
    if (state.status === "sent") doneRef.current?.focus();
  }, [state.status]);

  if (state.status === "sent") {
    return (
      <div className="rounded-[16px] border border-black/12 p-8 lg:p-10">
        <h3
          ref={doneRef}
          tabIndex={-1}
          className="text-balance font-sans text-28 font-bold leading-[1.2] text-black outline-none lg:text-32"
        >
          {t("successTitle")}
        </h3>
        <p className="mt-4 max-w-[52ch] text-pretty text-15 leading-relaxed text-muted lg:text-16">
          {t("successBody")}
        </p>

        <p className="eyebrow mt-8 text-12 text-muted">{t("successReference")}</p>
        {/* dir="ltr" and tabular figures: the reference is an ASCII code, and in
            an RTL paragraph a bare `MZ-7K3QD9` otherwise reorders on screen into
            something the founder cannot read back to us over the phone. */}
        <p
          dir="ltr"
          className="mt-1 font-mono text-24 font-bold tracking-[0.12em] text-black rtl:text-end"
        >
          {state.reference}
        </p>

        <p className="mt-6 max-w-[52ch] text-pretty text-14 leading-relaxed text-muted">
          {t("successNext")}
        </p>

        <Link
          href="/spaces"
          className="mt-8 inline-flex min-h-[44px] items-center text-14 text-black underline decoration-black/30 underline-offset-4 hover:decoration-black [transition:text-decoration-color_200ms,transform_120ms] active:scale-[0.96]"
        >
          {t("successCta")}
        </Link>
      </div>
    );
  }

  const failedField = state.status === "error" ? state.field : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {/* 🔴 The locale travels with the submission. A Server Action has no route
          context, so without this the server cannot know which language this
          founder was reading, and every approval and rejection would go out in
          English. The server narrows it to en|ar, so a crafted value is inert. */}
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          name="founderName"
          label={t("founderName")}
          autoComplete="name"
          maxLength={120}
          required
          invalid={failedField === "founderName"}
        />
        <Field
          name="startupName"
          label={t("startupName")}
          autoComplete="organization"
          maxLength={120}
          required
          invalid={failedField === "startupName"}
        />
        <Field
          name="email"
          label={t("email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={254}
          dir="ltr"
          required
          invalid={failedField === "email"}
        />
        <Field
          name="mobile"
          label={t("mobile")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={40}
          dir="ltr"
          required
          invalid={failedField === "mobile"}
        />
      </div>

      <label className="block">
        <span className="block text-14 text-muted">
          {t("pitch")}
          <RequiredMark />
        </span>
        <textarea
          name="pitch"
          rows={5}
          required
          minLength={20}
          maxLength={2000}
          aria-invalid={failedField === "pitch" || undefined}
          className={`mt-2 w-full resize-y rounded-[8px] border bg-white/60 px-4 py-3 text-15 outline-none transition-colors focus:border-black/40 ${
            failedField === "pitch" ? "border-orange" : "border-black/15"
          }`}
        />
        <span className="mt-1.5 block text-13 text-muted">{t("pitchHint")}</span>
      </label>

      <fieldset className="border-0 p-0">
        <legend className="block text-14 text-muted">
          {t("stage")}
          <RequiredMark />
        </legend>
        {/* Radios rather than a select: three options are faster to choose than
            to open, and the whole set stays visible while deciding. Rendered as
            pills to match the booking flow's duration cards. */}
        <div className="mt-2 flex flex-wrap gap-2">
          {STAGES.map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-full border px-5 py-2.5 text-14 [transition:border-color_200ms,background-color_200ms,transform_120ms] active:scale-[0.96] ${
                stage === value
                  ? "border-orange bg-orange/5 text-black"
                  : "border-black/15 text-muted hover:border-black/40"
              }`}
            >
              <input
                type="radio"
                name="stage"
                value={value}
                checked={stage === value}
                onChange={() => setStage(value)}
                // Visually hidden rather than `hidden`: a `display:none` input
                // is skipped by keyboard navigation entirely, so the whole
                // group would be unreachable without a mouse.
                className="sr-only"
                required
              />
              {t(`stageOptions.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          name="teamSize"
          label={t("teamSize")}
          type="number"
          inputMode="numeric"
          min={1}
          max={200}
          defaultValue={1}
          dir="ltr"
          required
          invalid={failedField === "teamSize"}
        />

        <label className="block">
          <span className="block text-14 text-muted">
            {t("space")}
            <RequiredMark />
          </span>
          <select
            name="space"
            required
            defaultValue={SPACES[0]}
            aria-invalid={failedField === "space" || undefined}
            className={`mt-2 min-h-[46px] w-full rounded-[8px] border bg-white/60 px-4 py-2.5 text-15 outline-none transition-colors focus:border-black/40 ${
              failedField === "space" ? "border-orange" : "border-black/15"
            }`}
          >
            {SPACES.map((value) => (
              <option key={value} value={value}>
                {t(`spaceOptions.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-pretty text-14 text-orange">
          {errorCopy(t, state)}
        </p>
      )}

      <Submit />

      <p className="text-pretty text-13 leading-relaxed text-muted">
        {t("consent")}{" "}
        <Link
          href="/privacy"
          className="underline decoration-black/30 underline-offset-4 hover:decoration-black [transition:text-decoration-color_200ms]"
        >
          {t("privacyLink")}
        </Link>
        .
      </p>
    </form>
  );
}

/**
 * Which sentence a failure gets.
 *
 * 🔴 A field message ONLY for `validation_failed`. The duplicate-application
 * case is a `conflict` that also names the email field, and pointing at the
 * input with "check your email address" would be actively wrong: the address is
 * fine, the application already exists. Ordering this by code rather than by
 * "is there a field" is what keeps those apart.
 */
function errorCopy(
  t: ReturnType<typeof useTranslations<"Startups">>,
  state: Extract<ApplicationFormState, {status: "error"}>
): string {
  if (state.code === "validation_failed" && state.field) {
    const key = `error.field.${state.field}`;
    if (t.has(key)) return t(key);
  }
  const key = `error.${state.code}`;
  // `error.unknown` catches any code without its own line, rather than
  // rendering an empty paragraph that reads as the form silently failing.
  return t.has(key) ? t(key) : t("error.unknown");
}

function Submit() {
  const t = useTranslations("Startups");
  const {pending} = useFormStatus();

  return (
    <div>
      <button
        type="submit"
        disabled={pending}
        // 🔴 NOT the site's `.cta` class. That sets `background: var(--cta-bg,
        // transparent)` and paints its label through a `.cta__label` child, so
        // on a bare <button> it renders transparent with an invisible label.
        //
        // 🔴 The transition list names `transform`, NOT `scale`. Tailwind's
        // `active:scale-[0.96]` compiles to the `transform` property, so
        // `transition-[scale]` would watch a property that never changes and
        // the press would snap with no easing. That bug has shipped twice here.
        className="w-full rounded-full bg-black px-8 py-4 font-medium text-beige [transition:opacity_200ms,transform_120ms] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </div>
  );
}

function RequiredMark() {
  // Coral, and aria-hidden: the asterisk is a visual convention and the inputs
  // already carry `required`, so announcing "star" on every label is noise.
  return (
    <span aria-hidden="true" className="text-orange">
      {" *"}
    </span>
  );
}

function Field({
  name,
  label,
  invalid,
  ...input
}: {
  name: string;
  label: string;
  invalid?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-14 text-muted">
        {label}
        {input.required && <RequiredMark />}
      </span>
      <input
        name={name}
        {...input}
        aria-invalid={invalid || undefined}
        className={`mt-2 min-h-[46px] w-full rounded-[8px] border bg-white/60 px-4 py-2.5 text-15 outline-none transition-colors focus:border-black/40 ${
          invalid ? "border-orange" : "border-black/15"
        }`}
      />
    </label>
  );
}
