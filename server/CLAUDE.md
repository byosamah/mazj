# `server/`: backend mechanics and gotchas

Scope: the Supabase-backed backend added 2026-07-27. Before this the repo was
100% frontend: no API routes, no data layer, no database.

- **The layer contract, for humans** → [`./README.md`](./README.md). Read that
  first if you are adding anything here; it explains what each layer may import
  and how to add a table. This file is the mechanics, the traps and the
  verification recipes.
- Design record and the reasoning behind every decision →
  [`../docs/superpowers/specs/2026-07-27-backend-foundation-design.md`](../docs/superpowers/specs/2026-07-27-backend-foundation-design.md)
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

The two sanctioned crossings are **`app/api/**`** (route handlers, kept to about
five lines each) and **`instrumentation.ts`**.

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

A third client (request-scoped, carrying a signed-in user's session via
`@supabase/ssr`) belongs here the day authentication ships. Not before.

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
`rate_limit_hit` and `idempotency_begin` both explicitly revoke and re-grant to
`service_role` only.

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
2. `npm run test`: 123 tests, 10 of them RLS integration tests that attack every
   table with the publishable key and must all be refused. They **skip** rather
   than fail without credentials, so a fresh clone stays green.
3. `npm run db:types:check`: generated types match the live schema.
4. `curl https://api.supabase.com/v1/projects/<ref>/advisors/{security,performance}`
   expects only INFO `rls_enabled_no_policy` (the design) and INFO
   `unused_index` on an empty table.
5. `npm run check:env` and `npm run verify`.

**End-to-end proof already recorded:** Arabic-Indic phone `٠٥٣٤٦٠٠٤٨٨` stored as
`+966534600488`; `Idem@Example.COM` stored lowercased; a replayed idempotency key
returned the identical id with 200 instead of 201; a 30-request flood produced
exactly 13 rows with `Retry-After: 28`; `ip_hash` stored a 128-bit HMAC rather
than an address; and error responses leaked none of `SUPABASE`, `supabase.co`,
`/Users/` or key material while the server log carried the full diagnostic.

## Out of scope, deliberately

Auth, Rekaz API calls, payments, webhook receivers, email, storage, realtime.
Each gets its own spec when the owner's ideas are on the table. **Do not build
them speculatively.**
