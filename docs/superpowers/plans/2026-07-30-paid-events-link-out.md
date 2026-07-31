# Paid Events Link Out To The Rekaz Store: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A paid event stops selling a ticket on this site and instead shows the live Rekaz price plus one button to that product's page on the Rekaz storefront. Free events are unchanged.

**Architecture:** The admin's ticket dropdown widens to accept Rekaz one-time (Merchandise) products. The public event page resolves the live price AND the product's storefront URL in the same Rekaz call it already makes, then renders a link instead of a form. The on-site purchase path is deleted, and the registration service now refuses a ticketed event outright so the public Server Action cannot be used to claim a seat on one.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 3.4, next-intl, Vitest, Supabase, Rekaz Merchant Public API.

## Global Constraints

- 🔴 **No em-dashes (`—`) anywhere**, in code, comments, copy or commit messages. `TONE.md` §6.
- 🔴 **Any copy change touches BOTH `messages/en.json` and `messages/ar.json` in the same edit.** Identical key structure, same array lengths. Root `CLAUDE.md`.
- 🔴 **Never write a line of copy about the payment hand-off.** Owner ruling, `TONE.md` §6: "The owner chose a plain redirect with no explanatory copy, so do not write a line about the hand-off." Also never name `mazj.sa` in a CTA: `✗ "Book on mazj.sa" → ✓ "Book now"`.
- 🔴 **Reuse settled Arabic vocabulary, never coin a synonym.** `احجز الآن` is the settled booking CTA (39 uses of `احجز`). `تذكرة` is the settled ticket noun.
- 🔴 **Never spell a Tailwind arbitrary value in prose** under `app/` or `components/`. Tailwind's JIT scans comments and a `bg-[url(...)]` in a docblock 500s every route.
- 🔴 **`server/domain/` may import only `server/core/`.** A Rekaz-aware module belongs in `server/rekaz/`.
- 🔴 **`server/` may not import React, `next/*`, `next-intl`, `@/lib`, `@/app`, `@/components`, `@/i18n`.**
- **Never hardcode a Rekaz price id.** Resolve by `immutableId` at request time.
- Sandbox OFF for `npm run test`, `npm run verify`, `npm run build`, and anything reaching Rekaz or Supabase.
- `npm run build` needs `NEXT_PUBLIC_SITE_URL=https://<domain>`; `npm start` additionally needs `IP_TRUST_PROXY=none`.

---

### Task 1: Teach the Rekaz layer about one-time products and their storefront URL

**Files:**
- Modify: `server/rekaz/types.ts` (the `REKAZ_PRODUCT_TYPE` block)
- Create: `server/rekaz/store.ts`
- Test: `server/rekaz/store.test.ts`

**Interfaces:**
- Consumes: `RekazProduct` (`slug: string`, `type: RekazProductType`) from `server/rekaz/types.ts`.
- Produces:
  - `REKAZ_PRODUCT_TYPE.merchandise = 2`
  - `REKAZ_STORE_ORIGIN: string`
  - `rekazStoreUrl(product: Pick<RekazProduct, "slug" | "type">, locale: string): string | null`
  - `storeSharesDomainWith(siteOrigin: string | undefined): boolean`

- [ ] **Step 1: Write the failing test** at `server/rekaz/store.test.ts` covering: a merchandise product builds `/en/merchandise/<slug>` and `/ar/merchandise/<slug>`; a subscription product builds `/subscription/<slug>`; a reservation product builds `/reservation/<slug>`; an unknown numeric type returns `null`; any non-`ar` locale is treated as `en`; `storeSharesDomainWith` is true for `https://www.mazj.sa` and `https://mazj.sa`, false for `https://mazj-tau.vercel.app` and `https://mazj.org`, false for `undefined`.

- [ ] **Step 2: Run it and watch it fail** with a missing module.

Run: `npx vitest run server/rekaz/store.test.ts`

- [ ] **Step 3: Add `merchandise: 2`** to `REKAZ_PRODUCT_TYPE` in `server/rekaz/types.ts`, with a comment saying there is NO write endpoint for it, which is the whole reason the storefront link exists.

- [ ] **Step 4: Write `server/rekaz/store.ts`.** No `server-only` import: it is a pure string builder with no secret, same as `types.ts`, and that keeps it unit-testable. The segment map is keyed on the product type. An unmapped type returns `null` rather than interpolating `undefined` into a URL.

- [ ] **Step 5: Run the test to green.**

- [ ] **Step 6: `npm run lint && npm run typecheck`.**

---

### Task 2: The admin ticket dropdown accepts one-time products

**Files:**
- Modify: `server/services/event-tickets.ts` (`listTicketPriceOptions`)

**Interfaces:**
- Consumes: `REKAZ_PRODUCT_TYPE.merchandise` from Task 1.
- Produces: no signature change. `listTicketPriceOptions` still returns `Result<TicketPriceOption[], AppError>`.

- [ ] **Step 1: Replace the single-type check** with a set of sellable-as-a-ticket types (`subscription`, `merchandise`). Keep the `SPACE_SLUGS` exclusion exactly as it is: it is the guard that stops a 34,000 SAR private office appearing one mis-click from a 50 SAR ticket.

- [ ] **Step 2: Rewrite the module docblock.** The current one says a ticket "has to be a SUBSCRIPTION-type product" and that every ticket appears in Rekaz as a one-day subscription. Both become false. State instead that Rekaz publishes no write endpoint for a one-time product, which is exactly why the buyer is sent to the storefront.

- [ ] **Step 3: Prove it against the live catalog.** Sandbox OFF:

```bash
set -a; . ./.env.local; set +a
curl -s "${REKAZ_API_BASE}/products?PageSize=100" \
  -H "Authorization: Basic ${REKAZ_AUTH_BASIC}" -H "__tenant: ${REKAZ_TENANT_ID}" \
  -o /tmp/p.json -w "%{http_code}\n"
```
Expected: the tenant has 5 products, one of them `faalyh-tjrybyh` with `type: 2`, and it is the only one the new filter admits beyond the two subscription rooms.

---

### Task 3: The public event page links out, and the write path refuses a ticketed event

**Files:**
- Modify: `app/[locale]/events/_lib/events.ts` (`loadTicketAmount` becomes `loadTicketOffer`)
- Modify: `app/[locale]/events/[slug]/page.tsx`
- Modify: `components/events/EventRegistration.tsx`
- Modify: `app/[locale]/events/_lib/actions.ts`
- Modify: `server/services/event-registration.ts`
- Modify: `server/services/event-tickets.ts` (delete `createTicketOrder`)

**Interfaces:**
- Consumes: `rekazStoreUrl` from Task 1.
- Produces:
  - `TicketOffer = {amount: number; storeUrl: string}`
  - `loadTicketOffer(priceImmutableId: string, locale: string): Promise<TicketOffer | null>`
  - `RegistrationFormState` loses its `payment` variant.
  - `EventRegistrationResult` loses its `payment_required` variant.

- [ ] **Step 1: `loadTicketOffer`.** `resolveTicketPrice` already returns `{product, price}`, so the storefront URL costs nothing extra. Return `null` when the price cannot be resolved OR the URL cannot be built, and keep the existing docblock's point that this is the LIVE figure, never `EventView.ticketAmount`.

- [ ] **Step 2: Refuse a ticketed event in `registerForEvent`,** immediately after the published check and BEFORE any seat claim or rate-limit charge. 🔴 This is not defensive tidiness: the Server Action is a public POST endpoint reachable by id from the client bundle, so with the paid branch deleted an unguarded slug would claim a free seat on a paid event.

```ts
if (event.rekazPriceImmutableId !== null) {
  return err(
    errors.conflict("Tickets for this event are not sold here.", {
      fields: {reason: "ticketed"},
    })
  );
}
```

- [ ] **Step 3: Delete the paid machinery** from `server/services/event-registration.ts`: `purchaseTicket`, `HOLD_SECONDS`, the `paid` variable, the `payment_required` result variant, and the now-unused `attachRekazOrder` / `getRegistrationById` / `resolveTicketPrice` / `createTicketOrder` imports and `EventRecord` type import. `claimSeat` is called with `holdSeconds: 0`. `resumeExisting` collapses to returning `already_registered`; keep its docblock's idempotency reasoning, which is still exactly why this endpoint has no `idempotency_keys`.

- [ ] **Step 4: Delete `createTicketOrder`** from `server/services/event-tickets.ts`, plus every import that only it used (`createSubscription`, `findCustomerByMobile`, `absolutePaymentLink`, `RekazCustomerDetails`, `riyadhDate`, `resolveBranchId`, `env`, `errors`/`err` if unused after). Keep `listTicketPriceOptions` and `resolveTicketPrice`.

- [ ] **Step 5: `EventRegistration.tsx`** drops the `ticketed` and `amount` props, the payment redirect `useEffect`, and the amount span in `Submit`. It becomes free-only. Keep every other comment: the "everything a browser sends is a suggestion" rule, the transition-list-names-transform rule, and the error-copy-by-code rule are all still load-bearing.

- [ ] **Step 6: `actions.ts`** drops the `payment` state variant and the `payment_required` switch arm.

- [ ] **Step 7: The page.** `RegistrationPanel` gains a ticketed branch that renders the heading, a `CtaButton` at the store URL, and the VAT note. Use `CtaButton`: it already detects an `http(s)` href and renders `target="_blank" rel="noopener noreferrer"`, which is the new-tab behaviour that was chosen. Point the JSON-LD `offer.url` at the same store URL, since that is where the offer is actually transacted.

- [ ] **Step 8: Run the suite and the build.** Sandbox OFF.

Run: `npm run lint && npm run typecheck && npx vitest run test/ server/`

---

### Task 4: Copy, both files, one edit

**Files:**
- Modify: `messages/en.json`, `messages/ar.json` (`EventDetail` namespace)

- [ ] **Step 1: Add** `EventDetail.ticketTitle`, `EventDetail.ticketCta`, `EventDetail.error.conflict_ticketed`.
- [ ] **Step 2: Remove** `EventDetail.submitTicket` (nothing submits a ticket now) and `EventDetail.error.conflict_pending` (its only producer was the mid-payment resume path).
- [ ] **Step 3: Rewrite** `EventDetail.error.upstream_unavailable`, which currently promises a payment page and a 30-minute hold that no longer exist on this route.
- [ ] **Step 4: Verify key-path parity** with a script, not by eye, and confirm ONLY the `EventDetail` namespace moved (a parallel session can be editing these files).

Run: `npx vitest run test/i18n-parity.test.ts`

---

### Task 5: The admin form stops lying about Seats

**Files:**
- Modify: `app/admin/(protected)/events/EventForm.tsx`

- [ ] **Step 1: Make Seats read-only when a ticket is selected**, with a hint saying why. 🔴 `readOnly`, never `disabled`: a disabled control submits NOTHING, so saving an unrelated field would silently wipe a stored capacity. This is the same trap the date-precision control already documents in this file.
- [ ] **Step 2: Rewrite the ticketed explainer.** It currently promises "Buyers go to Rekaz to pay and their seat is held for 30 minutes. Each ticket sold shows up in Rekaz as a one-day subscription." All three claims become false.
- [ ] **Step 3: Update the empty-list hint,** which currently tells the operator to create a subscription-type product.

---

### Task 6: Make the launch collision visible, and correct the documentation

**Files:**
- Modify: `scripts/check-env.mts`
- Modify: `server/CLAUDE.md`, `app/CLAUDE.md`, `docs/rekaz-api-findings.md`

- [ ] **Step 1: Warn in `check:env`** when the store origin shares a registrable domain with `NEXT_PUBLIC_SITE_URL`. Warn, never throw: a boot refusal could take a deploy down, and the owner explicitly accepted this as a launch-day chore.
- [ ] **Step 2: Correct every documentation claim** that a ticket is a subscription, plus the dead-code notes for `attachRekazOrder` and `getRegistrationById`.
- [ ] **Step 3: Record the merchandise product type and the three storefront URL shapes** in `docs/rekaz-api-findings.md`, including that no write endpoint for merchandise was found.

Run: `npm run check:env`

---

### Task 7: Verify

- [ ] `npm run verify` with the sandbox OFF and real credentials. Read the SKIP count, not just the colour.
- [ ] `NEXT_PUBLIC_SITE_URL=https://mazj-tau.vercel.app npm run build`, redirected to a file, never piped to `head`.
- [ ] Curl both locales of a real event page and confirm the panel renders.
