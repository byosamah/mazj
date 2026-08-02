"use client";

import Image from "next/image";
import {useEffect, useRef, useState} from "react";
import {useIsDesktop, usePrefersReducedMotion} from "../useMediaQuery";

/**
 * The site's ONE decorative background loop.
 *
 * WHY THIS EXISTS
 * ---------------
 * Six `<video autoPlay muted loop>` elements were scattered across the landing
 * page, each already carrying `preload="none"` and a comment explaining that
 * this kept it off the critical path. **`preload="none"` does not survive
 * `autoPlay`.** A muted autoplaying video is by definition a video the page has
 * asked to start, so the browser fetches it regardless of the hint, and the
 * measurements said so plainly: on one throttled mobile load of `/en`,
 * `mazj-hero.mp4` transferred **3.0 MB**, `why-onehouse.mp4` 437 KB,
 * `footer-dune.mp4` 323 KB, `step-into.mp4` 199 KB and `why-mazj.mp4` 182 KB —
 * all of them requested inside the first 80ms, all at Low priority, all
 * competing with the fonts the headline was waiting on. Total page weight was
 * 6.75 MB and Largest Contentful Paint was 6.7s.
 *
 * The only thing that actually stops the request is not giving the element a
 * `src`, which is what this component does. A `<video>` with no `src` costs
 * nothing; the poster underneath it is a real `next/image`, so it is served as
 * AVIF at the viewport's own width rather than as the full-size JPEG.
 *
 * THREE GATES, ALL OF WHICH MUST OPEN
 * -----------------------------------
 * 1. **In view.** An IntersectionObserver with a 300px margin, so a clip starts
 *    fetching just before it is scrolled to and is playing by the time it
 *    arrives. Below-fold footage no longer competes with the opening paint.
 * 2. **`desktopOnly`, for the heavy one.** `hidden lg:block` is a paint concern,
 *    not a fetch concern — this repo has already been bitten by that twice (see
 *    `useMediaQuery.ts`). The hero background is 4.7 MB of 720p; a phone draws
 *    it behind a scrim, a spectrum wash and the headline, and pays for it in
 *    full. It gets the poster instead, which is that video's own frame 0, so
 *    the still and the first frame are the same picture.
 * 3. **Motion not reduced.** 🔴 `<video autoplay>` ignores the CSS
 *    `prefers-reduced-motion` block entirely, so with `MotionToggle` unmounted
 *    at the owner's request NOTHING gated these six loops: a visitor who asked
 *    their OS for less motion got all of them. `components/CLAUDE.md` records
 *    that the fix, if ever wanted, "has to be JS … never the `@media` block".
 *    This is that fix. It is invisible to everyone who has not opted in, and it
 *    does not reinstate the removed toggle.
 *
 * The poster is always rendered and the video is layered over it, with no
 * `poster` attribute of its own: an undecoded `<video>` paints transparent, so
 * the still below shows through until the first frame lands and the handoff has
 * nothing to flash. Setting `poster` here as well would fetch the same picture
 * twice, once optimized and once not.
 */
export default function AmbientVideo({
  src,
  poster,
  sizes = "100vw",
  priority = false,
  desktopOnly = false,
  className = "",
}: {
  src: string;
  /** The video's own frame 0. See the poster rule in components/CLAUDE.md. */
  poster: string;
  /** Rendered width per breakpoint, for the poster's responsive candidates. */
  sizes?: string;
  /** Set only where the poster is in the opening viewport. */
  priority?: boolean;
  /** Skip the video below `lg` and show the poster alone. For heavy clips. */
  desktopOnly?: boolean;
  /** Applied to BOTH layers so the still and the footage read identically. */
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const isDesktop = useIsDesktop();
  const reduceMotion = usePrefersReducedMotion();

  // Both hooks report `false` on the server and on the first hydrating render
  // by design, so a `desktopOnly` clip mounts one paint after hydration. That
  // delay IS the saving; the poster is already painted underneath, at the same
  // crop, so there is nothing to see and nothing to shift.
  const allowed = !reduceMotion && (!desktopOnly || isDesktop);

  // 🔴 DERIVED, not a third piece of state. `inView` is the only thing the
  // observer owns; whether that becomes playback is a plain expression over it.
  // Writing `play` into state instead would mean clearing it from inside the
  // effect when a gate closes, which is the cascading-render pattern this
  // repo's `react-hooks/set-state-in-effect` rule rejects — and it would also
  // be a second source of truth for "is this playing".
  const play = allowed && inView;

  useEffect(() => {
    // While a gate is shut there is nothing to observe: `play` is already false
    // by derivation, so a closing gate needs no cleanup of its own.
    if (!allowed) return;
    const el = hostRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      {rootMargin: "300px 0px"}
    );
    io.observe(el);
    return () => io.disconnect();
  }, [allowed]);

  return (
    // `data-ambient` is ScrollFX's handle on this block. It must stay: the
    // pin-scale effect used to grab the `<video>` directly, which is now absent
    // at mount time, so this wrapper is what it animates instead.
    <div ref={hostRef} data-ambient aria-hidden="true" className="absolute inset-0">
      {/* 🔴 `fetchPriority` is passed EXPLICITLY, because `priority` does not
          imply it. Next 16 treats the two as independent props: `priority`
          sets `meta.preload`, and the preload's own fetchpriority is built
          from `imgAttributes.fetchPriority`, so leaving it undefined emits no
          attribute at all. Measured on the 26 rendered production pages before
          this line: 370 <img>, 48 <link rel=preload as=image>, and ZERO
          carrying fetchpriority. The hero poster is the LCP element on the
          landing page in both locales, so it was being preloaded and then
          fetched at the browser's default priority for an <img>. */}
      <Image
        src={poster}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        fetchPriority={priority ? "high" : undefined}
        className={`object-cover ${className}`}
      />
      {play && (
        <video
          className={`absolute inset-0 h-full w-full object-cover ${className}`}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          src={src}
        />
      )}
    </div>
  );
}
