"use client";

import {useActionState, useEffect, useMemo, useRef, useState} from "react";
import {useFormStatus} from "react-dom";
import {useLocale, useTranslations} from "next-intl";

import {
  fetchAvailability,
  submitBooking,
  type BookingFormState,
} from "@/app/[locale]/spaces/_lib/actions";
import type {
  Availability,
  BookableSpace,
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

/**
 * How long a fetched calendar may be replayed before it is asked for again.
 *
 * Slots are perishable: somebody else can take the 2pm while this visitor is
 * still deciding. A minute keeps the cost off a duration comparison (the case
 * the memo exists for) without ever showing a picker that is meaningfully older
 * than the page around it. Deliberately the same minute the server's catalog
 * memo uses, so there is ONE number to keep true across the two layers.
 */
const AVAILABILITY_TTL_MS = 60_000;

/**
 * Rekaz's custom-field `type` enum, as observed on the live events hall.
 *
 * Named because `cf.type === 10` at a call site is unreadable, and because the
 * file case is the one with a behavioural consequence: Rekaz publishes no upload
 * endpoint, so a file field cannot be collected through this form at all.
 */
const REKAZ_FIELD = {text: 1, number: 2, file: 10} as const;

/** Custom fields that can honestly be rendered as an input. */
function inputCustomFields<T extends {type: number}>(fields: T[]): T[] {
  return fields.filter((f) => f.type !== REKAZ_FIELD.file);
}

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
    result: Availability;
  } | null>(null);

  /**
   * Bumped by the retry button to re-run the availability fetch.
   *
   * 🔴 A nonce, because there is nothing else for the effect to depend on. Its
   * deps are the price, the space and the flow, and a retry changes none of
   * them. Clearing `loaded` looked like it would work and did the opposite: it
   * flipped `loadingSlots` back to true and `slotsFailed` to false, so the error
   * box unmounted, "checking what is free" rendered in its place, and no request
   * was ever issued. That is a worse dead end than the one the retry was added
   * to fix, and only a full reload escaped it.
   */
  const [retryNonce, setRetryNonce] = useState(0);

  const loadingSlots = isReservation && Boolean(priceId) && loaded?.priceId !== priceId;
  const result = loaded?.priceId === priceId ? loaded.result : null;
  const availability = result?.ok ? result.days : null;
  // Distinguished from "nothing to offer", because they mean opposite things:
  // one is a fortnight with no windows in it, the other is our booking system
  // being unreachable.
  const slotsFailed = result != null && !result.ok;

  /**
   * 🔴 REK-054. "Is there anything at all in this window", NOT "did Rekaz hand
   * back any days". Every day in the window now exists whether or not it has
   * windows on it, so `availability.length` is a constant and can no longer
   * answer the question it used to be asked.
   *
   * ⚠️ It must NOT be read as "fully booked". Rekaz reports a closed day, a
   * sold-out day and a withdrawn product identically, as an absence, and does
   * not say which. The copy this gates may say only that we have nothing to
   * show.
   */
  const hasOpenDays = availability?.some((d) => d.slots.length > 0) ?? false;

  const [state, formAction] = useActionState(submitBooking, INITIAL);

  // A fresh key per mounted flow. Resubmitting the SAME booking (a double tap,
  // a retried request) carries the same key, so the server returns the original
  // payment link instead of creating a second reservation. Rekaz has no
  // idempotency of its own; this is the whole defence.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  /**
   * Availability already fetched during this page load, keyed by price.
   *
   * REK-042. Switching back to a duration already looked at cost a full round
   * trip to a tenant measured answering between 1.2 and 10.8 seconds, for an
   * answer this page was holding a moment ago. A ref rather than state, because
   * writing it must not itself render and because it is read inside the effect
   * that fills it.
   *
   * 🔴 Only SUCCESSES are kept, which is also what keeps the retry button
   * honest: the button renders only after a failure, a failure is never stored,
   * so a retry always issues a real request and can never be handed back the
   * dead end it is trying to escape.
   *
   * ⚠️ Entries EXPIRE. Slots are perishable, and replaying a picker built ten
   * minutes ago would offer times that have since gone, with the failure
   * surfacing only at the end as a conflict on the last click before payment.
   * A minute is long enough to cover somebody comparing two durations and short
   * enough that nothing on screen is meaningfully older than the page around it.
   */
  const seen = useRef(new Map<string, {at: number; result: Availability}>());

  const selectedPrice = space.prices.find((p) => p.immutableId === priceId);

  useEffect(() => {
    if (!isReservation || !priceId) return;
    let cancelled = false;

    // Already fetched during this page load and still fresh: replay it rather
    // than asking again. An expired entry is dropped on the way past, so the
    // map cannot quietly accumulate answers nobody may act on.
    //
    // 🔴 Wrapped in a resolved promise rather than written straight into state.
    // A synchronous `setState` in an effect BODY is a cascading render and a
    // lint error in this repo (`react-hooks/set-state-in-effect`), which is the
    // same rule the note on `loaded` above is about. One microtask is not a
    // round trip, and it keeps both outcomes on a single settle path.
    const remembered = seen.current.get(priceId);
    const fresh =
      remembered && Date.now() - remembered.at < AVAILABILITY_TTL_MS
        ? remembered.result
        : null;
    if (remembered && !fresh) seen.current.delete(priceId);

    const pending = fresh
      ? Promise.resolve(fresh)
      : fetchAvailability(space.slug, priceId);

    pending.then(
      (res) => {
        // Remembered BEFORE the cancel check, on purpose. A response that
        // arrives after the visitor has moved on is still a true answer for the
        // price it was asked about, so it is worth keeping even though it must
        // not be painted.
        if (res.ok) seen.current.set(priceId, {at: Date.now(), result: res});
        // `cancelled` guards the out-of-order case: switch duration twice quickly
        // and the first response can land after the second, painting slots for a
        // price the visitor is no longer looking at.
        if (cancelled) return;
        setLoaded({priceId, result: res});
        // Land on the first day that actually has capacity rather than on today,
        // which frequently has none (the weekend, or a day already past its last
        // slot).
        setDay(firstOpenDay(res));
      },
      () => {
        // 🔴 REK-052, and the cheapest customer-facing fix in the whole pass.
        //
        // This promise used to be able to settle only one way. When the action
        // REJECTED (the visitor drops off the network, a 500, or Next's
        // deployment-skew error after a redeploy) nothing ever wrote `loaded`,
        // so `loadingSlots` stayed true and "Checking what is free..." was the
        // last thing the page ever said. No error, no retry, no way out but a
        // full reload, at the step where the money is. The error-and-retry box
        // was already built and simply could not be reached from here, because
        // reaching it requires a stored result.
        //
        // Reported as the same shape `loadAvailability` uses for an upstream
        // failure, because from the visitor's side it IS the same event: we
        // asked, and no answer came back. The retry button then genuinely
        // refetches, because nothing about a failure is ever remembered.
        //
        // ⚠️ The two-argument `then`, not a trailing `.catch`. A `.catch` would
        // also swallow anything thrown by the success handler above and report
        // it to the visitor as "our booking system is not responding", which
        // would be untrue and would hide a real bug.
        if (cancelled) return;
        setLoaded({priceId, result: {ok: false, reason: "upstream"}});
        setDay("");
      }
    );

    return () => {
      cancelled = true;
    };
  }, [isReservation, priceId, space.slug, retryNonce]);

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

          {/* 🔴 The failure branch. Without it, a Rekaz outage rendered an empty
              step with a permanently disabled button and no explanation, and the
              visitor concluded MAZJ was broken rather than that a request had
              failed. Retry is offered because these outages are transient. */}
          {!loadingSlots && slotsFailed && (
            <div
              role="alert"
              className="rounded-xl border border-orange/30 bg-orange/5 px-5 py-4 text-sm"
            >
              <p className="text-black/70">{t("error.upstream_unavailable")}</p>
              <button
                type="button"
                onClick={() => setRetryNonce((n) => n + 1)}
                className="mt-3 rounded-full border border-black/20 px-4 py-1.5 text-sm [transition:opacity_200ms,transform_120ms] hover:border-black/40 active:scale-[0.96]"
              >
                {t("retry")}
              </button>
            </div>
          )}

          {!loadingSlots && availability && !hasOpenDays && (
            <p className="text-sm text-black/45">{t("noAvailability")}</p>
          )}

          {!loadingSlots && availability && hasOpenDays && (
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
                {/* 🔴 No "we are closed on this day" line, and no branch for an
                    empty day at all. `day` can only ever hold a day the strip
                    above let somebody choose, and every choosable day has slots,
                    so the branch that used to sit here was unreachable from the
                    moment it was written: the one honest closed-day string on
                    the site was the one string no visitor could ever see. It was
                    also a claim the data cannot support, since an absence means
                    closed, sold out OR withdrawn and never says which. The
                    disabled day in the strip carries that honestly, by asserting
                    nothing. */}
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

        {/* 🔴 FILE FIELDS ARE EXCLUDED, not rendered as text boxes.
            Rekaz's type 10 is a file upload, and their public API exposes NO
            upload endpoint, so whatever someone typed into a text input would
            be sent as a filename-shaped string and silently mean nothing. The
            events hall's commercial-registration field is optional
            (`isRequired: false`), so omitting it is a valid booking; it is
            requested afterwards instead. Collecting the file properly needs
            private storage and a retention rule, which is its own piece of work.
            Everything non-file still renders normally. */}
        {inputCustomFields(space.customFields).length > 0 && (
          <div className="mt-4 grid gap-4">
            {inputCustomFields(space.customFields).map((cf) => (
              <Field
                key={cf.id}
                // Prefixed so a crafted form cannot inject arbitrary keys into
                // the Rekaz payload. The server strips the prefix.
                name={`cf:${cf.name}`}
                label={t.has(`customField.${cf.name}`) ? t(`customField.${cf.name}`) : cf.label}
                required={cf.isRequired}
                type={cf.type === REKAZ_FIELD.number ? "number" : "text"}
              />
            ))}
          </div>
        )}

        {space.customFields.some((cf) => cf.type === REKAZ_FIELD.file) && (
          <p className="mt-4 rounded-xl border border-black/10 px-5 py-4 text-sm text-black/50">
            {t("documentLater")}
          </p>
        )}
      </Step>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-orange">
          {/* Copy by CODE, from i18n. The action deliberately never returns a
              message: `AppError.message` is built from the raw upstream body and
              would print Rekaz's Arabic ProblemDetails, its traceId and our
              internal paths onto the checkout page. `error.unknown` catches any
              code without its own line rather than rendering nothing. */}
          {state.code === "booking_exists" && state.reference
            ? t("error.booking_exists", {reference: state.reference})
            : t.has(`error.${state.code}`)
              ? t(`error.${state.code}`)
              : t("error.unknown")}
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

/** The first day in the window with capacity, or none when there is none. */
function firstOpenDay(result: Availability): string {
  return result.ok
    ? (result.days.find((d) => d.slots.length > 0)?.day ?? "")
    : "";
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
