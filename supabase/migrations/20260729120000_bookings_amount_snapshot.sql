-- What MAZJ charged for a booking, frozen at the moment of sale.
--
-- 🔴 WHY THIS COLUMN HAS TO EXIST: `price_immutable_id` CANNOT ANSWER THE
-- QUESTION, AND NOTHING ELSE ON THE TABLE CAN EITHER.
--
-- A Rekaz price carries two identifiers. Its `id` ROTATES the moment anyone
-- edits that price in the Rekaz dashboard; its `immutableId` survives the edit
-- (server/rekaz/types.ts records both, measured). That is exactly why
-- `bookings.price_immutable_id` stores the immutable one rather than the
-- rotating one, and it is also the precise limit of what that column can tell
-- you: resolving it against `GET /products` answers "what does that price cost
-- TODAY". It has never been able to answer "what did we charge this buyer".
-- The two are the same number only until the first edit.
--
-- So the first time the owner corrects a price in Rekaz, every historical row in
-- this table silently re-prices itself, and the only record MAZJ holds of what
-- it sold stops being able to say what it sold it for. Nothing errors, nothing
-- logs, and the change arrives through a vendor dashboard rather than a commit,
-- so there is no diff anywhere that would ever show it happened. That is why
-- this is filed as data loss rather than as a missing feature.
--
-- 🔴 WHAT THIS IS NOT, and the three rules that follow from it.
--
--   1. NOT an invoice and NOT a receipt. Rekaz is the merchant of record: it
--      collects on its own hosted page and issues the ZATCA-compliant document.
--      This column must never be rendered with a VAT line, because it has never
--      been near one, and inventing a tax breakdown from a gross figure is how
--      a plausible-looking document becomes a wrong one.
--   2. NOT proof of payment. Nothing in this repository can learn whether a
--      booking was paid: Rekaz pushes no payment status and exposes no webhook,
--      which is why `status` holds only `pending` and `indeterminate`. See
--      supabase/migrations/20260728140000_bookings.sql for that reasoning; it is
--      not repeated here.
--   3. NOT for a customer. This is the figure the buyer was shown on the submit
--      button before they were handed to checkout, kept so a member of staff can
--      answer "what did I pay". It is admin-only, like every other column here.
--      🔴 "The figure the buyer was shown" is load-bearing and is enforced by
--      ONE function, `chargedAmount` in server/rekaz/catalog.ts, which both the
--      booking page and the write path call. A Rekaz price carries `amount` AND
--      `discountedAmount`; the page renders the discounted one when set. Writing
--      the list amount here instead would put a number the buyer never saw into
--      the column whose entire purpose is to say what they were charged, and it
--      would start doing so on exactly the dashboard edit this column exists to
--      survive.
--
-- NULLABLE, for two reasons rather than one. Rows written before this migration
-- have no value and no honest way to acquire one, and a backfilled guess in a
-- column whose whole purpose is to be trustworthy is worse than a null. And the
-- write that fills this table is best effort BY DESIGN: it runs after the
-- customer's money path has already succeeded, so a constraint firing here
-- destroys the only record of a real booking to enforce a tidiness rule nothing
-- reads. Same reasoning the parent migration gives for pairing no handle with
-- `flow`. The application clamps the value rather than letting the check fire.
--
-- ⚠️ ALTER rather than a new table, so the security posture carries over
-- untouched: RLS stays enabled with zero policies and the grants stay revoked
-- from `anon` and `authenticated`. Nothing here re-states them, and nothing here
-- should: a re-statement is a second place to get it wrong.
--
-- PRECEDENT: `events.ticket_amount numeric(10, 2)` already exists in this schema
-- as exactly this kind of display snapshot, with the same "never used to charge
-- anybody" caveat. This is the same shape for the same reason.

alter table public.bookings
  add column amount_snapshot numeric(10, 2)
    check (amount_snapshot is null or amount_snapshot >= 0);

comment on column public.bookings.amount_snapshot is
  'What MAZJ charged, frozen at the moment of sale. Display only. Never an invoice, a receipt or proof of payment.';
