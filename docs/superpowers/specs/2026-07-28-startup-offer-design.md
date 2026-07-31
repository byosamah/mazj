# The startups & builders offer: apply, decide, tell them

Design record, 2026-07-28. Owner decisions taken in-session via eight explicit
questions; each is recorded below beside the constraint it answers.

Related: [`../../rekaz-api-findings.md`](../../rekaz-api-findings.md) (why a code
cannot discount anything automatically), [`../../../TONE.md`](../../../TONE.md)
§6 (the closed envelope), [`2026-07-27-admin-dashboard-design.md`](./2026-07-27-admin-dashboard-design.md)
(the admin's shape and its three gates).

---

## 1. What exists today, and what is missing

`components/FoundingBand.tsx` sells a startups & builders offer on the landing
page. Its CTA opens WhatsApp with a prefilled message. That is the entire
feature: there is no page explaining the offer, no application, no record of who
asked, and no way to say yes or no other than by hand in a chat thread.

What the owner asked for: a page that explains the offer and takes applications,
those applications arriving in `/admin`, an approval that issues a code the
startup can use, a rejection that explains itself, and a branded email either
way.

## 2. The one constraint that shapes everything

🔴 **Rekaz has no coupon, discount or promotion API.** Recorded in
`docs/rekaz-api-findings.md` line 277, confirmed against the live tenant. Our own
booking path resolves prices server-side from `GET /products` and can only send a
`priceId`; there is no field anywhere that applies a discount.

So an offer code **cannot** be redeemed by software, on this site or on mazj.sa.
Any design that implies otherwise is lying to the founder holding the code.

**Owner decision:** the code is honoured by the team. The approved startup
presents it, MAZJ applies the offer at the desk or on WhatsApp, and `/admin`
records that it was used. Nothing in Rekaz changes.

The consequence to state plainly in the email copy: the code is an entitlement,
not a checkout coupon. It is redeemed by a person, not by a form.

## 3. Owner decisions

| Question | Decision |
|---|---|
| What the code does | Honoured manually by the team; `/admin` tracks redemption |
| Email delivery | Resend, sending from **mazj.sa** |
| How much the page reveals | **Closed envelope.** No terms, amounts or durations, per `TONE.md` §6 |
| Form fields | Lean plus qualifiers: founder, startup, email, phone, pitch, stage, team size, space |
| URL | `/startups` (both locales, in the sitemap) |
| Code expiry | **30 days** from approval, stated in the email as a date |
| New-application alert | Email to `info@mazj.org` on every submission |
| The landing band | Its CTA now opens `/startups` instead of WhatsApp |

## 4. Shape

```
PUBLIC                          ADMIN                      OUTBOUND

/[locale]/startups              /admin/startups            Resend
  page.tsx      the offer         page.tsx    the queue      applicant: received
  _lib/actions  submit            [id]/page   one decision   applicant: approved
  StartupForm   client form       _lib/       view models    applicant: rejected
                                                            MAZJ:      new application
        \                              /
         \                            /
          server/services/startup-application.ts
          server/domain/startup-offer.ts     (pure: codes, enums, expiry)
          server/email/                      (client, copy, templates)
                          |
              public.startup_applications
```

Every layer already exists in this repo; nothing here invents a new pattern. The
public form is a Server Action returning an error **code** (never a message,
per the leak fixed on the booking form). The admin page guards itself with
`requireAdmin()` above its first data read. The service owns rate limiting,
idempotency and validation, because the action must not be the only thing
standing between a stranger and the table.

## 5. The table

`public.startup_applications`, RLS enabled with zero policies and privileges
revoked from `anon` / `authenticated` in the same migration, per the standing
posture.

| Column | Why it exists |
|---|---|
| `id`, `created_at`, `updated_at` | Standard. `updated_at` via the shared `set_updated_at()` trigger. |
| `reference` | Short human handle (`MZ-XXXXXX`) shown on the confirmation screen and in every email. Without it a founder messaging WhatsApp has nothing to quote. |
| `founder_name`, `startup_name` | Bounded 1..120. Rendered on an internal screen, so bounded at the database too. |
| `email`, `phone_e164` | The two ways to answer. Phone normalised to E.164 by `domain/phone.ts`, which already handles Arabic-Indic digits. |
| `pitch` | 20..2000. The thing being judged. A floor of 20 rejects "hi". |
| `stage`, `team_size`, `space` | The qualifiers. `space` mirrors `lib/links.ts` `BOOKING`, asserted by a sync test, exactly as `leads` did. |
| `locale` | Which language to write back in. An Arabic applicant getting an English rejection is a small insult that costs nothing to avoid. |
| `status` | `pending` / `approved` / `rejected`. |
| `decided_at`, `decided_by`, `decision_note` | Who decided, when, and for a rejection, why. `decision_note` is what the founder reads. |
| `code`, `code_expires_at` | Set on approval only. Unique. |
| `redeemed_at`, `redeemed_by` | Set when the team honours it. This is the whole reason the code is worth storing. |
| `decision_email_sent_at`, `decision_email_error` | 🔴 A decision and its delivery are separate facts. See §7. |
| `ip_hash`, `consent_at` | PDPL. Never the address itself; the salted-hash rule is unchanged. |

Two indexes: `created_at desc`, and a partial one on `status = 'pending'`,
because the working queue is always "what has nobody answered yet".

One partial unique index on `lower(email) where status = 'pending'`: a second
application from the same address while the first is unanswered is a duplicate,
not a new lead, and the service maps the conflict to "we already have yours".

## 6. The code

Generated in `server/domain/startup-offer.ts`, pure and unit-tested.

- Shape `MAZJ-XXXX-XXXX`, alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`
  (Crockford-style: no `0/O`, no `1/I/L`, and no vowels, so it cannot spell
  anything and cannot be misheard over a phone).
- 8 random characters from a 32-symbol alphabet is 40 bits. Guessing is not the
  threat here (a guessed code buys a conversation, not a discount), but a
  collision would overwrite somebody's entitlement, so the column is unique and
  the insert retries on conflict.
- Randomness from `crypto.getRandomValues` with **rejection sampling**.
  `% 32` on a 256-value byte happens to be unbiased here, but the alphabet is a
  thing people edit, and modulo bias arrives silently the moment its length
  stops dividing 256.
- Expiry is 30 days, computed once at approval and **stored**, never derived at
  read time. A stored instant survives someone changing the constant later; a
  derived one silently re-dates every code ever issued.

## 7.🔴 A decision and its email are two separate facts

The single most important rule in this feature.

The decision is written to the database **first** and the email is sent
**after**. If Resend is down, misconfigured, or the domain is not yet verified,
the decision still stands, `decision_email_error` records what happened, and the
admin row shows a red "email not sent" state with a Resend button.

The alternative (send first, or roll the decision back on a mail failure) fails
in the worst possible way: the owner clicks Approve, sees an error, clicks again,
and either issues two codes or concludes the tool is broken. Meanwhile the
founder waits.

**Emails are never a fallback for a missing configuration.** With no
`RESEND_API_KEY`, `sendEmail` returns a typed error naming the missing variable;
it does not silently no-op, and it does not queue. The admin sees the failure in
the row.

## 8. Where the copy lives, and the one deliberate duplication

Site copy lives in `messages/{en,ar}.json` and is read through next-intl. 🔴
`server/` may not import `next-intl` (ESLint enforces it, and that rule is what
keeps the backend liftable). Email copy therefore lives in
`server/email/copy.ts` as a typed bilingual record, with a test asserting the two
locales carry identical keys.

This is a deliberate, documented duplication of a *mechanism*, not of *content*:
no string is repeated between the site and the emails. Email copy is a different
register with a different job (it is read cold, in an inbox, days later).

Everything the visitor sees on `/startups` itself is a new `Startups` namespace
in both message files, mirrored key-for-key, Arabic authored first, per the
standing rule.

## 9. What the emails say

Four templates, each bilingual, each rendered as HTML **and** plain text
(a text part is what keeps a branded email out of the spam folder and readable in
a watch notification).

| Template | To | Carries |
|---|---|---|
| `received` | applicant | We have it, your reference, when to expect an answer |
| `approved` | applicant | The code, the expiry date, **how to use it** (a person, not a checkout), what to do next |
| `rejected` | applicant | The reason, written by the owner, and an open door (the spaces are still there) |
| `alert` | `info@mazj.org` | Who applied, one-line summary, a direct link into `/admin/startups/<id>` |

Branding: cream ground `#F7F3EC`, coral `#FF5A48` rule, black ink, the MAZJ
wordmark as a hosted PNG with a text fallback. Table layout and fully inline
styles, because email clients are 2003. Arabic mails set `dir="rtl"` on the
body and mirror alignment. No webfont: Thmanyah cannot be relied on in an inbox,
so the stack degrades to the system serif-free default rather than shipping a
broken face.

🔴 The approval email must never state the offer's terms. It says a code exists
and that MAZJ will apply it; the terms are still told in person. That is the
closed envelope, unchanged.

## 10. Abuse and privacy

The form is public, unauthenticated, and sends email to an address the submitter
types. That is the exact shape of an open mail relay if it is built carelessly.

- **Two rate-limit dimensions**, per the standing doctrine: per hashed IP
  (5/hour) and per submitted email address (3/day). One dimension is never
  enough; the email dimension is the one that bounds how many messages a single
  target can be made to receive.
- **Idempotency** on submit, keyed by a client-generated key, so a double-tap
  files one application rather than two.
- The applicant's confirmation email goes only to the address on the
  application, once, and contains nothing about anyone else.
- `ip_hash` only, never an address. Existing `IP_HASH_SALT` and
  `core/hash.ts`.
- `consent_at` stamped on submit, with a line under the button linking
  `/privacy`. Applying is the consent; the disclosure is the honesty.
- Free text passes `cleanFreeText` before it reaches Postgres (control
  characters, whitespace, bounds) and is escaped by React on the way out.

## 11. Configuration the owner must do

Not code, and the feature is inert without it:

1. Verify **mazj.sa** as a sending domain in Resend and add the DNS records it
   prints (SPF, DKIM, and a return-path CNAME).
2. Set `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_ALERT_TO` on
   Vercel (Production and Preview) and in `.env.local`.
3. `npm run db:push` to apply the migration.

`npm run check:env` warns when the email variables are unset, so a deploy cannot
quietly ship a feature that cannot answer anybody.

## 12. Testing

| Test | Pins |
|---|---|
| `server/domain/startup-offer.test.ts` | Code alphabet, length, no ambiguous glyphs, expiry arithmetic, no modulo bias |
| `server/services/startup-application.test.ts` | Validation, normalisation, the duplicate-pending conflict, that a mail failure does not undo a decision |
| `server/email/copy.test.ts` | en/ar key parity |
| `test/startup-offer-sync.test.ts` | The `space` enum still mirrors `lib/links.ts` `BOOKING` |
| `test/rls.integration.test.ts` | The new table refuses the publishable key |
| `test/admin-page-guards.test.ts` | Already scans every page under `(protected)/`; the new ones inherit it |
| `test/startups-i18n.test.ts` | The `Startups` namespace has identical key paths in both locales |

## 13. As built: what was actually proven, 2026-07-28

Recorded because "it should work" and "it worked" are different claims, and this
feature's worst failure mode (a decision nobody was told about) is silent.

**Against the live database**, via the real form in a real browser:

- A submission through the rendered page wrote one row. Phone `0534600488`
  normalised to `+966534600488` (13 characters, the correct Saudi shape).
  `ip_hash` stored 32 hex characters and not an address. `consent_at` stamped.
- **The same form submitted a second time produced NO second row** and rendered
  "You already have an application with us that we have not answered yet",
  proving the partial unique index and its error mapping.
- A rejection with the note `no` was refused `validation_failed` before it ever
  reached Postgres, and the CHECK constraint stands behind it.
- An approval minted `MAZJ-XXXX-XXXX` matching the constraint, stored an expiry
  exactly 30 days out, and **reported `delivered: false` naming
  `RESEND_API_KEY`** while leaving `status = 'approved'` and the code in the
  row. That is the §7 rule, demonstrated rather than asserted.
- A second decision on the same application was refused `conflict`, proving the
  conditional `UPDATE ... WHERE status = 'pending'`.
- `markCodeRedeemed` succeeded once and refused the second time.
- The test rows were deleted; the table holds 0.

**Against the publishable key** (`test/rls.integration.test.ts`, 15 tests): the
table refuses read, insert, delete, and specifically refuses an
`UPDATE ... SET status='approved', code=...`, which is the write that would
mint an offer MAZJ never agreed to.

**Anonymous `GET /admin/startups`** answered 307 to `/admin/login` with a body
carrying none of `Waiting on you`, `MZ-`, `MAZJ-`, `founder` or the table name.

**Metadata**: both locales render a single-brand `<title>` at 59/60 characters,
per-locale canonical and a three-way hreflang cluster; both URLs are in the
sitemap; `/admin` is not.

⚠️ **Not verified, and it cannot be from here:** that a real email arrives.
That needs the Resend domain verification in §11, which is DNS. Everything up to
the moment of sending is proven, including the failure path.

## 14. Out of scope, deliberately

- Applying the discount automatically anywhere. Rekaz cannot (§2).
- A founder-facing account or a page to check application status. The email
  carries the reference; a login for one message is not worth a session store.
- File or deck uploads. That needs private storage and a retention rule, which
  is its own piece of work, exactly as it was for the events hall's commercial
  registration field.
- Editing a decision after it is sent. A rejection can be superseded by a new
  application; an approval can be marked redeemed or left to expire.
