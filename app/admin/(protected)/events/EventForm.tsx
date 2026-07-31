"use client";

import {useActionState, useEffect, useState} from "react";
import {useFormStatus} from "react-dom";

// Imported file by file rather than through `@/components/admin`, on purpose.
// This is a client boundary, so anything the barrel re-exports is a candidate
// for this chunk, and one primitive ever reaching for `next/headers` or `_lib`
// would break the build of the biggest form in the tool.
import {Btn} from "@/components/admin/Btn";
import {Disclosure} from "@/components/admin/Disclosure";
import {ErrorState} from "@/components/admin/ErrorState";
import {Eyebrow} from "@/components/admin/Eyebrow";
import {Field} from "@/components/admin/Field";
import {Notice} from "@/components/admin/Notice";
import {Section} from "@/components/admin/Section";
import {UnknownValue} from "@/components/admin/UnknownValue";

import {
  removeEvent,
  saveEvent,
  type RemoveEventState,
  type SaveEventState,
} from "../../_lib/event-actions";
import type {AdminEventDetail, TicketPriceOption} from "../../_lib/events";

/**
 * The one form for creating and editing an event, and the largest surface in
 * the admin.
 *
 * One component rather than two because the only difference is a hidden `id`,
 * and keeping them apart would mean maintaining fourteen bilingual fields
 * twice, which is how a create form and an edit form drift until one of them
 * silently stops saving a column.
 *
 * 🔴 ENGLISH AND ARABIC SIT SIDE BY SIDE. Never tabs, never an accordion, never
 * a language toggle. A toggle hides the empty half, and the empty half is
 * exactly the thing this form exists to prevent: the whole site is bilingual,
 * and a published event missing one language is an Arabic visitor landing on
 * English copy. Both are required to publish and the database enforces it
 * independently of anything here.
 *
 * 🔴 EXACTLY ONE `Notice` LIVES ON THIS SCREEN and this component owns it. Two
 * alert slots is how the old login screen ended up rendering "That link was
 * invalid" directly above "Check your inbox", and the same pair is reachable
 * here: `?saved=1` survives in the URL after a save, so a page-owned "Saved."
 * would still be on screen underneath a failed second save. So the "Saved."
 * notice is passed IN as a prop and rendered through the same slot, where a
 * later failure displaces it.
 */

type Precision = AdminEventDetail["datePrecision"];

const INITIAL_SAVE: SaveEventState = {status: "idle"};
const INITIAL_REMOVE: RemoveEventState = {status: "idle"};

/**
 * Field names the write path reports that this form does not have a control
 * for.
 *
 * 🔴 The database's check constraint is named after the COLUMN (`ends_at`),
 * while the control that produces it is the Riyadh wall-clock input
 * (`endsAtLocal`). Without the alias the error summary links to an anchor that
 * is not on the page, and a browser asked to jump to a missing id does nothing
 * at all: the operator clicks and the page sits still.
 */
const FIELD_ALIASES: Record<string, string> = {
  startsAt: "startsAtLocal",
  endsAt: "endsAtLocal",
};

/** What each control is called, for the summary's jump link. */
const FIELD_LABELS: Record<string, string> = {
  titleEn: "Title",
  titleAr: "Title in Arabic",
  summaryEn: "One-line summary",
  summaryAr: "One-line summary in Arabic",
  startsAtLocal: "Starts",
  endsAtLocal: "Ends",
  datePrecision: "How much of this date was recorded",
  capacity: "Seats",
  rekazPriceImmutableId: "Ticket",
  poster: "Poster",
  status: "Status",
  slug: "Link",
};

const POSTER_ACCEPT = "image/jpeg,image/png,image/webp";

export default function EventForm({
  event,
  ticketOptions,
  rekazReachable,
  saved = false,
}: {
  /** Absent when creating. */
  event?: AdminEventDetail;
  ticketOptions: TicketPriceOption[];
  rekazReachable: boolean;
  /** True on `?saved=1`, i.e. the redirect this form's own action just made. */
  saved?: boolean;
}) {
  const [saveState, saveAction] = useActionState(saveEvent, INITIAL_SAVE);
  const [removeState, removeAction] = useActionState(
    removeEvent,
    INITIAL_REMOVE
  );

  const [ticketed, setTicketed] = useState(
    Boolean(event?.rekazPriceImmutableId)
  );

  /**
   * 🔴 THE ONLY TWO CONTROLLED FIELDS ON THIS FORM, and the inconsistency is
   * deliberate rather than sloppy. Everything else is uncontrolled with a
   * `defaultValue`, which is what keeps a fourteen-field bilingual form cheap.
   * These two are controlled because picking a ticket WRITES to them, and the
   * alternative is reaching into the DOM by id from an event handler to set
   * `.value` on somebody else's input.
   *
   * ⚠️ There is no English pair, and there never can be: `nameEn` is
   * byte-identical to `nameAr` on every product in this tenant, so "the English
   * one" does not exist. Prefilling English from Rekaz would put Arabic on the
   * English page, which is the exact failure the whole i18n rule exists to stop.
   */
  const [titleAr, setTitleAr] = useState(event?.titleAr ?? "");
  const [descriptionAr, setDescriptionAr] = useState(
    event?.descriptionAr ?? ""
  );

  /**
   * Picking a ticket fills the empty Arabic boxes from the Rekaz product.
   *
   * 🔴 PREFILL, NOT SYNC, and the difference is the whole safety of it. It only
   * ever writes into a field that is blank, so it can never overwrite something
   * the operator typed, and it never runs again on its own. Rekaz stays the
   * source of truth for the PRICE, which is read live; the event's words stay
   * the source of truth here. Two-way sync would have made a Rekaz product the
   * owner of an event's identity, and 41 of MAZJ's 41 events have no product at
   * all, so that would mean two different ways to author an event.
   */
  const applyTicket = (immutableId: string) => {
    setTicketed(immutableId !== "");

    const option = ticketOptions.find((o) => o.immutableId === immutableId);
    if (!option) return;

    setTitleAr((current) => (current.trim() ? current : option.productName));
    setDescriptionAr((current) =>
      current.trim() ? current : (option.productDescription ?? "")
    );
  };

  // What the RECORD says, which is fixed for the life of this render, versus
  // what the operator has currently selected. The control only exists when the
  // two can differ.
  const recordPrecision: Precision = event?.datePrecision ?? "exact";
  const [precision, setPrecision] = useState<Precision>(recordPrecision);

  /**
   * 🔴 The ticket trap. A paid event plus an unreachable Rekaz used to render
   * the select defaulted to "Free", with an explainer two lines below
   * contradicting it, and saving ANY unrelated field then converted a paid
   * event to a free one permanently. The select is replaced rather than
   * defaulted, and a hidden input round-trips the id it cannot display.
   */
  const ticketTrap = Boolean(event?.rekazPriceImmutableId) && !rekazReachable;

  const badField =
    saveState.status === "error" && saveState.field
      ? (FIELD_ALIASES[saveState.field] ?? saveState.field)
      : undefined;

  const errorFor = (name: string): string | undefined =>
    saveState.status === "error" && badField === name
      ? saveState.message
      : undefined;

  // Focus moves to the notice on a failure, which is what makes one alert slot
  // workable: the delete control sits at the very bottom of a long form and its
  // message renders at the very top. `Notice` carries the tabIndex and the data
  // attribute for exactly this. Never on mount, or the "Saved." notice would
  // steal focus and scroll the page on every arrival.
  useEffect(() => {
    if (saveState.status !== "error" && removeState.status !== "error") return;
    document.querySelector<HTMLElement>("[data-admin-notice]")?.focus();
  }, [saveState, removeState]);

  return (
    <div className="space-y-10 lg:space-y-12">
      <NoticeSlot
        saveState={saveState}
        removeState={removeState}
        saved={saved}
        badField={badField}
        rekazReachable={rekazReachable}
        ticketTrap={ticketTrap}
      />

      <form action={saveAction} className="space-y-10 lg:space-y-12">
        {event && <input type="hidden" name="id" value={event.id} />}
        {event?.posterPath && (
          <input type="hidden" name="posterPath" value={event.posterPath} />
        )}

        {/* Ruled only when something precedes it. On the new-event route this
            is the first block under the head, whose own hairline is 40px above;
            on the edit route the sign-ups section sits between them and the
            rhythm needs its rule back. */}
        <Section
          eyebrow="THE EVENT"
          title="What it is"
          subtitle="Both languages are required to publish."
          ruled={Boolean(event)}
        >
          <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
            {/* Column headings, desktop only. Below md the two controls stack,
                where a heading would float away from the field it names, so the
                language lives in each label instead and is never absent. */}
            <Eyebrow size={11} className="hidden md:block">
              English
            </Eyebrow>
            <Eyebrow size={11} className="hidden md:block">
              <span dir="rtl" lang="ar">
                العربية
              </span>
            </Eyebrow>

            <Field
              id="field-titleEn"
              name="titleEn"
              label="Title"
              required
              defaultValue={event?.titleEn ?? ""}
              error={errorFor("titleEn")}
            />
            <Field
              id="field-titleAr"
              name="titleAr"
              label="Title in Arabic"
              required
              dir="rtl"
              lang="ar"
              value={titleAr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setTitleAr(e.currentTarget.value)
              }
              error={errorFor("titleAr")}
            />

            <Field
              id="field-summaryEn"
              name="summaryEn"
              label="One-line summary"
              required
              defaultValue={event?.summaryEn ?? ""}
              hint="Shown on the card and used as the page description."
              error={errorFor("summaryEn")}
            />
            <Field
              id="field-summaryAr"
              name="summaryAr"
              label="One-line summary in Arabic"
              required
              dir="rtl"
              lang="ar"
              defaultValue={event?.summaryAr ?? ""}
              error={errorFor("summaryAr")}
            />

            <Field
              id="field-descriptionEn"
              name="descriptionEn"
              label="Description"
              as="textarea"
              rows={6}
              defaultValue={event?.descriptionEn ?? ""}
              hint="Optional. An event with no description and no poster does not get its own page once it is over."
            />
            <Field
              id="field-descriptionAr"
              name="descriptionAr"
              label="Description in Arabic"
              as="textarea"
              rows={6}
              dir="rtl"
              lang="ar"
              value={descriptionAr}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDescriptionAr(e.currentTarget.value)
              }
            />

            <Field
              id="field-hostEn"
              name="hostEn"
              label="Host"
              defaultValue={event?.hostEn ?? ""}
              hint="Who is running it. Optional."
            />
            <Field
              id="field-hostAr"
              name="hostAr"
              label="Host in Arabic"
              dir="rtl"
              lang="ar"
              defaultValue={event?.hostAr ?? ""}
            />

            <Field
              id="field-locationEn"
              name="locationEn"
              label="Where"
              defaultValue={event?.locationEn ?? ""}
              hint="Leave blank for MAZJ, Al-Khobar."
            />
            <Field
              id="field-locationAr"
              name="locationAr"
              label="Where, in Arabic"
              dir="rtl"
              lang="ar"
              defaultValue={event?.locationAr ?? ""}
            />
          </div>
        </Section>

        {/* 🔴 The subtitle below is the only thing on this screen telling an
            operator that a `datetime-local` value is read as Riyadh wall-clock
            and not as their browser's zone. An event typed at 7pm from another
            country is stored, published and shared hours out, with nothing
            looking wrong until people arrive. It is written once, here, so a
            copy pass can find it: do not restate it in this comment. */}
        <Section
          eyebrow="WHEN"
          title="Date and time"
          subtitle="Times are Al-Khobar time, wherever you are."
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                id="field-startsAtLocal"
                name="startsAtLocal"
                label="Starts"
                type="datetime-local"
                required
                readOnly={precision !== "exact"}
                defaultValue={event?.startsAtLocal}
                error={errorFor("startsAtLocal")}
              />
              <Field
                id="field-endsAtLocal"
                name="endsAtLocal"
                label="Ends"
                type="datetime-local"
                required
                readOnly={precision !== "exact"}
                defaultValue={event?.endsAtLocal}
                hint="Registration closes when the event starts, and it moves into the archive when it ends."
                error={errorFor("endsAtLocal")}
              />
            </div>

            {recordPrecision === "exact" ? (
              <input type="hidden" name="datePrecision" value="exact" />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  id="field-datePrecision"
                  name="datePrecision"
                  label="How much of this date was recorded"
                  as="select"
                  defaultValue={recordPrecision}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setPrecision(e.currentTarget.value as Precision)
                  }
                  hint={
                    recordPrecision === "month"
                      ? "This event only records a month. Saving with an exact time will publish an hour nobody recorded."
                      : "This event only records a day. Saving with an exact time will publish an hour nobody recorded."
                  }
                  error={errorFor("datePrecision")}
                >
                  <option value="exact">Exact time</option>
                  <option value="day">Day only</option>
                  <option value="month">Month only</option>
                </Field>
              </div>
            )}

            {/* Read-only rather than disabled, and that is not a softening: a
                disabled control submits NOTHING, so the stored instant would
                arrive blank and the save would fail on a date the operator
                never touched. */}
            {precision !== "exact" && (
              <UnknownValue reason="unknown">No time recorded</UnknownValue>
            )}
          </div>
        </Section>

        <Section
          eyebrow="THE POSTER"
          title="Artwork"
          subtitle="JPG, PNG or WebP, up to 5 MB."
        >
          <div className="space-y-5">
            {event?.posterUrl && (
              <div className="flex flex-wrap items-center gap-5">
                {/* The hairline is an `after:` pseudo-element rather than an
                    inset box-shadow on the image: an inset shadow paints UNDER
                    an opaque image in a clipped box and is invisible. Same
                    idiom as `MediaFrame` on the marketing site. */}
                <div className="relative size-24 shrink-0 after:absolute after:inset-0 after:rounded-2xl after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] after:content-['']">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={event.posterUrl}
                    alt="The poster on this event now"
                    className="size-24 rounded-2xl object-cover"
                  />
                </div>
                <label className="flex items-center gap-2 text-13">
                  {/* A native checkbox, never the vendored one: that one is
                      Radix and posts nothing without a name/value pair, inside
                      a form that submits natively. */}
                  <input
                    type="checkbox"
                    name="removePoster"
                    className="size-4 rounded-sm accent-foreground"
                  />
                  Remove this poster
                </label>
              </div>
            )}

            <Field
              id="field-poster"
              name="poster"
              label={event?.posterUrl ? "Replace poster" : "Poster"}
              type="file"
              accept={POSTER_ACCEPT}
              hint="If you also choose a file, the new poster replaces the old one and the Remove tick is ignored."
              error={errorFor("poster")}
            />
          </div>
        </Section>

        <Section eyebrow="THE TICKET" title="Seats and ticket">
          <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
            {/* 🔴 Read-only, NEVER disabled, once a ticket is picked. Same
                reason as the date control below: a disabled input submits
                nothing, so saving any unrelated field would arrive with a blank
                capacity and silently wipe a number somebody typed on purpose.
                Read-only keeps the stored value and still says "this does not
                apply", which is the honest state: seats for a ticketed event
                are counted in Rekaz, because no sign-up is recorded here. */}
            <Field
              id="field-capacity"
              name="capacity"
              label="Seats"
              type="number"
              min={1}
              max={5000}
              readOnly={ticketed}
              defaultValue={event?.capacity?.toString() ?? ""}
              hint={
                ticketed
                  ? "Not used for a ticketed event. Nobody signs up here, so nothing is counted against this. Rekaz holds the ticket count."
                  : "Blank means no limit. Al-Ma'arij seats 30."
              }
              error={errorFor("capacity")}
            />

            <div className="space-y-3">
              {ticketTrap && event?.rekazPriceImmutableId ? (
                <>
                  <ErrorState
                    title="The ticket cannot be shown"
                    message="This event has a paid ticket and Rekaz is not answering, so the price cannot be shown."
                    next="Saving now would leave the ticket exactly as it is."
                  />
                  <input
                    type="hidden"
                    name="rekazPriceImmutableId"
                    value={event.rekazPriceImmutableId}
                  />
                </>
              ) : (
                <Field
                  id="field-rekazPriceImmutableId"
                  name="rekazPriceImmutableId"
                  label="Ticket"
                  as="select"
                  defaultValue={event?.rekazPriceImmutableId ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    applyTicket(e.currentTarget.value)
                  }
                  error={errorFor("rekazPriceImmutableId")}
                >
                  <option value="">Free</option>
                  {ticketOptions.map((option) => (
                    // Rekaz holds no English content, so every one of these is
                    // Arabic. `dir` and `lang` go on the option element itself:
                    // an <option> may hold text and nothing else, so the `Ar`
                    // primitive's span cannot wrap it, and without the
                    // attributes the trailing "50 SAR" reorders inside the
                    // Arabic run.
                    <option
                      key={option.immutableId}
                      value={option.immutableId}
                      dir="rtl"
                      lang="ar"
                    >
                      {`${option.productName} · ${option.label} · ${option.amount} SAR`}
                    </option>
                  ))}
                </Field>
              )}

              {/* 🔴 An empty list with Rekaz ANSWERING is a setup step, not a
                  failure, and it is today's live production state. Colouring it
                  as an error sends the owner chasing a bug that does not exist:
                  Rekaz's catalog is read-only over the API, so this site
                  genuinely cannot create the product. */}
              {rekazReachable && ticketOptions.length === 0 && (
                <p className="text-13 leading-[1.6] text-subtle-foreground">
                  No ticket prices found. In the Rekaz dashboard, create a
                  one-time product (for example تذكرة فعالية) and add a price to
                  it per paid event. It appears here straight away. Room
                  products are deliberately excluded from this list.
                </p>
              )}

              {ticketed && (
                <p className="text-13 leading-[1.6] text-subtle-foreground">
                  The event page shows this price and sends buyers to the
                  product&apos;s own page on the Rekaz store. Nobody signs up
                  here, so there is no attendee list and no CSV. Set a quantity
                  on the product in Rekaz and this page will show tickets left
                  and go to Fully booked on its own. Picking a ticket fills any
                  empty Arabic title and description from the product; the
                  English is yours to write, because Rekaz holds none.
                </p>
              )}
            </div>
          </div>
        </Section>

        <Section eyebrow="PUBLISHING" title="Where it appears">
          <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
            <Field
              id="field-status"
              name="status"
              label="Status"
              as="select"
              defaultValue={event?.status ?? "draft"}
              error={errorFor("status")}
            >
              <option value="draft">Draft, not on the site</option>
              <option value="published">Published, live on the site</option>
              <option value="cancelled">Cancelled, hidden</option>
            </Field>

            <Field
              id="field-slug"
              name="slug"
              label="Link"
              defaultValue={event?.slug ?? ""}
              hint={
                event
                  ? "Changing this breaks every link already shared for this event."
                  : "Leave blank and it is made from the English title."
              }
              error={errorFor("slug")}
            />

            <Field
              id="field-series"
              name="series"
              label="Series"
              defaultValue={event?.series ?? ""}
              hint="Optional, for example coffeeSketch."
            />
            <Field
              id="field-edition"
              name="edition"
              label="Edition"
              defaultValue={event?.edition ?? ""}
              hint="Optional, for example V10."
            />
          </div>
        </Section>

        <Save />
      </form>

      {event && <DangerZone event={event} action={removeAction} />}
    </div>
  );
}

/**
 * The screen's single alert slot, in priority order.
 *
 * A failure always displaces a success, which is what stops "Saved." (still
 * true of the URL, because `?saved=1` survives a client-side action) sitting
 * above "Fix this field" as a contradictory pair.
 */
function NoticeSlot({
  saveState,
  removeState,
  saved,
  badField,
  rekazReachable,
  ticketTrap,
}: {
  saveState: SaveEventState;
  removeState: RemoveEventState;
  saved: boolean;
  badField?: string;
  rekazReachable: boolean;
  ticketTrap: boolean;
}) {
  if (removeState.status === "error") {
    return (
      <Notice tone="destructive" live="assertive">
        {removeState.message}
      </Notice>
    );
  }

  if (saveState.status === "error") {
    return (
      <Notice
        tone="destructive"
        live="assertive"
        detail={
          badField ? (
            // A native anchor jump, no JavaScript. The browser moves focus to
            // the control because it is focusable, so the keyboard lands where
            // the pointer would have.
            <a
              href={`#field-${badField}`}
              className="underline underline-offset-4"
            >
              Go to {FIELD_LABELS[badField] ?? badField}
            </a>
          ) : undefined
        }
      >
        {saveState.message}
      </Notice>
    );
  }

  if (saveState.status === "saved" || saved) {
    return <Notice tone="ok">Saved.</Notice>;
  }

  // Suppressed when the trap above is rendering, which says the same thing
  // about the same outage in the one place it changes what Save will do.
  if (!rekazReachable && !ticketTrap) {
    return (
      <Notice
        tone="destructive"
        detail="You can still save this event as free, or as a draft, and add the ticket later."
      >
        No ticket price can be picked right now. Rekaz is not answering.
      </Notice>
    );
  }

  return null;
}

/**
 * 🔴 `pending` sets `aria-disabled`, not `disabled`: a real `disabled` on the
 * focused button drops keyboard focus to `<body>` at the exact moment somebody
 * submits. Preventing the second submit is therefore this form's job, which is
 * what the click guard is.
 */
function Save() {
  const {pending} = useFormStatus();

  return (
    <Btn
      type="submit"
      variant="solid"
      pending={pending}
      pendingLabel="Saving"
      onClick={(e) => {
        if (pending) e.preventDefault();
      }}
    >
      Save event
    </Btn>
  );
}

/**
 * Deleting, behind a disclosure and a typed confirmation.
 *
 * 🔴 NO BLOCKING `confirm()` AND NO MODAL. `confirm()` blocks the event loop
 * and every automated check that drives this screen, and a modal replaces a
 * guard the operator can read with one they dismiss. The guard here is having
 * to type the event's own link, which is native validation and needs no
 * JavaScript.
 *
 * ⚠️ A SEPARATE `<form>`, a sibling of the save form rather than a child.
 * Nested forms are invalid HTML and the inner one is simply dropped, which
 * would attach this button to the save action.
 */
function DangerZone({
  event,
  action,
}: {
  event: AdminEventDetail;
  action: (formData: FormData) => void;
}) {
  return (
    <Section eyebrow="DANGER" title="Delete this event">
      <Disclosure label="Delete this event" tone="destructive">
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={event.id} />
          <input type="hidden" name="slug" value={event.slug} />
          {event.posterPath && (
            <input type="hidden" name="posterPath" value={event.posterPath} />
          )}

          <p className="max-w-[62ch] text-14 leading-[1.6]">
            Deleting removes the event, its poster and every sign-up for it.
            There is no undo. To take an event off the site without losing who
            signed up, set its status to Cancelled instead.
          </p>

          <Field
            id="field-confirmSlug"
            name="confirmSlug"
            label={`Type ${event.slug} to confirm`}
            required
            autoComplete="off"
            // No escaping: `isValidSlug` restricts a slug to lowercase letters,
            // digits and hyphens, and a hyphen outside a character class is a
            // literal. Anything else could never have been stored.
            pattern={event.slug}
          />

          <DeleteButton />
        </form>
      </Disclosure>
    </Section>
  );
}

function DeleteButton() {
  const {pending} = useFormStatus();

  return (
    <Btn
      type="submit"
      variant="danger"
      pending={pending}
      pendingLabel="Deleting"
      onClick={(e) => {
        if (pending) e.preventDefault();
      }}
    >
      Delete this event
    </Btn>
  );
}
