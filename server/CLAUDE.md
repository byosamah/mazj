# `server/`: backend mechanics and gotchas

Scope: the Supabase-backed backend added 2026-07-27. Before this the repo was
100% frontend: no API routes, no data layer, no database.

- **The layer contract, for humans** → [`./README.md`](./README.md). Read that
  first if you are adding anything here; it explains what each layer may import
  and how to add a table. This file is the mechanics, the traps and the
  verification recipes.
- Design records →
  [`../docs/superpowers/specs/2026-07-27-backend-foundation-design.md`](../docs/superpowers/specs/2026-07-27-backend-foundation-design.md)
  (the foundation) and
  [`../docs/superpowers/specs/2026-07-27-admin-dashboard-design.md`](../docs/superpowers/specs/2026-07-27-admin-dashboard-design.md)
  (the admin, and Phase 2's boundary)
- 🔴 **What the Rekaz API actually DOES**, probed live →
  [`../docs/rekaz-api-findings.md`](../docs/rekaz-api-findings.md). Read this
  before the review letter below; where they disagree, this one was measured.
- 🔴 **Strategic context** → [`../docs/rekaz-api-review-ar.md`](../docs/rekaz-api-review-ar.md).
  This backend exists to fill the gaps that document identifies. Read it before
  designing anything that touches bookings.
- Routes, layout, metadata → [`../app/CLAUDE.md`](../app/CLAUDE.md) · UI →
  [`../components/CLAUDE.md`](../components/CLAUDE.md) · project-wide →
  [`../CLAUDE.md`](../CLAUDE.md)

## What exists

**Two tables**, both in `public`, both RLS-enabled with zero policies and grants
revoked, i.e. reachable only by the secret key:

| Table | Purpose |
|---|---|
| `rate_limit_counters` | Fixed-window counters, one row per bucket, driven by `rate_limit_hit()`. |
| `idempotency_keys` | Stored responses keyed by `(scope, idempotency_key)`, driven by `idempotency_begin()`. |

⚠️ **`rate_limit_counters` gained its first real caller on 2026-07-27**: the
admin magic-link request in `services/admin-auth.ts`. That endpoint is public
and sends email, which is exactly the test this section set. The paragraph below
still applies to `idempotency_keys`, which remains uncalled until something
POSTs a booking.

🔴 **`idempotency_keys` still has ZERO callers, and that is a known open
question, not an oversight.** They were built as part of the foundation, before the owner had
specified what the product needs. `leads`, the only thing that ever used them,
was dropped on 2026-07-27 for exactly that reason. They survive it because,
unlike `leads`, they encode no assumption about the product: a rate limiter does
not care what it limits, and idempotency does not care what it protects.

The decision is deferred until the owner describes the features, and the test is
simple: **any public write endpoint** (a form, a signup, an RSVP, a booking)
needs both. A read-only feature, or one that stays entirely on Rekaz, needs
neither. If the features turn out not to need them, drop them; it is one
migration and the code is small.

One argument is not speculative. `docs/rekaz-api-review-ar.md` §4.4 records that
**Rekaz has no idempotency keys**, and that a double-tapped booking button can
create two bookings. If any feature books through this site, `idempotency_keys`
is required rather than optional.

⚠️ Do not quietly delete either one to "clean up", and do not build features on
them without checking this section first. Ask the owner.

**Two feature areas**, added 2026-07-27 with the admin dashboard:

| Module | Purpose |
|---|---|
| `rekaz/` | Typed, server-only client for the Rekaz Merchant Public API. See below. |
| `services/admin-auth.ts` | Gate 1 of the admin's three access gates, plus the magic-link verification. |
| `services/booking.ts` | 🔴 The booking write path. Rate limit, idempotency, server-side price resolution, slot re-check. Everything the browser sends is a suggestion. |
| `rekaz/booking.ts` | The two Rekaz writes, plus `absolutePaymentLink`. |
| `domain/spaces.ts` | Our `/spaces/<slug>` URLs to Rekaz product slugs. |
| `domain/admin-access.ts` | The `@mazj.org` rule itself. Shared by all three gates. |
| `domain/riyadh-time.ts` | UTC to `Asia/Riyadh`. Pure. |
| `supabase/session.ts` | The request-scoped client, carrying a signed-in user. |

**One endpoint**, `runtime = "nodejs"`, `dynamic = "force-dynamic"`:

| Route | Purpose |
|---|---|
| `GET /api/health` | Calls `health_ping()` and reports latency. A health check that cannot fail tells you nothing. |

🔴 **`health_ping()` must never gain a dependency on an application table.** The
probe originally queried `leads`, so dropping that table took the health endpoint
down with it. A liveness check should depend on nothing but the database being
reachable.

Enumerated columns use `text` + `check` rather than Postgres enums, because
adding a value to an enum inside a transaction is restricted and dropping one is
impossible, whereas a check constraint is a single `ALTER`.

### `leads` was dropped on 2026-07-27

It was the foundation's proving slice: it demonstrated the whole path end to end
(validation, rate limiting, idempotency, Arabic-Indic phone normalisation, RLS,
error mapping) and nothing on the site ever called it. The owner had not yet
specified what the product needs, and a speculative table does not belong in
production.

**It is recoverable from git** (commit `64abee4`): the table, the domain rules,
the zod schema, the service, the route and the tests. It held 0 rows when
dropped, so no data was lost. `test/rls.integration.test.ts` asserts it stays
gone, so a stale migration cannot quietly resurrect it.

`server/domain/phone.ts` was **kept** despite being its only consumer. It is
pure, tested, has no database or runtime footprint, and encodes knowledge that is
expensive to rediscover (Arabic-Indic and Persian digits, and the `+966 (0)5…`
trunk-prefix trap). It currently has no caller.

`set_updated_at()` was also kept: it is generic infrastructure any future table
with an `updated_at` column will use.

## 🔴 The boundary

**`server/` may not import React, `next/*`, `next-intl`, or `@/components`,
`@/app`, `@/lib`, `@/i18n`. Frontend code may not import `@/server/*`.**

Both directions are enforced by `no-restricted-imports` blocks in
`eslint.config.mjs`, so a violation is a lint error rather than a code-review
miss. Verified by writing three deliberate violations and confirming all three
fire.

The second direction is the load-bearing one: it is precisely what makes this
folder liftable into its own package or its own deployed service later without a
rewrite. Every framework import added here is a nail in that door.

The sanctioned crossings are **`app/api/**`** (route handlers, kept to about
five lines each), **`instrumentation.ts`**, and, since 2026-07-27,
**`app/admin/_lib/**`**.

The third was added with the admin dashboard. Admin pages are Server Components
that genuinely need the backend, and making them fetch their own HTTP API would
mean a server calling itself over the network with an absolute URL to build and
a cookie jar to forward by hand. So the crossing is a folder, not a rule-wide
exemption: only `_lib` may import `@/server/**`, and it exports plain view models
that the pages render. The underscore keeps Next from ever routing it and makes
the crossing obvious in a diff. **Do not import `@/server/*` from an admin page
directly, and do not re-export a backend module from `_lib`**: export data.

- **It is `server/core/`, NOT `server/lib/`.** It was named `lib` originally and
  had to be renamed: from `server/x.ts` the pattern `../lib/**` means the
  FRONTEND `lib/`, but from `server/db/x.ts` the same string means the backend's
  own. Same name, two meanings, so the boundary rule false-positived on 11
  legitimate internal imports. **Don't reintroduce a `server/lib/`.**
- When a module here needs a constant that also exists in `lib/`, **duplicate it
  rather than importing across the boundary**, and add a test that asserts the two
  stay in sync. That pattern lived in `leads.sync.test.ts` before `leads` was
  dropped; reuse the shape, not the file.

## The two Supabase clients

Confusing them is the most expensive mistake available in this codebase.

- **`supabase/admin.ts`** uses the secret key and **bypasses Row Level Security
  entirely.** It imports `server-only` so it can never reach a browser bundle. On
  a privileged client a `.eq()` filter **IS the access control**, not a
  convenience: forget it and you return every row to whoever asked. This is
  exactly the risk the Rekaz review §4.3 raises about their admin-only key.
- **`supabase/public.ts`** uses the publishable key, so RLS applies. Today its
  only job is letting `test/rls.integration.test.ts` attack the tables the way a
  browser could, and assert it is refused.

- **`supabase/session.ts`** is the third client, added 2026-07-27 when
  authentication shipped. It uses the PUBLISHABLE key and carries one visitor's
  session, so RLS applies to everything it does. Reaching for `supabaseAdmin()`
  to answer a question about the current user throws away the only mechanism
  that keeps one user out of another's rows.

  🔴 **Never cache a session client across requests.** It closes over one
  visitor's cookie jar, so a module-level singleton serves the first visitor's
  session to everyone landing on the same warm serverless instance. That is why
  `admin.ts` and `public.ts` may be singletons and this one may not.

  🔴 **It takes a cookie adapter rather than calling `cookies()` itself.**
  `@supabase/ssr` needs `next/headers`, which `server/` may not import, so the
  dependency is inverted: this module declares the cookie access it needs and
  `app/admin/_lib/supabase.ts` supplies the Next implementation. That is also
  why `app/admin/_lib/**` is now a sanctioned boundary crossing (see below).

**`import "server-only"` guards every secret-bearing module.** It throws outside a
React Server Component, which would break Vitest, so `vitest.config.ts` aliases it
to `node_modules/server-only/empty.js` (the package's own `react-server` export
condition). `scripts/check-env.mts` gets the same effect with
`node --conditions=react-server`.

## 🔴 Database security posture

**Every table gets RLS enabled AND `revoke all from anon, authenticated` in the
SAME migration that creates it.**

That is not redundant. Supabase installs DEFAULT PRIVILEGES granting those roles
table access, so RLS alone leaves exactly one careless policy between you and
exposure. Revoking means two separate mistakes are required to expose anything.

Postgres also grants `EXECUTE` on functions to `PUBLIC` by default, which would
expose them over PostgREST's `/rpc/` endpoint to anonymous callers.
All three functions (`rate_limit_hit`, `idempotency_begin`, `health_ping`)
explicitly revoke and re-grant to `service_role` only.

`SECURITY DEFINER` functions must `set search_path = ''` and fully qualify every
name, or Supabase's advisor flags `function_search_path_mutable`, which is a real
privilege-escalation vector (a caller can point `public` at their own schema and
hijack a call).

⚠️ Supabase's security advisor reports INFO `rls_enabled_no_policy` on all three
tables. **That IS the design** (deny-by-default, server-only tables), not a
finding to fix.

## Concurrency primitives

Both live in the database rather than in process memory, because this runs on
serverless: each concurrent instance has its own heap, so an in-memory counter
limits each instance separately and the real ceiling becomes limit × instance
count, which is no ceiling at all.

**`rate_limit_hit`** is one `INSERT ... ON CONFLICT DO UPDATE`. A
read-then-write limiter loses races under exactly the concurrent load it is
supposed to defend against. It fails **closed**: if the database is unreachable
the request is refused, because the moment the database struggles is the moment an
abusive client is most able to hurt you.

🔴 **`idempotency_begin` is a SQL function, not client-side
insert-then-read.** Two reasons, both found by adversarial review. The
two-statement version could interleave between the conflicting insert and the
follow-up read. Worse, an `in_progress` row was **never reclaimable**: a request
that died after claiming a key (serverless timeout, OOM, redeploy mid-flight, or a
transient fault that defeats both the insert and the best-effort cleanup delete
milliseconds later) wedged that key at 409 **forever**, and the client behaviour
that triggers it is the correct one, retrying with the same key. The function now
reclaims rows older than `STALE_AFTER_SECONDS` (90) via a predicate inside the
UPDATE, so exactly one caller can win, and GCs completed rows after 24h the same
opportunistic way `rate_limit_hit` does. Outcomes:
`proceed | replay | in_flight | fingerprint_mismatch | retry`.

## Data handling

🔴 **Phone normalisation (`domain/phone.ts`) handles Arabic-Indic digits**
(U+0660-0669) and Persian (U+06F0-06F9). An Arabic keyboard emits `٠٥٣٤٦٠٠٤٨٨`,
which every ASCII-digit validator rejects. This is whether the Arabic half of the
site works, not a nicety. Stored as E.164, enforced by a check constraint.

- 🔴 **Decide "is this international?" AFTER stripping punctuation, never
  before.** Reading `hadPlus` off the raw string means a leading bracket hides the
  plus, so `(+971) 50 123 4567` (an extremely common way to write a number) fell
  through to the Saudi-only branches and a real UAE mobile was rejected as
  unreachable.
- 🔴 **A generic E.164 shape check is NOT validation.** The `+` branch used to
  concatenate digits without consulting the Saudi plan, so `+966 (0)53 460 0488`
  (the standard both-domestic-and-international print form) became the 13-digit
  `+9660534600488`. That satisfied `^\+[1-9][0-9]{7,14}$` in code AND the SQL
  check, so an undialable number was stored as canonical, often as a lead's only
  contact channel. Any `+966` number now has its national significant number
  validated against `[15]\d{8}` and the redundant trunk `0` removed. **A correct
  Saudi value is always exactly 13 characters.**

🔴 **Strip C0/C1 control characters from any free text before it reaches
Postgres.** A NUL passes `JSON.parse`, passes `z.string()`, and survives
whitespace collapsing, then the driver rejects it with `unsupported Unicode
escape sequence`, which the db layer maps to `upstream_unavailable`: a 503 blaming
our database for the caller's input. The `collapse()` helper (removed with `leads`, see git `64abee4`) stripped the C0/C1 ranges `U+0000`-`U+0008`, `U+000E`-`U+001F` and `U+007F`-`U+009F`, deliberately skipping `U+0009`-`U+000D` (tab, newline, CR and friends) because the whitespace pass has already turned those into spaces.

⚠️ **Write those ranges as escape sequences, never as literal bytes.** A literal
control byte in a `.ts` file is a hard ESLint parse error (`Unexpected keyword or
identifier`), and the Bash tool refuses a command containing one, so build such
test inputs with `chr(0)` in Python.

**Never store a raw IP.** It is personal data under PDPL. `core/hash.ts` HMACs it
with `IP_HASH_SALT` (HMAC, not a plain hash: the IPv4 space is small enough to
brute-force an unsalted SHA-256 in minutes). Rotating the salt deliberately severs
the link to every previously stored hash.

## The Rekaz client (`rekaz/`)

🔴 **Read [`../docs/rekaz-api-findings.md`](../docs/rekaz-api-findings.md)
before touching anything here.** It records what the live API actually does,
probed with real credentials, and it contradicts Rekaz's own documentation in
several places that will otherwise cost you an afternoon. The short version:

- 🔴 **Always send an explicit `User-Agent`.** The API returns **403** to
  clients it does not recognise (`Python-urllib` is refused, `curl` is not).
  Node's `fetch` default passes today; a runtime upgrade changing it would read
  exactly like an expired credential.
- 🔴 **The credential is ADMIN-SCOPE.** `GET /customers` returns MAZJ's entire
  customer list. Same blast radius as `SUPABASE_SECRET_KEY`, same handling.
- `__tenant` has **two** underscores. The Quick Start page says one; it is wrong.
- `MinQuantity` is **required** on `/reservations/slots` despite being
  documented as optional. `getSlotsRaw` defaults it to 1.
- **Slot date ranges are padded, not honoured.** Always re-filter to the day you
  asked for, and always drop `isOutDated`. `filterSlotsToRange` does both.
- **`nameEn` is byte-identical to `nameAr`.** Rekaz holds no English content, so
  `messages/en.json` remains the only source of English product names. An
  integration test fails the day that stops being true.
- **Price ids rotate when a price is edited in the Rekaz dashboard.** Never
  hardcode one; resolve from `GET /products` at request time.
- Three different collection shapes: `/branches` returns a bare array,
  `/providers` returns `{items}` with no `totalCount`, everything else returns
  the full envelope. Assuming the envelope yields `undefined`, not an error.
- Errors arrive as RFC 9110 ProblemDetails **in Arabic** regardless of
  `Accept-Language`. Never surface one to a user; map to an `AppError` code. The
  `traceId` is logged because it is what Rekaz support asks for.

⚠️ **There is no sandbox.** `test/rekaz.integration.test.ts` hits the production
tenant. It is read-only for that reason, and skips without credentials. Never
add a write to it.

⚠️ **Those tests FLAKE, and it is upstream, not us.** Rekaz answers between 1.2s
and 10.8s for the same endpoint and degrades sharply under concurrent load, so a
full `npm run verify` occasionally trips the client's 10s timeout and reports one
or two `upstream_unavailable` failures. **Re-run before investigating**; a clean
second run is the expected outcome, not a fluke. If it fails twice in a row,
that is a real signal. The one live booking test that exists was run by hand and
then deleted, precisely so nothing that writes can flake.

## The admin's three access gates

`/admin` is `@mazj.org` only. The rule lives in **one** place,
`domain/admin-access.ts`, because three gates that each ask the question
differently would eventually disagree and the gap would be invisible in all
three files.

| Gate | Where | Stops |
|---|---|---|
| 1 | `services/admin-auth.ts` | An outsider ever RECEIVING a magic link |
| 2 | Supabase `before user created` hook | The account EXISTING at all |
| 3 | `app/admin/(protected)/layout.tsx` | A session reaching a page |

🔴 **Gate 2 is the load-bearing one, and it is SQL, not TypeScript.** A request
straight to Supabase's own `/auth/v1/otp` with the publishable key, which is
public by design, bypasses gates 1 and 3 completely. Without the hook that
request creates a real `auth.users` row for any address on earth and mails them
a working link. The function is
`public.enforce_admin_email_domain`, registered as
`pg-functions://postgres/public/enforce_admin_email_domain`. **A migration alone
does not activate it**; the project's auth config must point at it too.

🔴 **The SQL and the TypeScript must stay behaviourally identical.** Both were
run against the same 19 adversarial cases and agree. If you change one, change
the other and re-run both.

🔴 **The rule is NOT `endsWith("@mazj.org")`.** RFC 5321 puts the domain after
the LAST `@` and allows a quoted local part containing one, so
`"anything@mazj.org"@evil.com` is delivered to `evil.com` and passes a suffix
test. Split on the last `@`, require exactly one, compare the domain to an ASCII
literal (which also rejects Cyrillic homographs).

🔴 **Gate 3 uses `getUser()`, never `getSession()`.** `getSession()` decodes the
cookie and believes it. On a page whose entire job is deciding who gets in, that
is not authorisation.

🔴 **The login endpoint must not become an enumeration oracle.** An allowed and a
refused address get the identical response. That is deliberate and it has a real
cost, named in the code: a genuine mail failure is also invisible to whoever is
waiting. The outcome is always in the log.

⚠️ **Supabase email is the built-in sender, capped at a few per hour and not
production-grade.** Custom email TEMPLATES are refused on the free tier with the
default provider (`400: Email template modification is not available for free
tier projects`), so the magic link uses Supabase's default template and the PKCE
`?code=` path. `completeAdminSignIn` also handles `token_hash`, so switching to
real SMTP and a custom template later needs no code change.

## Errors and HTTP

No exceptions cross a layer boundary: services return `Result<T, AppError>`, and
`AppError.code` is the stable contract. One table in `core/errors.ts` maps a code
to an HTTP status, so a status can never drift between two endpoints reporting the
same failure.

🔴 **Every route handler is wrapped in `route()` from `core/http.ts`.** Without
it, one `throw` below the route escapes the `Result` discipline and Next answers a
JSON request with an HTML error page, plus a stack trace in dev.

🔴 **`toPublicError` deliberately discards the message for `internal`.**
Unexpected failure text routinely carries connection strings, SQL fragments, table
names and occasionally row data, and an error response is the single easiest place
in a web application to leak all of it. The detail goes to the log; the client
gets a code.

**`instrumentation.ts` throws in production but only WARNS in development**,
deliberately: most work in this repo is frontend, and refusing to start
`npm run dev` because nobody has pasted a Supabase key yet would block all of it.
Same asymmetry as `lib/site.ts`, keyed on `NODE_ENV` so it holds on any host.

## Tooling

- 🔴 **The command sandbox breaks Node's outbound TLS, but not curl's.** Any
  test or script that `fetch`es an external host fails under the sandbox with a
  bare `TypeError`, which `client.ts` correctly maps to `upstream_unavailable`,
  so it reads as "Rekaz is down" rather than "your shell is wrong". Meanwhile
  `curl` to the same URL returns 200, because curl trusts the system keychain
  and Node ships its own CA store. **Run `npm run test`, `npm run verify` and
  anything else that talks to Rekaz or Supabase with the sandbox OFF.** Cost a
  full debugging detour on 2026-07-27: 10 of 12 integration tests "failed", and
  the 2 that "passed" were the ones asserting failure.
- ⚠️ **`Python-urllib` gets 403 from BOTH `platform.rekaz.io` and
  `api.supabase.com`.** Not a sandbox issue, an origin filter. Pass
  `User-Agent: curl/8.7.1` on any `urllib` probe.
- **`npm install` needs the sandbox off**: the npm cache under `~/.npm` is
  root-owned and outside the writable allowlist.
- **`npm run db:*` goes through `scripts/db.mjs`, not the CLI directly**, because
  npm scripts run in a shell that never read `.env.local`, so
  `--db-url "$SUPABASE_DB_URL"` would silently pass an empty string.
  `db:types:check` is the CI guard against generated types drifting from the
  schema.
- 🔴 **`supabase gen types` requires Docker running** (it runs `postgres-meta` in
  a container) **even against a REMOTE database**. `db push` does not.
- The brew-installed `supabase` binary is broken on this machine (SIGKILL under
  Node 26); `npx --yes supabase` works, which is what the scripts use.
- ⚠️ `supabase db push` can print a certificate error from its diff engine and
  then report "Finished" **without that being a failure**. Do not trust either
  the error or the success message: verify against
  `supabase_migrations.schema_migrations`.
- **`server/supabase/types.gen.ts` is generated. Never hand-edit it.** It is
  excluded from ESLint for that reason.

## Configuration

Credentials live **only** in `.env.local` (git-ignored). `.env.example` is the
committed template and needed a `!.env.example` negation to survive `.gitignore`'s
`.env.*` rule.

⚠️ Verify env-file ignore changes with `git add -n`, **not** `git check-ignore -v`,
which prints the matching rule for negations too and reads like a failure.

`.env.local` holds the project URL, the modern `sb_publishable_` / `sb_secret_`
keys (preferred over the legacy `anon` / `service_role` JWTs: independently
rotatable, no expiry semantics), `IP_HASH_SALT`, `SUPABASE_DB_URL`, and
`SUPABASE_ACCESS_TOKEN` (the owner's PAT, read by name by both the CLI and the
Management API, so `npm run db:*` and
`curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" https://api.supabase.com/v1/...`
both work without asking the owner again).

**The live project is `sxksrvqehiqnonsirwtb` ("mazj-production"), `eu-central-1`
/ Frankfurt**, org "MAZJ website", free plan. It replaced `bosbgpketmosatwbxpbf`
("MAZJ Website") in `ap-northeast-1` / Tokyo on 2026-07-27; that project was
deleted after confirming it held zero rows, zero `auth.users` and zero
`storage.objects`. 🔴 If you ever see `bosbgpketmosatwbxpbf` in a config, it is
stale: that project no longer exists. Tokyo measured **250ms per
query from Dammam versus Frankfurt's 96ms** (2.6x; cold connect 1898ms → 715ms).
Supabase binds region at the infrastructure level, so there is no in-place move:
it is a new project, new keys, replayed migrations. 🔴 **Never create a project
for this business in an APAC or US region.** Measured from Dammam: Paris 100,
Frankfurt 110, Mumbai 120, Singapore 140, Virginia 190, Tokyo 200. (Method: TCP
connect to each `aws-0-<region>.pooler.supabase.com:5432` via `nc` timed with
`time`, so each figure carries ~10ms of shell overhead; the ordering is solid and
the Tokyo-versus-Europe gap was confirmed by real query round-trips.)

⚠️ The direct `db.<ref>.supabase.co` host is **IPv6-only** (AAAA record, no A). It
works from the owner's machine because STC provides IPv6 egress. On an IPv4-only
network use the Supavisor pooler host instead.

## Verification recipe

Run all of this after any schema or security change. All passing as of
2026-07-27.

1. Connect with `pg` over IPv6 and assert `relrowsecurity` is true, `pg_policies`
   is empty, and `role_table_grants` has zero rows for `anon` / `authenticated`.
2. `npm run test`: 187 tests. 11 RLS integration tests attack every table with
   the publishable key and must all be refused; 12 Rekaz integration tests read
   the live production tenant and pin its response shapes. Both suites **skip**
   rather than fail without credentials, so a fresh clone stays green. 🔴 Run
   with the sandbox OFF or every network test fails misleadingly (see Tooling).
3. `npm run db:types:check`: generated types match the live schema.
4. `curl https://api.supabase.com/v1/projects/<ref>/advisors/{security,performance}`
   expects only INFO `rls_enabled_no_policy` (the design) and INFO
   `unused_index` on an empty table.
5. `npm run check:env` and `npm run verify`.

**End-to-end proof, recorded 2026-07-27 against the now-removed `leads`
endpoint.** Kept because it is evidence about the *mechanisms*, which survive,
not about the endpoint, which does not: the Arabic-Indic phone `٠٥٣٤٦٠٠٤٨٨`
normalised to `+966534600488`; `Idem@Example.COM` stored lowercased; a replayed
idempotency key returned the identical id with 200 instead of 201; a 30-request
flood produced exactly 13 rows with `Retry-After: 28`, i.e. the limiter cut in at
precisely the 20th request of the window and rejected requests wrote nothing;
`ip_hash` stored a 128-bit HMAC rather than an address; and error responses
leaked none of `SUPABASE`, `supabase.co`, `/Users/` or key material while the
server log carried the full diagnostic.

⚠️ **That path cannot be re-run today**: there is no write endpoint. The next
feature that adds one should reproduce these checks rather than trusting this
paragraph.

## Out of scope, deliberately

Payments (Rekaz exposes no API), webhook receivers, customer-facing accounts,
storage, realtime, refunds and coupon validation. Each gets its own spec. **Do
not build them speculatively.**

Auth, Rekaz reads and Rekaz WRITES all left this list on 2026-07-27, as the admin
dashboard and then on-site booking shipped. `idempotency_keys` finally has its
caller: `services/booking.ts`, verified on a real booking to return the original
payment link rather than creating a twin.
