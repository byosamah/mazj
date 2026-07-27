"use client";

import {useEffect, useLayoutEffect, useRef} from "react";
import {usePathname} from "@/i18n/navigation";
import {getLenis} from "./motion/SmoothScroll";

/**
 * Reset the scroll to the top of the page on forward navigation.
 *
 * The site runs Lenis smooth scroll (components/motion/SmoothScroll), which owns
 * the window scroll through its own RAF loop. Next's built-in scroll-to-top on
 * navigation is therefore reverted a frame later: Lenis still holds the PREVIOUS
 * route's scroll as its target and lerps the window back down to it. The visible
 * bug was that clicking a link from the footer opened the new route but left you
 * parked at the bottom, so the navigation looked like it did nothing.
 *
 * Fix: on every real forward navigation, hand Lenis a fresh target of 0 (or reset
 * native scroll under reduced motion, where Lenis is never created). Three cases
 * are deliberately left alone:
 *   - back / forward (popstate): let the browser restore the previous position.
 *   - a cross-page "#hash" target: it keeps its own anchor scroll.
 *   - language switch: next-intl's usePathname is locale-stripped, so /en/about →
 *     /ar/about reports the SAME path and this never fires — you keep your place.
 *
 * Mount once in the locale layout, next to SmoothScroll.
 */

// Layout effect on the client so the reset lands BEFORE paint (the new page never
// flashes at the old scroll position); a plain effect on the server avoids React's
// "useLayoutEffect does nothing on the server" warning. Same guard as Hero.tsx.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function ScrollReset() {
  const pathname = usePathname();
  const firstRender = useRef(true);
  const poppedBack = useRef(false);

  // Flag back/forward navigations so the reset below defers to the browser's own
  // scroll restoration for them.
  useEffect(() => {
    const onPopState = () => {
      poppedBack.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useIsoLayoutEffect(() => {
    // Never touch the initial load: a deep link or "#hash" owns that position.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Back/forward: leave the restored position as the browser set it.
    if (poppedBack.current) {
      poppedBack.current = false;
      return;
    }
    // A cross-page "#hash" target keeps its own anchor scroll.
    if (window.location.hash) return;

    const lenis = getLenis();
    if (lenis) {
      // immediate + force resets Lenis's animated AND target scroll to 0, so its
      // RAF loop stops pulling the window back to the previous route's position.
      lenis.scrollTo(0, {immediate: true, force: true});
    } else {
      // Reduced motion: Lenis was never created. Native scroll is instant here
      // because the reduced-motion rule forces scroll-behavior: auto.
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
