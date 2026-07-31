import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Btn,
  ErrorState,
  Eyebrow,
  Handle,
  Notice,
  PageHead,
  Panel,
  Section,
  Stamp,
  StatusDot,
  UnknownValue,
  formatStamp,
} from "@/components/admin";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";

import { requireAdmin } from "../../../_lib/auth";
import {
  LOCALE_LABELS,
  SPACE_LABELS,
  STAGE_LABELS,
  loadApplication,
  type ApplicationDetail,
  type QueueFailure,
} from "../../../_lib/startups";
import { DecideForm, RedeemForm, ResendForm } from "./DecisionForms";

/** Either the application, or the honest reason there is none to show. */
type ApplicationView =
  | { application: ApplicationDetail; failure: null }
  | { application: null; failure: QueueFailure };

/**
 * One application, and the decision.
 *
 * `force-dynamic` because the page is per-session: it reads the auth cookie and
 * must never be prerendered or shared.
 */
export const dynamic = "force-dynamic";

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resent?: string | string[] }>;
}) {
  // 🔴 AUTHORISED HERE, above the first data read. The `(protected)` layout
  // guards the render and a render is not the only thing that happens on a
  // request: React renders a page concurrently with its ancestors, so the
  // layout's `redirect()` throw does not stop this component. Measured once as
  // a correct 307 whose body still carried the whole page.
  //
  // This is the single most sensitive screen in the admin: one founder's name,
  // email, mobile number and a written description of a business that has not
  // launched.
  const admin = await requireAdmin();
  const { id } = await params;
  const { resent } = await searchParams;
  const result = await loadApplication(admin, id);

  // 🔴 Only an ABSENT row becomes a 404. A failed read is a different fact and
  // renders as one: telling somebody an application does not exist, when what
  // actually happened is that we could not look, is the collapse this whole
  // screen exists to refuse.
  if (result.state === "absent") notFound();

  // One object with two shapes, rather than two independent nullables. Testing
  // `application === null` then narrows `failure` to a real value, so the error
  // branch below carries no invented fallback sentence: a fallback nobody can
  // reach is a sentence nobody ever checks.
  //
  // 🔴 There is exactly ONE `<PageHead>` in this file, which is why the failure
  // is a branch inside the return rather than an early one. A second heading
  // source is a second h1 in the document.
  const view: ApplicationView =
    result.state === "found"
      ? { application: result.application, failure: null }
      : { application: null, failure: result.error };

  const { application, failure } = view;
  const decided = application !== null && application.status !== "pending";

  return (
    <div className="space-y-10 lg:space-y-12">
      {/* 🔴 THE ALARM, at the very top, above the page's own title. An approval
          nobody could be told about is the one failure here that silently costs
          MAZJ the founder: the row looks decided, the code exists, and the
          person is waiting on an email that never left. Filing it into a tab, an
          accordion or a toast would make it findable only by somebody already
          looking for it. */}
      {application?.emailDelivered === false && (
        <UndeliveredAlarm application={application} />
      )}

      <PageHead
        back={<BackTrail />}
        eyebrow="PROGRAMME · STARTUPS"
        title={application?.startupName ?? "Application"}
        lede={
          application ? (
            <>
              Applied <Stamp iso={application.createdAt} />
            </>
          ) : undefined
        }
        actions={
          application ? <Handle size="sm">{application.reference}</Handle> : undefined
        }
        // 🔴 The resend confirmation used to destroy itself: `refresh()` clears
        // the undelivered flag, which unmounts the alarm panel that was holding
        // the "Sent." line, so the one signal that the retry worked disappeared
        // at the instant it became true. A query parameter survives that
        // re-render, and the delivery line below is now permanent as well.
        notice={
          resent === "1" && application ? (
            <Notice tone="ok">Sent.</Notice>
          ) : undefined
        }
      />

      {application === null ? (
        <ErrorState
          title={failure.title}
          message={failure.message}
          next={failure.next}
          retry={
            <Btn variant="quiet" asChild>
              <Link href="/admin/startups">Back to the queue</Link>
            </Btn>
          }
        />
      ) : (
        <div className="space-y-10 lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-12 lg:space-y-0">
          <div className="lg:col-start-1 lg:row-start-1">
            <Section eyebrow="WHO" title="Who applied" ruled={false}>
              <dl className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
                <Fact label="Founder" value={application.founderName} />
                <Fact
                  label="Team"
                  value={
                    application.teamSize === 1
                      ? "Solo founder"
                      : `${application.teamSize} people`
                  }
                />
                <Fact
                  label="Email"
                  value={
                    <a
                      href={`mailto:${addressOnly(application.email)}`}
                      className="underline underline-offset-4 decoration-border hover:decoration-foreground"
                    >
                      {application.email}
                    </a>
                  }
                />
                <Fact
                  label="Mobile"
                  value={
                    // 🔴 A `tel:` link, and an explicit `dir="ltr"`. This screen
                    // is read on a phone as often as on a laptop and the number
                    // is the fastest way to answer somebody; an E.164 string
                    // reorders in a bidi-neutral context, which turns a correct
                    // number into a wrong one.
                    <a
                      href={`tel:${dialable(application.phone)}`}
                      dir="ltr"
                      className="underline underline-offset-4 decoration-border hover:decoration-foreground"
                    >
                      {application.phone}
                    </a>
                  }
                />
                <Fact
                  label="Stage"
                  value={STAGE_LABELS[application.stage] ?? application.stage}
                />
                <Fact
                  label="Wants"
                  value={SPACE_LABELS[application.space] ?? application.space}
                />
              </dl>
            </Section>
          </div>

          {/* The sticky decision column is the single layout change that makes
              this screen do its job: a 2000-character pitch pushed both
              irreversible controls far below the fold with no anchor back. On a
              phone this block comes BEFORE the pitch in source order, which is
              why it is not simply the second half of the left column. */}
          <aside className="space-y-6 lg:sticky lg:top-12 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <WritesIn locale={application.locale} />

            {decided ? (
              application.status === "approved" ? (
                <TheirCode application={application} />
              ) : null
            ) : (
              <DecideForm id={application.id} />
            )}
          </aside>

          <div className="space-y-10 lg:col-start-1 lg:row-start-2 lg:space-y-12">
            <Section eyebrow="THE PITCH" title="What they are building">
              {/* The screen's ONE tan block, and it carries `ruled` because tan
                  against cream is 1.17:1: without the hairline the block has no
                  edge. `whitespace-pre-line` because the pitch keeps its
                  paragraph breaks (see `cleanMultilineText`), and flattening
                  them here would undo the only reason that function exists.
                  React escapes the content. No clamp and no truncation: this is
                  the thing being judged. */}
              <Panel tier="inset" ruled pad="loose">
                <p className="max-w-[62ch] whitespace-pre-line text-15 leading-[1.625]">
                  {application.pitch}
                </p>
              </Panel>
            </Section>

            {decided && (
              <Section eyebrow="THE DECISION" title="What was decided">
                <div className="space-y-5">
                  <DecisionRecord application={application} />

                  {application.decisionNote && (
                    <div>
                      <h3 className="text-13 font-medium">
                        {application.status === "rejected"
                          ? "The reason they were sent"
                          : "Internal note"}
                      </h3>
                      <p className="mt-1.5 max-w-[62ch] whitespace-pre-line text-15 leading-[1.625]">
                        {application.decisionNote}
                      </p>
                    </div>
                  )}

                  {/* Permanent, with a time on it. The old line said "The email
                      has gone." in 3.0:1 grey and said nothing about when, which
                      is the first thing anybody asks when a founder claims they
                      never got it. The undelivered case never reaches here: it
                      is the alarm at the top of the page. */}
                  {application.emailSentAt && (
                    <StatusDot
                      tone="ok"
                      label={`Emailed ${formatStamp(application.emailSentAt)}`}
                    />
                  )}
                </div>
              </Section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The way back.
 *
 * One crumb, not two: the page's own `<h1>` sits 8px below this line and says
 * the startup's name already, so a second crumb repeating it would set the same
 * words twice in the same eyeful.
 */
function BackTrail() {
  return (
    <Breadcrumb className="mb-2">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            {/* 🔴 `next/link`, never `@/i18n/navigation`: the locale-aware
                version prepends /en or /ar, and /en/admin does not exist. */}
            <Link href="/admin/startups">Startups</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * The decision was recorded and nobody was told.
 *
 * The message is chosen by code and carries the consequence first. The one
 * upstream string on this whole surface lives inside it, deliberately: the
 * mailer's own words are the operator's only diagnostic, they are stored on the
 * row rather than logged and lost, and this is the screen where somebody is
 * about to decide whether to send it again or ring the founder.
 */
function UndeliveredAlarm({ application }: { application: ApplicationDetail }) {
  return (
    <ErrorState
      tone="destructive"
      title="They were never emailed"
      message={
        application.status === "approved"
          ? "The decision stands and the code is real. The message did not leave the building, so they have heard nothing."
          : "The decision stands. The message did not leave the building, so they have heard nothing."
      }
      next="Try again below. If it fails twice, tell them yourself: the decision is recorded and it does not need sending again to be true."
      retry={
        <div className="space-y-4">
          <div>
            <Eyebrow size={11}>What the mailer said</Eyebrow>
            <div className="mt-1.5">
              {application.emailError ? (
                <Handle size="block">{application.emailError}</Handle>
              ) : (
                <UnknownValue reason="unknown">No reason recorded</UnknownValue>
              )}
            </div>
          </div>
          <ResendForm id={application.id} />
        </div>
      }
    />
  );
}

/**
 * 🔴 Promoted out of the seven-item grid onto its own ruled line, directly
 * above the controls that send mail.
 *
 * It is not trivia. It decides which language every email to this person goes
 * out in, and it has to be read BEFORE pressing a button that sends one, not
 * found afterwards in the sixth cell of a two-column list.
 */
function WritesIn({ locale }: { locale: string }) {
  return (
    <div className="border-t border-border pt-4">
      <Eyebrow size={11}>Writes in</Eyebrow>
      <p className="mt-1 text-15 font-medium">{LOCALE_LABELS[locale] ?? locale}</p>
      <p className="mt-1 text-13 leading-[1.6] text-subtle-foreground">
        Every email to them goes out in that language, including the one a
        decision sends.
      </p>
    </div>
  );
}

/**
 * Their code, and which of its endings it reached.
 *
 * 🔴 "Mark this code as used" is offered even on an EXPIRED code, and it stays
 * a full-size control with its full label. It is the only way redemption is
 * ever recorded: Rekaz has no coupon API, no software consumes this code, and a
 * person who walked in on day 31 and was served anyway is a redemption that
 * happened. Demoting it to an icon, or disabling it on expiry, deletes the only
 * evidence the feature ever worked.
 */
function TheirCode({ application }: { application: ApplicationDetail }) {
  if (application.code === null) {
    // Today this block is skipped in silence and the only trace is a raw error
    // string inside the delivery banner, so an approval that minted nothing
    // looks exactly like one that worked.
    return (
      <ErrorState
        tone="destructive"
        title="Approved with no code."
        message="An approval mints a code. This row has none, so there is nothing to give them."
        next="Nothing was emailed. Raise this before telling the founder anything."
      />
    );
  }

  return (
    <div className="border-t border-border pt-4">
      <Eyebrow size={11}>Their code</Eyebrow>
      <p className="mt-2">
        <Handle size="lg" selectAll>
          {application.code}
        </Handle>
      </p>

      <div className="mt-3 space-y-1.5">
        <CodeStanding application={application} />
      </div>

      {application.redeemedAt === null && (
        <div className="mt-5">
          <RedeemForm id={application.id} />
        </div>
      )}
    </div>
  );
}

function CodeStanding({ application }: { application: ApplicationDetail }) {
  if (application.redeemedAt) {
    // No strikethrough anywhere near this. It is the success outcome of the
    // entire feature.
    return (
      <>
        <StatusDot
          tone="ok"
          label={
            application.redeemedBy
              ? `Used ${formatStamp(application.redeemedAt, "day")}, marked by ${application.redeemedBy}`
              : `Used ${formatStamp(application.redeemedAt, "day")}`
          }
        />
        {application.redeemedBy === null && (
          <UnknownValue reason="unknown">Who marked it is not recorded</UnknownValue>
        )}
      </>
    );
  }

  // Today the ternary chain falls through to "" here and renders a blank
  // paragraph where the code's standing belongs, which reads as "fine".
  if (application.codeExpiresAt === null) {
    return <UnknownValue reason="unknown">No expiry recorded</UnknownValue>;
  }

  if (application.codeExpired) {
    return (
      <StatusDot
        tone="warn"
        label={`Expired ${formatStamp(application.codeExpiresAt, "day")}. It is past its date.`}
      />
    );
  }

  return (
    <StatusDot
      tone="ok"
      label={`Good until ${formatStamp(application.codeExpiresAt, "day")}`}
    />
  );
}

/**
 * Who decided, and when.
 *
 * 🔴 A missing decider or a missing time is stated in words rather than dropped
 * from the sentence. The old version appended each clause only when it existed,
 * so a row with no accountability trail read as a normal row with a shorter
 * sentence.
 */
function DecisionRecord({ application }: { application: ApplicationDetail }) {
  const verb = application.status === "approved" ? "Approved" : "Rejected";

  return (
    <div className="space-y-1.5">
      <p className="text-15">
        <strong className="font-medium">{verb}</strong>
        {application.decidedAt ? (
          <>
            {" on "}
            <Stamp iso={application.decidedAt} />
          </>
        ) : null}
        {application.decidedBy ? ` by ${application.decidedBy}` : null}
      </p>
      {application.decidedAt === null && (
        <UnknownValue reason="unknown">Decision time not recorded</UnknownValue>
      )}
      {application.decidedBy === null && (
        <UnknownValue reason="unknown">Decider not recorded</UnknownValue>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>
        <Eyebrow size={11}>{label}</Eyebrow>
      </dt>
      <dd className="mt-1 text-15">{value}</dd>
    </div>
  );
}

/**
 * Percent-encode an address before it becomes the body of a `mailto:` URL,
 * keeping `@` readable.
 *
 * 🔴 THIS IS AN INJECTION GUARD, NOT TIDINESS. Both values arrive from the
 * PUBLIC `/startups` application form and are stored as typed. `mailto:` treats
 * everything after a `?` as HEADERS, so an address of the form
 *
 *     founder@startup.com?cc=someone%40elsewhere.com&subject=Re:%20your%20offer
 *
 * turns this link into a pre-addressed message with a blind third party on it
 * and a subject somebody else chose. The admin clicks "email this founder",
 * their mail client opens looking entirely normal, and whatever they write goes
 * to a stranger too.
 *
 * ⚠️ The stored value really can look like that. `looksLikeEmail` in
 * `server/domain/text.ts` rejects whitespace, commas, semicolons, colons,
 * angle brackets, parentheses, square brackets, backslashes and quotes, and it
 * does NOT reject `?`, `&` or `%`. Measured 2026-07-29: the string above passes
 * it and is accepted by the public form. Tightening that validator is the root
 * fix and belongs to `server/`; this is the guard at the point of use, which is
 * where it has to be anyway, because rows already in the table were never
 * checked against a rule that did not exist when they were written.
 *
 * `@` is restored after encoding purely so the URL stays legible in a status
 * bar. It carries no meaning to a parser once the header separators are gone.
 */
function addressOnly(value: string): string {
  return encodeURIComponent(value).replace(/%40/g, "@");
}

/**
 * The same guard for `tel:`, done the other way round.
 *
 * ⚠️ `encodeURIComponent` is WRONG here even though it is right above. It turns
 * a leading `+` into `%2B`, and the `+` is not decoration: it is the
 * international prefix, which is the whole reason an E.164 number works from
 * any country. Some dialers do not percent-decode before handing the string to
 * the radio, so encoding it risks a number that silently fails to connect,
 * which on this screen means failing to reach a founder.
 *
 * So this allows through only the characters a dialer needs, and drops the rest
 * rather than escaping them. `tel:` has no header syntax, so there is no `?cc=`
 * equivalent to defend against; the risk is simply that stored junk produces an
 * unusable link. A leading `+` survives, every other `+` does not.
 */
function dialable(value: string): string {
  // 🔴 TAKE THE LEADING PHONE-SHAPED RUN AND STOP, rather than stripping
  // non-digits out of the whole string. Stripping CONCATENATES: a stored
  // `0534600488?x=1` becomes `05346004881`, which is a valid-looking number
  // that belongs to somebody else. A link that does not work is a nuisance; a
  // link that dials the wrong person is a fault, and on this screen it would be
  // a MAZJ colleague cold-calling a stranger about a business plan.
  const [shaped = ""] = value.trim().match(/^\+?[\d\s().-]*/) ?? [];
  const digits = shaped.replace(/\D/g, "");
  if (digits.length < 7) return "";
  return shaped.trimStart().startsWith("+") ? `+${digits}` : digits;
}
