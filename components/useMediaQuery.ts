"use client";

import {useCallback, useSyncExternalStore} from "react";

/**
 * SSR-safe `matchMedia` hooks.
 *
 * WHY THIS EXISTS
 * ---------------
 * Tailwind's `hidden lg:block` only sets `display: none`. The element is still
 * in the DOM, so its `<video>` / `<img>` children are still parsed, still
 * preloaded and still downloaded, on a phone where they render zero pixels.
 * The audit measured **656 KB of desktop-only media fetched at a 390px
 * viewport**. No CSS fixes that: `display:none` is a paint concern, not a
 * fetch concern. The only thing that actually stops the request is not
 * rendering the element at all, i.e. `{isDesktop && <video .../>}`, which is
 * what `useIsDesktop()` is for.
 *
 * WHY `useSyncExternalStore` AND NOT `useState` + `useEffect`
 * ----------------------------------------------------------
 * `matchMedia` is an external mutable store, and React 19 has a dedicated
 * primitive for exactly that. It takes a separate server snapshot, so the
 * server render and the hydrating client render agree by construction (both
 * `false`), and React re-reads the real snapshot right after hydration. There
 * is no hydration mismatch and no "set state in an effect" step, which is the
 * pattern this repo's ESLint config (`react-hooks/set-state-in-effect`)
 * already flags elsewhere.
 *
 * CONSEQUENCE FOR CALLERS: the first client render is always `false`. Anything
 * gated on `useIsDesktop()` mounts one paint after hydration. That is correct
 * for heavy media (that delay is the whole point) but do not gate layout
 * structure on it, or desktop will flash the mobile layout.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  // Server + first hydrating render. Must be a stable primitive.
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * True when the visitor has asked the OS to reduce motion.
 *
 * ⚠️ This docblock used to say the hook "does not enforce anything" because the
 * autoplaying background videos ignored it. That stopped being true on
 * 2026-07-31: this hook IS the enforcement now. `motion/AmbientVideo.tsx` reads
 * it as one of its three gates and simply never mounts the `<video>` when it is
 * true, and `Hero.tsx` gates its clip-window loop on it directly.
 *
 * 🔴 It gates FIVE of the site's six ambient loops. The nav CTA's fill
 * (`mazj-button.mp4` in `Navigation.tsx`) is a deliberate holdout, so the site
 * is not fully reduced-motion-safe. See `components/CLAUDE.md` for which is
 * which and why the hero's two must always be gated as a pair.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/**
 * True at Tailwind's `lg` breakpoint and up (1024px), the repo's desktop
 * cutoff. Use it to skip rendering desktop-only media entirely rather than
 * hiding it with `hidden lg:block`.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
