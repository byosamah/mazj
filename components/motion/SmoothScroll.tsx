"use client";

import { useEffect } from "react";
import type Lenis from "lenis";

/**
 * 🔴 GSAP, ScrollTrigger AND Lenis are imported DYNAMICALLY, inside the effect.
 *
 * They used to be static imports, and `gsap.registerPlugin(ScrollTrigger)` sat
 * at module scope right here. Because this component is mounted in the locale
 * layout, that put ~141 KB of animation runtime (a 69 KB gsap chunk and a 72 KB
 * ScrollTrigger + Lenis chunk) into the initial JavaScript of every one of the
 * 26 routes — including `/faq`, `/privacy` and `/terms`, which have no scrubbed
 * motion at all, and including the reduced-motion path below, which returns
 * before using any of it.
 *
 * `await import()` moves all of it behind the first effect, so it is fetched
 * after the document has painted instead of competing with it. Nothing about
 * the motion changes: the effect already ran after mount, so the only thing
 * deferred is when the bytes arrive.
 *
 * ⚠️ `import type Lenis` above is a TYPE-ONLY import and must stay that way. A
 * value import of the same name would put the library straight back into the
 * initial bundle and silently undo this, while every type still checked out.
 */

/**
 * Lenis smooth-scroll base layer (the Daylight port rides on this).
 *
 * Config mirrors the original site's extracted Lenis options
 * (lerp .12, vertical, wheelMultiplier 1, native touch). The four
 * critical GSAP wiring steps:
 *   1. create Lenis
 *   2. drive lenis.raf() from gsap.ticker (ms, ticker gives seconds)
 *   3. lenis.on("scroll", ScrollTrigger.update) so triggers stay in sync
 *   4. gsap.ticker.lagSmoothing(0) so scroll position never "jumps"
 *
 * Reduced motion: Lenis is never created; native scrolling is already
 * accessible. Renders nothing; mount once in the locale layout.
 * Companion CSS (html.lenis rules) lives in globals.css.
 */

let lenis: Lenis | null = null;

/** Shared accessor (scroll locking, programmatic scrollTo). Null when
 *  reduced motion is on or before mount; fall back to native APIs then. */
export function getLenis(): Lenis | null {
  return lenis;
}

export default function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    // `cancelled` guards the async gap: React can unmount (or Strict Mode can
    // run the effect twice) while the three chunks are still in flight, and
    // without this the teardown would run BEFORE the setup it is meant to undo,
    // leaving a live Lenis and a ticker callback nothing will ever remove.
    let cancelled = false;
    let teardown: (() => void) | undefined;

    (async () => {
      const [{default: LenisCtor}, {default: gsap}, {ScrollTrigger}] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      lenis = new LenisCtor({
        lerp: 0.12,
        orientation: "vertical",
        gestureOrientation: "vertical",
        wheelMultiplier: 1,
        smoothWheel: true,
        syncTouch: false, // touch stays native, exactly like the original
        anchors: true, // hash links scroll smoothly through Lenis
      });

      const raf = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);

      lenis.on("scroll", ScrollTrigger.update);

      // One refresh once the smooth scroller exists so pinned triggers
      // measure against the final scroll environment.
      ScrollTrigger.refresh();

      teardown = () => {
        gsap.ticker.remove(raf);
        gsap.ticker.lagSmoothing(500, 33); // restore GSAP defaults
        lenis?.destroy();
        lenis = null;
      };
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return null;
}
