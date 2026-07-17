"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

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

    lenis = new Lenis({
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

    return () => {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33); // restore GSAP defaults
      lenis?.destroy();
      lenis = null;
    };
  }, []);

  return null;
}
