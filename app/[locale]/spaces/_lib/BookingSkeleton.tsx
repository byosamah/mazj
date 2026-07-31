/**
 * The wordless frame of a booking page, held up while Rekaz answers.
 *
 * Rendered by the four `loading.tsx` files under `/spaces/<space>/book`, which
 * are three lines each for the same reason the four `page.tsx` files are: the
 * shape is identical on all four routes and it should exist once.
 *
 * 🔴 WHY THIS EXISTS. `BookingScreen` awaits `loadBookableSpace` before it
 * returns any JSX at all, so the back link and the H1 sit behind the Rekaz
 * catalog even though both are pure message-file lookups that need nothing from
 * upstream. That tenant is measured answering between 1.2 and 10.8 seconds
 * (`docs/rekaz-api-findings.md`), and until this file there was NO Suspense
 * boundary anywhere in the app, so React had no shell to flush and the visitor
 * got no feedback whatsoever for the whole wait: on a link click the previous
 * page just sat there looking like a dead button, and on a link opened from
 * WhatsApp the browser showed white. Every Book control on the site leads here,
 * including the landing hero's, so that silence was the whole conversion path.
 * This does not make Rekaz faster. It stops the slowness reading as a broken
 * site at the exact moment somebody has decided to buy.
 *
 * 🔴 WORDLESS ON PURPOSE. A "Loading..." line would be a user-facing string,
 * and every user-facing string has to exist in BOTH message files. A shape says
 * the same thing in both languages and cannot go stale in one of them.
 *
 * 🔴 STATIC ON PURPOSE. No pulse, no shimmer, and there are two reasons for that
 * with the second one load-bearing. `globals.css` collapses every animation to
 * 0.001ms under `prefers-reduced-motion`, so a pulse or a shimmer would be
 * invisible to those visitors anyway. And the site's WCAG 2.2.2 pause control
 * (`MotionToggle`) is unmounted at the owner's request, so nothing on this site
 * can pause automatic motion, while this particular wait can legitimately run
 * past ten seconds, which is exactly the case 2.2.2 is about. A frame with grey
 * slugs where the words will land already reads as "coming", and it can never
 * become the thing that keeps moving with no way to stop it.
 *
 * 🔴 DIRECTION-AGNOSTIC. Not one physical utility anywhere below: the padding is
 * symmetric and the alignment is flexbox, so the whole frame mirrors under
 * `dir="rtl"` for free and the back link lands on the correct edge in both
 * locales. If a shimmer is ever added it sweeps in a physical direction and MUST
 * be flipped per locale (`components/CLAUDE.md`, RTL).
 *
 * `aria-busy` is the only wordless signal available to a screen reader here: a
 * visually hidden status line would be copy, and copy needs both message files.
 * The shapes themselves are hidden from the accessibility tree, because they are
 * decoration standing in for content that has not arrived.
 *
 * 🔴 KEEP THE FRAME IN SYNC WITH `BookingScreen`. The `<main>` padding, the H1's
 * `mt-4` and the body's `mt-10` are copied from it verbatim, and that is what
 * buys the whole effect: measured against the live route on 2026-07-29, the H1
 * sits at +184px and the form at +264px from the top of `<main>` in BOTH this
 * skeleton and the finished page, so nothing above the fold moves at all when
 * the real content lands. If those values drift apart the skeleton starts
 * jumping, which is worse than not having one.
 *
 * Below that, each shape is a real control minus its text (a duration card is
 * 58px, a labelled field is 72px), but every step BODY deliberately holds FEWER
 * of them than the real one will. The page therefore grows downward as content
 * arrives rather than collapsing upward under the reader's eye, which is the
 * direction that does not move what somebody is already looking at.
 */
export default function BookingSkeleton() {
  return (
    <main
      id="content"
      tabIndex={-1}
      aria-busy="true"
      // Identical to BookingScreen's, including the top padding that clears the
      // fixed site header. `id="content"` keeps the skip link's target alive
      // during the wait, which is otherwise the one moment it points at nothing.
      className="mx-auto max-w-3xl px-6 pb-24 pt-32 sm:pt-36"
    >
      <div aria-hidden="true">
        {/* The back link. `h-6` is the 24px line box that a `text-sm` anchor
            actually occupies inside `<main>`, whose own 1.5 strut wins over the
            anchor's 20px. */}
        <div className="flex h-6 items-center">
          <Bar className="h-2.5 w-28" />
        </div>

        {/* 🔴 A REAL <h1> CARRYING BookingScreen's EXACT CLASSES, not a div with
            a measured height. `app/globals.css` rescues Arabic line-height with
            `html[lang="ar"] h1,h2,h3 { line-height: 1.35 !important }`, and that
            selector reaches HEADING TAGS ONLY. A fixed-height div therefore
            matched the finished page in English and missed it by 8.6px at `sm`
            in Arabic (36 x 1.35 = 48.6 against h-10's 40), so the duration cards
            (the first control a buyer touches) jumped upward the instant Rekaz
            answered, in the primary locale, which is precisely the shift this
            file exists to prevent.

            Same element plus same classes means the browser computes the same
            line box in both languages and there is nothing left to keep in sync.
            The bar is inline-block so the heading still forms a line box from
            its own font metrics rather than from the bar's height. */}
        <h1
          aria-hidden="true"
          className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          <Bar className="inline-block h-6 w-48 align-middle sm:h-7 sm:w-56" />
        </h1>

        {/* `mt-10` from BookingScreen, `space-y-10` from the form inside it. */}
        <div className="mt-10 space-y-10">
          <Step titleClassName="w-44">
            <div className="grid gap-2 sm:grid-cols-2">
              <PriceCardShape />
              <PriceCardShape />
            </div>
          </Step>

          {/* 🔴 Step 2 is deliberately ONE neutral control rather than a guess at
              the real one. The four spaces split exactly 2/2 between the two
              booking flows (`server/domain/spaces.ts`): a reservation draws a day
              strip plus a row of times, a subscription draws a date field plus a
              hint, and they are nothing like each other. There is no majority
              shape to lean on, and a `loading.tsx` takes no props and cannot ask
              which flow this is without reaching for the server catalog, which is
              the very call it is standing in for. */}
          <Step titleClassName="w-48">
            <div className="h-[66px] rounded-xl border border-black/10" />
          </Step>

          <Step titleClassName="w-28">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldShape labelClassName="w-20" />
              <FieldShape labelClassName="w-24" />
            </div>
          </Step>
        </div>
      </div>
    </main>
  );
}

/**
 * One placeholder run of text.
 *
 * Lighter than any real border or ink on the page: it has to read as an absence,
 * not as a control somebody could try to press.
 */
function Bar({className}: {className: string}) {
  return <div className={`rounded-full bg-black/10 ${className}`} />;
}

/**
 * A step's heading row, standing in for `BookingFlow`'s numbered `<h2>`.
 *
 * 🔴 A REAL <h2> with that heading's own classes, for the reason spelled out
 * above the <h1>: the Arabic line-height rescue in `app/globals.css` matches
 * heading tags only, so a fixed-height stand-in drifts by ~3.7px per step in
 * Arabic (18 x 1.35 = 24.3 against a hardcoded 28) and drifts the OPPOSITE way
 * from the H1, which is how a skeleton ends up shuffling a page in both
 * directions at once. Copying the element copies the behaviour.
 *
 * `mb-4` is the heading's own margin, so the gap to the step body is the real
 * one. The wrapper stays a plain `<div>` rather than a `<section>`: there is no
 * section here yet, and a skeleton should not claim structure it is only
 * holding space for.
 */
function Step({
  titleClassName,
  children,
}: {
  titleClassName: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* 🔴 EACH BAR SITS INSIDE A SPAN, and the spans are what hold the height.
          This <h2> is a FLEX container, so its own line-height creates no strut:
          a bare bar as a flex item would make the row as tall as the bar (14px)
          rather than as tall as the text it stands in for. Wrapped in a span,
          each bar sits in a real line box built from INHERITED line-height, so
          the Arabic `!important` rescue on the h2 reaches it exactly as it
          reaches the real anonymous text item. The numeral keeps `text-sm`
          because the real one does. */}
      <h2
        aria-hidden="true"
        className="mb-4 flex items-baseline gap-3 text-lg font-medium"
      >
        <span className="text-sm">
          <Bar className="inline-block h-2 w-2 align-middle" />
        </span>
        <span>
          <Bar className={`inline-block h-3.5 align-middle ${titleClassName}`} />
        </span>
      </h2>
      {children}
    </div>
  );
}

/**
 * One duration card: 24px of text inside `py-4` and a hairline, so 58px.
 *
 * Two bars because the real card puts its label at one end and its price at the
 * other, and `justify-between` mirrors on its own in Arabic.
 */
function PriceCardShape() {
  return (
    <div className="flex h-[58px] items-center justify-between rounded-xl border border-black/10 px-5">
      <Bar className="h-3 w-24" />
      <Bar className="h-3 w-12" />
    </div>
  );
}

/** One labelled input: a 20px label line, `mt-1.5`, then the 46px box. */
function FieldShape({labelClassName}: {labelClassName: string}) {
  return (
    <div>
      <div className="flex h-5 items-center">
        <Bar className={`h-2.5 ${labelClassName}`} />
      </div>
      <div className="mt-1.5 h-[46px] rounded-lg border border-black/10" />
    </div>
  );
}
