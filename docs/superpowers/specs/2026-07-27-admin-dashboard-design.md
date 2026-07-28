# Secured admin + live operations dashboard

**Date:** 2026-07-27 · **Status:** SHIPPED (commit `155ce64`)
**Phase 1 of 2.** Phase 2 (on-site booking) gets its own spec and depends on the
Rekaz client this phase builds.

## Problem

MAZJ's operations live in Rekaz, and MAZJ's website knows nothing about them.
There is no authenticated surface on this site at all: no login, no session, no
page that requires being anyone in particular. Everything is public and static.

Two things are wanted. First, a place only MAZJ staff can reach, to grow features
into over time. Second, and more immediately, on-site booking (Phase 2), which
needs a tested, typed Rekaz client that does not yet exist.

Building the admin first gets both. The dashboard is a real consumer of the Rekaz
read layer, so that layer arrives proven rather than assumed.

## Decisions taken

Recorded so they are not re-litigated. All were the owner's, on 2026-07-27.

| Decision | Choice |
|---|---|
| Sequencing | Admin first, booking second, separate specs |
| Access | `@mazj.org` only, strict domain rule. Owner's mailbox is `o.khalil@mazj.org` |
| Auth method | Supabase magic link |
| URL and language | `/admin`, English only, LTR, outside the locale system |
| Dashboard content | Live Rekaz operations view, not an empty shell |
| Email delivery | Supabase built-in sender for now, real SMTP before the team is onboarded |
| Test writes | Permitted against production, create then cancel |

## Architecture

### Placement: outside the locale system

`/admin/*` is a new top-level `app/admin/`, a sibling of `app/[locale]/`.

It is not `app/[locale]/admin/`, because that would give it `/en/admin` and
`/ar/admin`, an hreflang pair, a sitemap entry and a duplicate-content problem on
an internal tool.

Three changes make the placement real:

1. **`proxy.ts`** matcher must exclude `admin`, otherwise next-intl's middleware
   rewrites `/admin` to `/en/admin` before any admin code runs:
   `"/((?!api|admin|_next|_vercel|.*\\..*).*)"`
2. **`app/robots.ts`** disallows `/admin`.
3. **`app/admin/layout.tsx`** declares `lang="en"`, `dir="ltr"` and
   `robots: { index: false, follow: false }`.

`app/sitemap.ts` builds from the locale route table, so `/admin` cannot leak into
it. A test asserts that.

### Auth: three independent gates

Supabase magic link with cookie-backed sessions. Adds `@supabase/ssr`, which is
the only supported way to hold a Supabase session in App Router server
components.

Defence in depth. Each gate alone is sufficient; none is trusted alone.

| # | Where | What it stops |
|---|---|---|
| 1 | `POST /api/admin/login`, before sending | An outsider ever receiving a MAZJ magic link |
| 2 | Supabase *Before User Created* auth hook | An account existing for a non-`@mazj.org` address, even via a leaked or replayed link |
| 3 | `app/admin/layout.tsx`, every request | A session that was valid once, or a forged cookie, reaching a page |

🔴 **Gate 3 calls `supabase.auth.getUser()`, never `getSession()`.**
`getSession()` decodes the cookie and believes it. `getUser()` revalidates the
token against the auth server. On a page that gates access, the difference is the
whole point.

🔴 **`proxy.ts` is not a gate.** It may redirect an obviously-anonymous visitor
for speed, but authorisation is never middleware-only. That pattern is exactly
CVE-2025-29927.

**The domain check.** Not `endsWith("@mazj.org")`. Split on the final `@`,
lowercase, trim, and compare the domain to `mazj.org` **exactly**. This rejects
`x@sub.mazj.org`, `x@notmazj.org`, and the quoted-local-part trick
`"a@mazj.org"@evil.com`. One function, `isAllowedAdminEmail()`, used by all three
gates so they can never disagree. It lives in `server/domain/admin-access.ts`
with its own test file.

**Gate 2's fallback.** If the Before User Created hook is unavailable on the free
plan, the equivalent is a `BEFORE INSERT` trigger on `auth.users` that raises for
a disallowed domain. Functionally identical; decided at implementation time
against the live project. Whichever ships, gate 2 exists.

### The Rekaz client: `server/rekaz/`

| File | Responsibility |
|---|---|
| `client.ts` | The only place that speaks HTTP to Rekaz. Basic auth, `__tenant`, explicit `User-Agent`, timeout, `Result<T, AppError>` out |
| `types.ts` | Hand-written response types. No OpenAPI exists |
| `catalog.ts` | `listProducts`, `listBranches`, `listProviders` |
| `reservations.ts` | `listReservations`, `getSlots` |
| `subscriptions.ts` | `listSubscriptions` |

Obeys the existing boundary in `server/CLAUDE.md`: no React, no `next/*`, no
`@/lib`. Throws nothing upward; every failure is an `AppError` code.

🔴 An explicit `User-Agent` is mandatory, not cosmetic. The live API returns
**403** to clients it does not recognise (`Python-urllib` is refused). Node's
`fetch` default passes today, but a runtime upgrade changing it would take
booking down with a 403 that reads like an auth failure. See
`docs/rekaz-api-findings.md`.

🔴 The Rekaz key is **admin scope**: `GET /customers` returns every customer.
Server-only, never `NEXT_PUBLIC_`, never logged. Same handling as
`SUPABASE_SECRET_KEY`.

**Crossing the boundary for cookies.** `@supabase/ssr` needs `cookies()` from
`next/headers`, which `server/` may not import. So `server/supabase/session.ts`
exports `createSessionClient(cookieAdapter)` taking get/set/remove as arguments,
and `app/admin/_lib/supabase.ts` supplies the Next implementation. The forbidden
import stays on the `app/` side of the line. `server/CLAUDE.md` anticipated this
client "the day authentication ships".

### New environment variables

`REKAZ_API_BASE`, `REKAZ_AUTH_BASIC`, `REKAZ_TENANT_ID`, added to `.env.local`,
`.env.example` and `server/env.ts` validation.

## The dashboard

One page, `/admin`. Four tiles, all live from Rekaz, plus a header carrying the
signed-in email and a sign-out button.

| Tile | Content | Source |
|---|---|---|
| **Today** | Every reservation today: time, room, customer, status | `GET /reservations?dateMin&dateMax` |
| **Right now** | Which of the two bookable rooms is occupied this minute | Derived from Today |
| **Next 7 days** | Upcoming reservations, grouped by day | `GET /reservations?upcoming` |
| **Subscriptions** | Active count, and those expiring within 30 days | `GET /subscriptions` |

**No caching.** `dynamic = "force-dynamic"`, a visible "last updated" timestamp
and a refresh control. An occupancy figure that is quietly four minutes old is
worse than none, because it will be believed.

**Times render in Riyadh time.** Rekaz returns UTC. The venue is UTC+3 and the
reader is standing in it. Every timestamp is converted once, at the edge of the
render, never in the client layer.

**Empty states are real states.** Friday and Saturday return no slots and
plausibly no reservations. "No bookings today" is a correct answer, not an error,
and must not look like a failure.

**Failure is visible, not silent.** If Rekaz is unreachable the tile says so and
offers a retry. It never renders zero, because a false zero on an occupancy board
is a wrong answer presented as a fact.

## Rate limiting

`POST /api/admin/login` is a public endpoint that causes an email to be sent. It
is the first real caller of `rate_limit_counters`, which has sat unused since the
backend foundation shipped, and it is precisely the test `server/CLAUDE.md` set:
"any public write endpoint needs both".

Limited by hashed IP, via the existing `rate_limit_hit()`. Idempotency is **not**
needed: a repeated magic-link request is legitimate, and the limiter already
covers abuse.

🔴 The response must not reveal whether an address is allowed. A disallowed
domain and an allowed one return the **same** message and the **same** timing
shape, or the endpoint becomes an oracle for enumerating staff addresses.

## Testing

| Layer | Approach |
|---|---|
| `isAllowedAdminEmail` | Unit, adversarial: casing, subdomains, `notmazj.org`, quoted local parts, whitespace, empty, missing `@`, multiple `@` |
| Rekaz client | Unit with a stubbed fetch: 403, 400 ProblemDetails, timeout, malformed JSON, each mapping to the right `AppError` |
| Slot and date helpers | Unit: padding filter, `isOutDated` filter, UTC to Riyadh |
| Live Rekaz reads | Integration, **skipped without credentials**, matching how the RLS tests already behave |
| Route protection | Assert an unauthenticated request to `/admin` redirects, and that `/admin` is absent from the sitemap |

## Risks

| Risk | Mitigation |
|---|---|
| 🔴 **Built-in Supabase email only delivers to Supabase org members.** `o.khalil@mazj.org` may simply never receive the link | Verify delivery as the **first** implementation step, before building anything on top. If it fails, add the address to the org or escalate to real SMTP. Do not discover this at the end |
| 🔴 Rekaz key is admin scope and was exposed in a chat transcript | Server-only handling now; rotate before launch (`docs/rekaz-api-findings.md`) |
| 🟡 Price and product ids rotate when edited in the Rekaz dashboard | Never hardcode. Resolve from `GET /products` at request time |
| 🟡 Rekaz has no OpenAPI, so types can drift silently | Integration tests against live reads fail loudly when a field disappears |
| 🟡 No sandbox: test writes are real | Reads only in this phase. The one permitted write is a Phase 2 booking, created then cancelled |

## Out of scope

Booking, payments, webhook receivers, customer-facing accounts, admin roles
beyond a single flat level, mutating Rekaz data from the dashboard, and any
Arabic admin UI. Each is a later decision, not a gap in this one.

## What changed during implementation

Recorded because a spec that quietly diverges from the code is worse than no
spec. Four deviations, all forced by something discovered while building.

**1. Login is a Server Action, not `POST /api/admin/login`.**
`@supabase/ssr` runs the PKCE flow, so requesting a link writes a code-verifier
cookie that the callback needs. Both halves therefore need a cookie store they
can WRITE to. A Server Action has one; it also removes a hand-rolled fetch and a
JSON contract. The rate limit still lives in the service, so it cannot be
skipped by a second caller.

**2. The callback accepts `token_hash` as well as `code`.**
While testing, an admin-generated link came back as `#access_token=...` in a URL
**fragment**, which a server can never read, and it landed on the site root
rather than the callback. `completeAdminSignIn` now handles `token_hash`
(`verifyOtp`), `code` (`exchangeCodeForSession`), and refuses anything else.
The `token_hash` path also survives requesting a link on a laptop and opening it
on a phone, which PKCE does not.

**3. The custom email template could not be set.** Supabase refuses template
edits on the free tier with the default sender (`400: Email template
modification is not available for free tier projects`). The default template
plus PKCE works and is what ships. Moving to real SMTP later unlocks the
template and needs no code change, because of deviation 2.

**4. `app/admin/_lib/**` became a second ESLint boundary crossing.** The spec
assumed admin pages could import `@/server` freely; they cannot, and widening
the rule across all of `app/admin` would have been too broad. Only `_lib` may
cross, and it exports view models rather than re-exporting backend modules.
Re-verified that violations outside `_lib` still fail.

## Verification performed

- 172 tests pass (was 102). Lint, typecheck and a production build all clean.
- The `@mazj.org` rule was run against 19 adversarial cases in **both**
  TypeScript and SQL. Both agree on all 19, including
  `"anything@mazj.org"@evil.com`.
- Gate 2 attacked live via Supabase's own `/auth/v1/otp` with the publishable
  key, bypassing the app entirely: `attacker@example.com`,
  `someone@mail.mazj.org` and `o.khalil@mazj.org.evil.com` all returned 403 and
  created no `auth.users` row.
- The full sign-in chain walked end to end without email: PKCE verifier cookie →
  auth code → callback → session cookie → `/admin` returning 200 with the
  signed-in address and all four tiles.
- 12 Rekaz integration tests pass against the live production tenant, read-only.
- `/admin` returns 307 to `/admin/login` while anonymous; sitemap holds 20 URLs
  and none contain `admin`; robots.txt disallows it.

## Resolved, and still open

✅ **Email delivery works.** The owner signed in successfully on 2026-07-27, so
Supabase's built-in sender does reach `o.khalil@mazj.org` and the org-member
restriction did not apply. The end-to-end auth chain is confirmed by a human, not
just by a scripted walk.

⚠️ Still the built-in sender though: a few messages an hour, not
production-grade, and custom templates are refused on the free tier. **Real SMTP
is required before a second person is onboarded.** No code change needed for that
switch, because `completeAdminSignIn` already handles both the PKCE `code` and
the `token_hash` shapes.

⚠️ **Rekaz credential rotation: deferred by the owner** ("no need for now",
2026-07-27). Recorded rather than re-argued. The credential is admin-scope, so
raise it again at launch.

🔴 **`uri_allow_list` still holds only `localhost` entries.** The production
callback URL must be added before deploying, or every magic link bounces to the
site root. This one is not resolved and will silently break sign-in on day one.

## Phase 2 preview

Not designed here. Recorded so the boundary is clear: all four products, prices
shown inside the booking flow only, marketing pages stay price-free, handoff to
Rekaz's hosted `paymentLink` at the payment step, and 301s from the four legacy
`mazj.sa` store paths to their new booking pages.
