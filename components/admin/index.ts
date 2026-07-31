/**
 * The /admin design system: 22 primitives, all server components.
 *
 * 🔴 IMPORT BOUNDARY. These may be imported only from `app/admin/**`. They use
 * admin tokens that resolve through CSS variables defined in
 * `app/admin/admin.css`, which is imported by `app/admin/layout.tsx` and by
 * nothing else, because the admin is a SECOND root layout with its own <html>
 * and <body>. Used on a marketing page, `bg-card` or `text-ok` produces an
 * invalid declaration that the browser DROPS SILENTLY: the element keeps
 * whatever it inherited and nothing visibly breaks. Same silent-nothing failure
 * mode as a type size outside the closed set.
 *
 * 🔴 NONE of these carries a client directive, and that is a property to defend
 * rather than a coincidence. The admin's client components are SIX, all of them
 * under `app/admin`: `(protected)/Sidebar.tsx` (`usePathname` plus
 * `useLinkStatus`), `(protected)/events/EventForm.tsx`,
 * `(protected)/startups/[id]/DecisionForms.tsx`, `login/LoginForm.tsx`, and the
 * two `error.tsx` boundaries, which Next requires to be client components. The
 * dashboard PAGE contributes none of them: its two arrive from the layout's rail
 * and from the boundary file beside it.
 *
 * That set is asserted BY NAME in `test/admin-page-guards.test.ts`, so a seventh
 * fails there rather than quietly outdating this paragraph. Re-derive it with
 * `grep -rln "use client" app/admin --include='*.tsx'`. This sentence said
 * "five" until 2026-07-29, when the grep returned six, which is exactly why the
 * number now lives in a test instead of in prose. No primitive here may be used
 * in a way that changes the set.
 *
 * `cn()` from `@/lib/utils` is sanctioned in this directory and forbidden in
 * `components/` elsewhere. Both halves of that matter: the marketing site
 * composes its classes literally so a format-on-save linter can still see them.
 */

export { Ar } from "./Ar";
export { Btn } from "./Btn";
export { Chip } from "./Chip";
export { DataTable, Td, Th } from "./DataTable";
export { Disclosure } from "./Disclosure";
export { EmptyState } from "./EmptyState";
export { ErrorState } from "./ErrorState";
export { Eyebrow } from "./Eyebrow";
export { Field } from "./Field";
export { Handle } from "./Handle";
export { HealthStrip, type HealthItem } from "./HealthStrip";
export { LoadingLane } from "./LoadingLane";
export { Metric } from "./Metric";
export { Notice } from "./Notice";
export { PageHead } from "./PageHead";
export { Panel } from "./Panel";
export { RecordList, RecordRow } from "./RecordList";
export { RevealButton, RevealedSecret } from "./RevealedSecret";
export { Section } from "./Section";
export {
  DEFAULT_FILL,
  MARK,
  StatusDot,
  UNKNOWN_MARK,
  mark,
  type Fill,
  type Tone,
} from "./StatusDot";
export { Stamp, formatStamp, type StampPrecision } from "./Stamp";
export { UnknownValue } from "./UnknownValue";
