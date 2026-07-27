"use client";

import {useActionState, useEffect, useMemo, useState} from "react";
import {useFormStatus} from "react-dom";
import {useLocale, useTranslations} from "next-intl";

import {
  fetchAvailability,
  submitBooking,
  type BookingFormState,
} from "@/app/[locale]/spaces/_lib/actions";
import type {
  BookableSpace,
  DaySlots,
  PriceOption,
} from "@/app/[locale]/spaces/_lib/booking";

/**
 * The booking flow, for all four spaces.
 *
 * One component rather than four because the two flows differ in exactly one
 * step: reservations pick a day and a time, subscriptions pick a start date.
 * Everything else (duration, details, hand-off) is identical, and splitting it
 * would mean maintaining the customer form twice.
 *
 * 🔴 PRICE LABELS COME FROM i18n, NOT FROM REKAZ. Rekaz's `nameEn` is
 * byte-identical to `nameAr` for this tenant, so rendering what the API returns
 * would print Arabic on the English site. Labels are looked up by the price's
 * IMMUTABLE id, which survives the id rotation that happens whenever someone
 * edits a price in the Rekaz dashboard.
 */

const INITIAL: BookingFormState = {status: "idle"};

export default function BookingFlow({space}: {space: BookableSpace}) {
  const t = useTranslations("Booking");
  const locale = useLocale();
  const isReservation = space.flow === "reservation";

  const [priceId, setPriceId] = useState<string>(
    space.prices[0]?.immutableId ?? ""
  );
  const [day, setDay] = useState<string>("");
  const [slot, setSlot] = useState<{from: string; to: string} | null>(null);
  const [startAt, setStartAt] = useState<string>(todayInRiyadh());

  /**
   * Availability, tagged with the price it was fetched for.
   *
   * Tagged rather than a bare list plus a `loading` flag, because that flag
   * would have to be raised synchronously inside the effect, which is a
   * cascading render (and a lint error). Comparing the tag to the current
   * selection DERIVES the loading state instead, so there is one source of
   * truth and no window where stale slots are shown as if they were current.
   */
  const [loaded, setLoaded] = useState<{
    priceId: string;
    days: DaySlots[] | null;
  } | null>(null);

  const loadingSlots = isReservation && Boolean(priceId) && loaded?.priceId !== priceId;
  const availability = loaded?.priceId === priceId ? loaded.days : null;

  const [state, formAction] = useActionState(submitBooking, INITIAL);

  // A fresh key per mounted flow. Resubmitting the SAME booking (a double tap,
  // a retried request) carries the same key, so the server returns the original
  // payment link instead of creating a second reservation. Rekaz has no
  // idempotency of its own; this is the whole defence.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const selectedPrice = space.prices.find((p) => p.immutableId === priceId);

  useEffect(() => {
    if (!isReservation || !priceId) return;
    let cancelled = false;

    fetchAvailability(space.slug, priceId).then((days) => {
      // `cancelled` guards the out-of-order case: switch duration twice quickly
      // and the first response can land after the second, painting slots for a
      // price the visitor is no longer looking at.
      if (cancelled) return;
      setLoaded({priceId, days});
      // Land on the first day that actually has capacity rather than on today,
      // which is frequently closed (Fri/Sat) or already past its last slot.
      setDay(days?.find((d) => d.slots.length > 0)?.day ?? "");
    });

    return () => {
      cancelled = true;
    };
  }, [isReservation, priceId, space.slug]);

  // The hand-off. Rekaz hosts the payment page and there is no API to do it
  // here, so the journey leaves at exactly this point and no earlier.
  useEffect(() => {
    if (state.status === "ready") window.location.href = state.paymentLink;
  }, [state]);

  const daySlots = availability?.find((d) => d.day === day);

  return (
    <form action={formAction} className="space-y-10">
      <input type="hidden" name="space" value={space.slug} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="priceImmutableId" value={priceId} />
      {slot && (
        <>
          <input type="hidden" name="slotFrom" value={slot.from} />
          <input type="hidden" name="slotTo" value={slot.to} />
        </>
      )}
      {!isReservation && <input type="hidden" name="startAt" value={startAt} />}

      <Step n={1} title={t("durationTitle")}>
        <div className="grid gap-2 sm:grid-cols-2">
          {space.prices.map((price) => (
            <PriceCard
              key={price.immutableId}
              price={price}
              selected={price.immutableId === priceId}
              onSelect={() => {
                // Cleared HERE, in the event handler, not in the effect. A slot
                // belongs to the duration it was chosen for: keeping it across a
                // duration change would submit a two-hour window against a
                // five-hour price.
                setPriceId(price.immutableId);
                setSlot(null);
                setDay("");
              }}
              locale={locale}
            />
          ))}
        </div>
      </Step>

      {isReservation ? (
        <Step n={2} title={t("whenTitle")}>
          {loadingSlots && <p className="text-sm text-black/45">{t("loading")}</p>}

          {!loadingSlots && availability && availability.length === 0 && (
            <p className="text-sm text-black/45">{t("noAvailability")}</p>
          )}

          {!loadingSlots && availability && availability.length > 0 && (
            <>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                {availability.map((d) => (
                  <button
                    key={d.day}
                    type="button"
                    disabled={d.slots.length === 0}
                    onClick={() => {
                      setDay(d.day);
                      setSlot(null);
                    }}
                    className={`shrink-0 rounded-xl border px-4 py-2.5 text-center transition-colors ${
                      d.day === day
                        ? "border-orange bg-orange text-white"
                        : d.slots.length === 0
                          ? "border-black/10 text-black/25"
                          : "border-black/15 hover:border-black/40"
                    }`}
                  >
                    <span className="block text-lg font-medium tabular-nums">
                      {d.day.slice(8)}
                    </span>
                    <span className="block text-xs opacity-70">
                      {weekday(d.day, locale)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(daySlots?.slots ?? []).map((s) => (
                  <button
                    key={s.from}
                    type="button"
                    onClick={() => setSlot({from: s.from, to: s.to})}
                    className={`rounded-full border px-4 py-2 text-sm tabular-nums transition-colors ${
                      slot?.from === s.from
                        ? "border-orange bg-orange text-white"
                        : "border-black/15 hover:border-black/40"
                    }`}
                  >
                    {s.startTime} - {s.endTime}
                  </button>
                ))}
                {daySlots && daySlots.slots.length === 0 && (
                  <p className="text-sm text-black/45">{t("dayClosed")}</p>
                )}
              </div>
            </>
          )}
        </Step>
      ) : (
        <Step n={2} title={t("startTitle")}>
          <input
            type="date"
            value={startAt}
            min={todayInRiyadh()}
            onChange={(e) => setStartAt(e.target.value)}
            className="rounded-lg border border-black/15 bg-white/60 px-4 py-2.5 outline-none focus:border-black/40"
          />
          <p className="mt-2 text-sm text-black/45">{t("startHint")}</p>
        </Step>
      )}

      <Step n={3} title={t("detailsTitle")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label={t("name")} required autoComplete="name" />
          <Field
            name="mobile"
            label={t("mobile")}
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
          />
          <Field
            name="email"
            label={t("email")}
            type="email"
            autoComplete="email"
            dir="ltr"
          />
        </div>

        {space.customFields.length > 0 && (
          <div className="mt-4 grid gap-4">
            {space.customFields.map((cf) => (
              <Field
                key={cf.id}
                // Prefixed so a crafted form cannot inject arbitrary keys into
                // the Rekaz payload. The server strips the prefix.
                name={`cf:${cf.name}`}
                label={t.has(`customField.${cf.name}`) ? t(`customField.${cf.name}`) : cf.label}
                required={cf.isRequired}
                type={cf.type === 2 ? "number" : "text"}
              />
            ))}
          </div>
        )}
      </Step>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-orange">
          {state.message}
        </p>
      )}

      <Submit
        disabled={isReservation ? !slot : !startAt}
        amount={selectedPrice?.amount}
        locale={locale}
      />
    </form>
  );
}

function Submit({
  disabled,
  amount,
  locale,
}: {
  disabled: boolean;
  amount?: number;
  locale: string;
}) {
  const t = useTranslations("Booking");
  const {pending} = useFormStatus();

  return (
    <div>
      <button
        type="submit"
        disabled={disabled || pending}
        // 🔴 NOT the site's `.cta` class. That class sets
        // `background: var(--cta-bg, transparent)` and paints its label through
        // a `.cta__label` child, so applying it bare to a plain <button> yields
        // a transparent button with an invisible label. It belongs to
        // `CtaButton`, which supplies the custom properties and the sweep span.
        //
        // 🔴 The transition list names `transform`, NOT `scale`. Tailwind's
        // `active:scale-[0.96]` compiles to the `transform` property, so
        // `transition-[opacity,scale]` would watch a property that never
        // changes and the press would snap with zero easing. That exact bug has
        // shipped twice here (contact socials, LocationHours map card). 120ms is
        // the repo's press standard. See components/CLAUDE.md.
        className="w-full rounded-full bg-black px-8 py-4 font-medium text-beige [transition:opacity_200ms,transform_120ms] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto"
      >
        {pending ? t("submitting") : t("submit")}
        {amount !== undefined && (
          <span className="ms-3 tabular-nums opacity-80">
            {formatAmount(amount, locale)}
          </span>
        )}
      </button>
      {/* VAT is included in Rekaz's figures. Saying so is a legal nicety and
          removes the commonest checkout question. */}
      <p className="mt-2 text-xs text-black/40">{t("vatNote")}</p>
    </div>
  );
}

function PriceCard({
  price,
  selected,
  onSelect,
  locale,
}: {
  price: PriceOption;
  selected: boolean;
  onSelect: () => void;
  locale: string;
}) {
  const t = useTranslations("Booking");
  // English label keyed by the IMMUTABLE id. Falls back to Rekaz's Arabic only
  // if a price was added in the dashboard without a translation, which the
  // catalog test is there to catch before it ships.
  const key = `price.${price.immutableId}`;
  const label = t.has(key) ? t(key) : price.labelAr;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex items-center justify-between rounded-xl border px-5 py-4 text-start transition-colors ${
        selected ? "border-orange bg-orange/5" : "border-black/15 hover:border-black/40"
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums text-black/60">
        {formatAmount(price.amount, locale)}
      </span>
    </button>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 flex items-baseline gap-3 text-lg font-medium">
        <span className="text-sm tabular-nums text-black/35">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  name,
  label,
  ...input
}: {name: string; label: string} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-sm text-black/60">
        {label}
        {input.required && <span className="text-orange"> *</span>}
      </span>
      <input
        name={name}
        {...input}
        className="mt-1.5 w-full rounded-lg border border-black/15 bg-white/60 px-4 py-2.5 outline-none transition-colors focus:border-black/40"
      />
    </label>
  );
}

/** SAR, in the reader's numerals. */
function formatAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function weekday(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
    weekday: "short",
    timeZone: "Asia/Riyadh",
  }).format(new Date(`${day}T12:00:00Z`));
}

/**
 * Today, as read at the venue.
 *
 * 🔴 Not `new Date().toISOString().slice(0,10)`. That is today in UTC, and
 * between midnight and 3am Riyadh it names YESTERDAY, so the date input would
 * open on a past day and reject the customer's own "today".
 */
function todayInRiyadh(): string {
  return new Intl.DateTimeFormat("en-CA", {timeZone: "Asia/Riyadh"}).format(
    new Date()
  );
}
