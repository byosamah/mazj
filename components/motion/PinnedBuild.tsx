"use client";

import { ReactNode, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * Pinned multi-part build timeline (the original's "step" scrollytelling).
 * The section pins and a single scrubbed timeline assembles its parts in
 * choreographed order. Parts are declared with data attributes on any
 * descendants (all optional; extracted timeline positions in brackets):
 *
 *   data-build-media          clip-path window opens from a rounded slit
 *                             inset(37.5% 16.29% 31% 16.29% round 1rem) -> 0
 *                             [t=0, 2s power4.out]
 *   data-build-zoom[="3.1"]   element un-zooms from NxN to 1 while easing
 *                             down y:40 -> 0 [t=0, 2s power4.out]
 *   data-build-title          SplitText masked lines rise
 *                             [t=.6, 1.2s stagger .2 power4.out]
 *   data-build-rise           fade-rise rows, sequenced [t=.8 + i*.2, .8s]
 *   data-build-sweep          pill/rect slides xPercent 0 -> 109 (mirrored
 *                             to -109 in RTL) [t=1.3, .5s power4.inOut]
 *
 * Desktop only (min-width 1024px), matching the site's existing pin rule;
 * on mobile and under reduced motion nothing is hidden or pinned, content
 * just flows. gsap.matchMedia reverts cleanly across breakpoint changes.
 *
 * Timeline building waits for document.fonts.ready so SplitText measures
 * real Thmanyah lines (splitting against fallback metrics breaks Arabic).
 * Lines-only splitting keeps Arabic cursive shaping intact, and the rise
 * is vertical, so the whole build is RTL-safe.
 *
 * NOTE: title masks persist while the section is scrubbed, so avoid
 * ultra-tight leading (< 1.1) on data-build-title in Latin or descenders
 * will clip; Arabic is covered by the html[lang="ar"] heading line-height.
 */
export default function PinnedBuild({
  children,
  className = "",
  viewports = 1.4,
}: {
  children: ReactNode;
  className?: string;
  /** Pinned scroll distance in viewport heights (original: 1.4 per step). */
  viewports?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rtl = document.documentElement.dir === "rtl";
    const mm = gsap.matchMedia();

    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", (context) => {
      const media = gsap.utils.toArray<HTMLElement>("[data-build-media]", el);
      const zooms = gsap.utils.toArray<HTMLElement>("[data-build-zoom]", el);
      const titles = gsap.utils.toArray<HTMLElement>("[data-build-title]", el);
      const rises = gsap.utils.toArray<HTMLElement>("[data-build-rise]", el);
      const sweeps = gsap.utils.toArray<HTMLElement>("[data-build-sweep]", el);

      // Park the parts immediately (before fonts resolve) so nothing
      // flashes fully-assembled, then hands scroll the build.
      const CLIP_FROM = "inset(37.5% 16.29% 31% 16.29% round 1rem)";
      const CLIP_TO = "inset(0% 0% 0% 0% round 1rem)";
      if (media.length) gsap.set(media, { clipPath: CLIP_FROM });
      if (titles.length) gsap.set(titles, { autoAlpha: 0 });
      if (rises.length) gsap.set(rises, { autoAlpha: 0, yPercent: 50 });

      let disposed = false;
      const splits: SplitText[] = [];

      document.fonts.ready.then(() => {
        if (disposed) return;
        // context.add keeps late (post-font) animations owned by this
        // matchMedia context so breakpoint flips revert them too.
        context.add(() => {
          const tl = gsap.timeline({
            defaults: { force3D: true },
            scrollTrigger: {
              trigger: el,
              start: "top top",
              end: () => `+=${Math.round(window.innerHeight * viewports)}`,
              pin: true,
              scrub: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          });

          if (media.length) {
            tl.fromTo(
              media,
              { clipPath: CLIP_FROM },
              { clipPath: CLIP_TO, duration: 2, ease: "power4.out" },
              0
            );
          }

          zooms.forEach((z) => {
            const from = parseFloat(z.dataset.buildZoom || "") || 3.1;
            tl.fromTo(
              z,
              { y: 40, scale: from },
              { y: 0, scale: 1, duration: 2, ease: "power4.out" },
              0
            );
          });

          titles.forEach((title) => {
            const split = SplitText.create(title, {
              type: "lines",
              mask: "lines",
              aria: "auto",
            });
            splits.push(split);
            gsap.set(title, { autoAlpha: 1 });
            tl.fromTo(
              split.lines,
              { autoAlpha: 0, yPercent: 100 },
              { autoAlpha: 1, yPercent: 0, duration: 1.2, stagger: 0.2, ease: "power4.out" },
              0.6
            );
          });

          rises.forEach((row, i) => {
            tl.fromTo(
              row,
              { autoAlpha: 0, yPercent: 50 },
              { autoAlpha: 1, yPercent: 0, duration: 0.8, ease: "power4.out" },
              0.8 + i * 0.2
            );
          });

          sweeps.forEach((pill) => {
            tl.fromTo(
              pill,
              { xPercent: 0 },
              { xPercent: rtl ? -109 : 109, duration: 0.5, ease: "power4.inOut" },
              1.3
            );
          });
        });
      });

      return () => {
        disposed = true;
        splits.forEach((s) => s.revert());
      };
    });

    return () => mm.revert();
  }, [viewports]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
