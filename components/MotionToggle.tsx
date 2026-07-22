"use client";

import {useCallback, useEffect, useSyncExternalStore} from "react";
import {useTranslations} from "next-intl";
import {usePrefersReducedMotion} from "./useMediaQuery";

/**
 * Sitewide "pause all motion" control.
 *
 * WHY: WCAG 2.2.2 Pause, Stop, Hide (Level A) requires a mechanism to pause any
 * automatically-moving content that runs longer than 5 seconds. The audit
 * counted 9 autoplaying looping videos on the home page (2 on every other
 * route) with no pause mechanism anywhere on the site, and confirmed they keep
 * running even when the visitor asks for reduced motion: video `currentTime`
 * advanced 3.013s across a 3.000s wall-clock window with reduced motion active.
 * The OS preference is a hint the videos never read, so the site needs a real,
 * user-operable control. This is it.
 *
 * WHAT IT DOES
 *  1. Pauses / plays every `<video>` currently in the document.
 *  2. Sets `data-motion="paused"` on `<html>`, so CSS can freeze keyframe and
 *     transition-driven motion too (video is not the only thing that moves).
 *     🔴 That CSS rule lives in `app/globals.css`, which this component does not
 *     own. Without it the attribute is inert and only the videos stop.
 *  3. Catches videos that mount later (scroll-revealed sections, the space
 *     finder's crossfade) with a capture-phase `play` listener: `play` does not
 *     bubble, so capture on `document` is what sees it. Anything that tries to
 *     autoplay while paused is stopped immediately. That is cheaper and more
 *     reliable than polling or a MutationObserver, and it only runs while the
 *     visitor has actually paused.
 *
 * STATE: read through `useSyncExternalStore`, not `useState` + `useEffect`, so
 * the server render and the hydrating render agree (both "no stored
 * preference") and the real value lands right after hydration. No hydration
 * mismatch, and no set-state-in-effect (the lint rule this repo already trips
 * in `Hero.tsx`).
 */

const STORAGE_KEY = "mazj-motion";

type MotionPref = "paused" | "running";

/** `undefined` = not read yet. `null` = read, nothing stored. */
let cached: MotionPref | null | undefined;
const listeners = new Set<() => void>();

function readStored(): MotionPref | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "paused" || v === "running" ? v : null;
  } catch {
    // localStorage throws outright in some privacy modes, not just when full.
    return null;
  }
}

function getStoredSnapshot(): MotionPref | null {
  if (cached === undefined) cached = readStored();
  return cached;
}

function getServerSnapshot(): MotionPref | null {
  return null;
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  // Keep other tabs in sync: the toggle is sitewide, so it should feel sitewide.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cached = readStored();
    onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function writeStored(next: MotionPref) {
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Non-fatal: the toggle still works for this page view, it just will not
    // be remembered. Never let a storage failure break the control itself.
  }
  for (const l of listeners) l();
}

export default function MotionToggle() {
  const t = useTranslations("Motion");

  const stored = useSyncExternalStore(subscribe, getStoredSnapshot, getServerSnapshot);
  const prefersReduced = usePrefersReducedMotion();

  // An explicit choice always wins. With no stored choice, the OS preference
  // decides, so a reduced-motion visitor lands on a already-paused page.
  const paused = stored === null ? prefersReduced : stored === "paused";

  useEffect(() => {
    const root = document.documentElement;

    if (!paused) {
      root.removeAttribute("data-motion");
      document.querySelectorAll("video").forEach((v) => {
        // play() rejects if it is interrupted (a competing pause, an unmount).
        // That rejection is expected and harmless, so it is swallowed.
        v.play().catch(() => {});
      });
      return;
    }

    root.setAttribute("data-motion", "paused");
    document.querySelectorAll("video").forEach((v) => v.pause());

    // Videos that mount (or autoplay) after this point: `play` does not bubble,
    // so listen in the capture phase on the document.
    const stopLateStarters = (e: Event) => {
      const el = e.target;
      if (el instanceof HTMLVideoElement) el.pause();
    };
    document.addEventListener("play", stopLateStarters, true);
    return () => document.removeEventListener("play", stopLateStarters, true);
  }, [paused]);

  const toggle = useCallback(() => {
    writeStored(paused ? "running" : "paused");
  }, [paused]);

  const label = paused ? t("resume") : t("pause");

  // text-beige/90 on the className, matching the social links it now sits
  // beside. It was beige/70 when this control was meant to float on a dark chip;
  // on the footer's scrimmed coral that measured ~3.4:1 with the grain penalty,
  // failing WCAG 1.4.3. beige/90 on the same backdrop computes 4.92:1.
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={paused}
      className="eyebrow inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-[8px] text-12 text-beige/90 hover:text-beige hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-beige/75 [transition:opacity_200ms,color_200ms,transform_120ms] active:scale-[0.96]"
    >
      <span aria-hidden="true" className="opacity-70">
        [
      </span>
      <span>{label}</span>
      <span aria-hidden="true" className="opacity-70">
        ]
      </span>
    </button>
  );
}
