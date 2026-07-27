# `server/` — the MAZJ backend

Everything in this folder is backend code. The rule that makes it worth having
its own folder is a single constraint:

> **Nothing in `server/` may import React, `next/*`, `next-intl`, or anything
> from `app/`, `components/` or `lib/`.**

That constraint is enforced by ESLint (see `eslint.config.mjs`), so breaking it
is a build error rather than a broken promise. It is also the whole reason this
code is portable: because it has no framework dependency, the folder can be
lifted into its own package or its own deployed service later without a rewrite.

## Layers, outermost first

| Layer | Responsibility | May import |
|---|---|---|
| `app/api/*/route.ts` (outside this folder) | Parse the HTTP request, call one service, map `Result` to a response. About five lines. | services, validation, core |
| `services/` | Orchestration. Sequences domain rules, database calls and integrations. Returns `Result`, never throws across the boundary. | domain, db, integrations, core |
| `domain/` | Pure business rules. No I/O, no clients, no clock unless injected. Trivially unit-testable. | core |
| `db/` | Data access, one module per table. Speaks rows in, rows out. No business rules. | supabase, core |
| `integrations/` | Third-party APIs (Rekaz). Retry, idempotency, typed responses. | core |
| `core/` | Result types, typed errors, logging, rate limiting, idempotency. | nothing |
| `supabase/` | Client construction only. | env |
| `env.ts` | Validated configuration. Fails loudly. | nothing |

Dependencies point inward only. A `domain/` module importing from `db/` is a bug.

## The two Supabase clients

There are exactly two, and mixing them up is the most expensive mistake
available in this codebase.

- **`supabase/admin.ts`** uses the secret key. It **bypasses Row Level Security
  entirely.** It imports `server-only` so it can never reach a browser bundle.
  Use it in services, after validation, for work the user is authorised to do.
- **`supabase/public.ts`** uses the publishable key. RLS applies. Today its only
  job is proving in tests that our tables really are closed.

A third client (request-scoped, carrying a signed-in user's session via
`@supabase/ssr`) belongs here the day authentication ships. Not before.

## Adding a table

1. Write a migration in `supabase/migrations/`. In the **same** migration:
   enable RLS, and `revoke all` from `anon` and `authenticated`. A table is never
   born reachable.
2. `npm run db:push`, then `npm run db:types` to regenerate `types.gen.ts`.
   Never hand-edit that file.
3. Add a `db/` module for access, a `domain/` module if there are rules, and a
   `services/` module if there is orchestration.

## Configuration

See `.env.example`. `npm run check:env` validates the current environment
without starting the app; run it before deploying.
