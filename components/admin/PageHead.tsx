import { Eyebrow } from "./Eyebrow";

type PageHeadProps = {
  /** From `nav.ts`, or "PROGRAMME · EVENTS" on a detail route. */
  eyebrow: string;
  title: string;
  lede?: React.ReactNode;
  /** At most two <Btn>. */
  actions?: React.ReactNode;
  /** A Breadcrumb, on detail routes only. */
  back?: React.ReactNode;
  /**
   * The Notice / HealthStrip slot. It renders ABOVE everything it affects,
   * which is the whole reason it is a slot on the head rather than a thing the
   * page drops in wherever it happens to build the failing tile.
   *
   * 🔴 PASS `undefined`, NEVER A COMPONENT THAT MIGHT RENDER NOTHING. The slot is
   * gated on truthiness (`{notice && <div className="mt-6">…</div>}` below), and a
   * React element is truthy even when the component returns null, so
   * `notice={<MyNotice />}` opens an empty 24px box above the first section on
   * every day the notice has nothing to say. `HealthStrip` renders null on an
   * empty list and is safe only because both of its call sites (`/admin/events`
   * and `/admin/startups`, 2 of 2, checked 2026-07-30) test `health.length > 0`
   * themselves rather than letting the component decide.
   * A conditional notice must therefore be a FUNCTION CALL returning
   * `React.ReactNode | undefined`, not an element. `/admin`'s
   * `unsentDecisions(count)` is the worked example.
   */
  notice?: React.ReactNode;
};

/**
 * One per route, mandatory. Replaces the stranded <h1> and the deleted desktop
 * header band.
 *
 * 🔴 `text-32 font-black … lg:text-40` is not negotiable. It is DESIGN.md's
 * `display-page` ramp pinned at its smallest legitimate rung, and weight 900 is
 * stated there as load-bearing: "Page titles are set at 900 and section
 * statements at 700. Reverting either to 500 flattens the whole page."
 *
 * What shipped before this was a t-shirt-sized 24px title at weight 600, a
 * weight Thmanyah does not carry, which CSS font matching silently resolves up
 * to 700. So the old title was neither the size nor the weight anyone chose.
 *
 * The parent follows this with `space-y-10` (40px) to the first Section.
 */
export function PageHead({
  eyebrow,
  title,
  lede,
  actions,
  back,
  notice,
}: PageHeadProps) {
  return (
    <header className="border-t border-border pt-5">
      {back}
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <h1 className="text-32 font-black leading-[1.05] tracking-[-0.02em] lg:text-40">
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
      {lede && (
        <p className="mt-3 max-w-[62ch] text-pretty text-15 leading-[1.625] text-subtle-foreground">
          {lede}
        </p>
      )}
      {notice && <div className="mt-6">{notice}</div>}
    </header>
  );
}
