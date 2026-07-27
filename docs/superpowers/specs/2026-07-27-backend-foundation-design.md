# Backend foundation, wired to Supabase

**Date:** 2026-07-27
**Status:** BUILT and verified. Owner picked all four recommended options.
**Scope:** the foundation only. Product features arrive in later specs.

**Update 2026-07-27 (later the same day):** the `leads` proving slice was
**dropped** at the owner's instruction. It had done its job, nothing on the site
called it, and the owner's product requirements are still unstated, so keeping a
speculative table in production was the wrong default. Everything about it is
recoverable from commit `64abee4`. `/api/health` was decoupled from it via a new
`health_ping()` function, which fixed a latent flaw: a liveness probe should
never depend on a business table. `rate_limit_counters` and `idempotency_keys`
remain, pending that same conversation.

**Outcome:** live on Supabase project `sxksrvqehiqnonsirwtb` ("mazj-production",
`eu-central-1`). 103 tests passing, lint and typecheck clean, production build
passing, security advisors clean. Query latency from Dammam fell from 250ms
(Tokyo) to **96ms**. The old Tokyo project `bosbgpketmosatwbxpbf` is empty and
awaiting deletion by the owner.

---

## 1. Why this exists

`mazj` is a bilingual marketing site with no server side at all: no API routes, no
data layer, no auth, no database. Every action ends in an outbound link to
`mazj.sa` (Rekaz) or a WhatsApp deep link.

`docs/rekaz-api-review-ar.md` sets the direction: MAZJ wants one domain and one
identity, with **Rekaz remaining the system of record** for reservations,
subscriptions, invoices, ZATCA compliance and attendance, while the **customer
experience moves onto this site**. That review also names the gaps Rekaz leaves,
and those gaps define what a MAZJ backend is actually for:

| Rekaz gap (review §) | What our backend must own |
|---|---|
| No payments API (§4.1) | Payment orchestration, whenever that is unblocked |
| Webhooks are unsigned (§4.2) | Verify-by-refetch before trusting any payload |
| No end-customer auth (§4.3) | Our own identity layer |
| No idempotency keys (§4.4) | Server-side idempotency |
| Admin-only API key (§4.3) | Custody of a full-privilege secret, server side only |

This spec builds the floor those things will stand on. It does not build them.

## 2. Decisions taken

| Decision | Choice | Why |
|---|---|---|
| Database region | **eu-central-1 (Frankfurt)** | Measured 110ms from Dammam vs 200ms for the current Tokyo project. Region is bound at Supabase's infrastructure level and cannot be changed in place. The project is empty, so the move costs minutes now and a migration window later. |
| Code location | **`server/` in this repo** | Real separation without moving a single existing file. Alternatives rejected: a workspaces monorepo invalidates hundreds of documented paths in `CLAUDE.md`/`DESIGN.md`/`TONE.md` and collides with parallel sessions; a standalone service adds a second deploy target and cross-origin auth for a single-location business. |
| First pass | **Foundation + one proving slice** | A backend that has never moved a byte is theoretical. One real table end to end proves the path before real features land on it. |
| Access | **Supabase Personal Access Token** | Gives the CLI and Management API for the life of the project: create, link, push migrations, generate types, read advisors. |

## 3. Principles

1. **Rekaz stays the system of record.** Our database holds only what we own,
   plus caches explicitly marked as derived and safe to drop. It never becomes a
   second master for bookings, invoices or tax data.
2. **The backend does not know Next.js exists.** Nothing under `server/` imports
   React, `next/*` or `next-intl`. This is the property that makes the folder
   liftable into its own package or service later with no rewrite.
3. **Deny by default.** RLS is enabled in the same migration that creates a
   table, with privileges revoked from `anon` and `authenticated`. No table is
   ever born reachable.
4. **Secrets cannot cross the boundary.** Modules holding the secret key import
   `server-only`, so leaking one into a client bundle is a build failure.
5. **Writes are idempotent.** Rekaz offers no idempotency (§4.4), so we own it.
6. **Collect little, log less.** No personal data in logs, ever. IPs are hashed
   with a server-side secret, never stored raw.

## 4. Layout

```
server/                     the backend. no React, no Next.
  env.ts                    zod-validated config, fails loudly
  supabase/
    admin.ts                secret key. bypasses RLS. server-only.
    public.ts               publishable key. RLS enforced. used to prove RLS works.
    types.gen.ts            generated from the database. never hand-edited.
  db/                       data access, one module per table
  domain/                   pure rules, no I/O
  services/                 orchestration
  integrations/rekaz/       (scaffolded, not implemented)
  core/                     result, errors, logger, rate limit, idempotency
  validation/               zod schemas

supabase/
  config.toml
  migrations/               versioned SQL, applied with the Supabase CLI

app/api/*/route.ts          thin adapters: parse, call a service, map to HTTP
```

Route handlers stay about five lines. All reasoning lives in `server/`.

## 5. Boundary enforcement

ESLint `no-restricted-imports`, scoped by path, makes violations build errors:

- `app/**` (except `app/api/**`), `components/**`, `lib/**`, `i18n/**` may not
  import `@/server/*`.
- `server/**` may not import `react`, `react-dom`, `next`, `next-intl`,
  `@/components/*`, `@/app/*`, or `@/lib/*`.

The last one is deliberate. `server/` duplicating four product identifiers is a
cheaper price than a dependency edge back into frontend code. A test asserts the
duplicate stays in sync with `lib/links.ts`.

## 6. Data model, v0

Three tables, all in `public`, all RLS-enabled with zero policies and privileges
revoked, i.e. reachable only by the secret key.

- **`leads`** — the proving slice. Someone asked about a space. Chosen because
  every plausible direction (booking, waitlist, founding members, event RSVPs,
  contact) needs lead capture underneath it, and because it requires no frontend
  change to prove.
- **`rate_limit_counters`** + `rate_limit_hit()` — atomic fixed-window limiter,
  correct across serverless instances, where in-memory limiting is not.
- **`idempotency_keys`** — Stripe-shaped: first request runs and stores its
  response; a replay returns the stored response; the same key with a different
  body is rejected.

Enumerated columns use `text` with `check` constraints rather than Postgres
enums, because altering an enum in a live migration is materially harder than
altering a check.

## 7. Endpoints, v0

| Route | Purpose |
|---|---|
| `GET /api/health` | Round-trips the database. Proves env loading, client construction, connectivity and error mapping. |
| `POST /api/leads` | Validation, rate limit, idempotency, normalization, insert. Proves the whole path. |

Neither touches an existing component. The site behaves exactly as before.

## 8. Error handling

No exceptions cross a layer boundary. Services return `Result<T, AppError>`.
`AppError` carries a stable machine-readable `code`, and one mapper turns a code
into an HTTP status. Callers never parse error strings.

## 9. Testing

Vitest. Unit tests for pure logic (phone normalization including Arabic-Indic
digits, lead normalization, error mapping, request fingerprints). One integration
test that hits a real database and asserts the publishable-key client can neither
read nor insert `leads`, which is the only way to prove RLS is actually closed
rather than merely configured.

## 10. Environments

One Frankfurt project as production; local Supabase via Docker for development.
A staging project is worth adding at launch, not before.

## 11. Out of scope

Auth, Rekaz API calls, payments, webhook receivers, email, storage, realtime.
Each gets its own spec when the owner's ideas are on the table.

## 12. Open items for the owner

- 🔴 **Delete the Tokyo project `bosbgpketmosatwbxpbf`.** It is empty and
  superseded. Two reasons to do it rather than leave it: nobody can then wire
  the stale URL by accident, and the free plan allows two active projects, so
  the slot is needed for a staging project later.
- **Rotate the old Tokyo database password if that project is kept for any
  reason.** It was pasted into a chat transcript in plaintext and must be
  considered burned. The Frankfurt project uses a freshly generated 40-character
  password that has never left `.env.local`.
- PDPL: where customer personal data physically rests is a question for the
  lawyer already reviewing the privacy and terms documents. Frankfurt is a more
  defensible answer than Tokyo, but it is still a cross-border transfer.
- Set `NEXT_PUBLIC_SITE_URL` before any production build; `lib/site.ts` throws
  on the placeholder by design.

## 13. What was verified, and how

Not asserted, measured. All on 2026-07-27 against the live Frankfurt project.

| Claim | Method | Result |
|---|---|---|
| RLS on, zero policies, 3 tables | queried `pg_class` / `pg_policies` | confirmed |
| No grants to `anon` / `authenticated` | queried `role_table_grants` | zero rows |
| Functions not publicly executable | queried `routine_privileges` | `service_role` only |
| `SECURITY DEFINER` pinned | queried `pg_proc.proconfig` | `search_path=""` |
| Limiter is exact | 30-request flood | 13 accepted, 17 × 429, `Retry-After: 28` |
| Rejected requests write nothing | counted rows after the flood | exactly 13 |
| Idempotent replay | same key twice | 201 then 200, identical id, one row |
| Key reuse detected | same key, different body | 422 `idempotency_key_reused` |
| Arabic-Indic digits | posted `٠٥٣٤٦٠٠٤٨٨` | stored `+966534600488` |
| Email canonicalised | posted `Idem@Example.COM` | stored lowercased |
| IP never stored raw | inspected `ip_hash` | 128-bit HMAC |
| No secrets in responses | swept 7 patterns across error bodies | all absent |
| Boundary rules fire | 3 deliberate violations | all 3 errored, crossing passed |
| Supabase advisors | Management API, both types | no ERROR or WARN |

## 14. Adversarial review, and what it caught

A 38-agent review ran over the finished code: five independent lenses (secret
custody, concurrency, HTTP contract, data/i18n, boundary/config), with every
candidate finding handed to a separate agent whose instruction was to *refute*
it and to default to refuted when uncertain.

**38 candidates, 34 refuted, 4 confirmed.** All four were fixed, each with a
regression test, and each re-confirmed end to end against the live database.
The suite went from 103 tests to 123.

1. **`idempotency.ts` — a wedged key could never be reclaimed.** A request that
   died after claiming a key left an `in_progress` row that nothing removed, so
   every later retry with that key answered 409 forever. The reachable path
   needs no crash at all: a transient database fault fails `insertLead`, and the
   best-effort cleanup `DELETE` issued milliseconds later hits the same
   struggling dependency and is swallowed by a bare `catch {}`. Fixed by moving
   the whole begin decision into one atomic SQL function with a 90-second
   staleness reclaim and 24-hour GC.

2. **`phone.ts` — `+966 (0)53 460 0488` stored an undialable number.** The `+`
   branch skipped Saudi validation entirely, producing a 13-digit national
   number that satisfied both the code's E.164 regex and the SQL check, and was
   therefore stored as canonical, frequently as the lead's only contact channel.

3. **`phone.ts` — `(+971) 50 123 4567` was rejected outright.** `hadPlus` was
   read from the raw string before punctuation was stripped, so a leading
   bracket hid the plus and a valid UAE mobile was refused as unreachable.

4. **`leads.ts` — a NUL byte returned a 503.** It passed `JSON.parse`, passed
   zod, survived whitespace collapsing, and was rejected by the Postgres driver,
   which surfaced as `upstream_unavailable`: our database blamed for the
   caller's input.

The 34 refutations are as valuable as the confirmations. Several described real
mechanics but no reachable failure, and the verifiers rejected them with
evidence rather than opinion, which is why the four that survived were worth
acting on immediately.
