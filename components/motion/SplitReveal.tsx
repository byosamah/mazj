"use client";

import { ReactNode, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * SplitText line-mask rise, the original site's signature text move:
 * lines start below an overflow-hidden mask and rise to rest
 * (yPercent 110 -> 0, .8s power4.out, stagger .1, start "top 90%", once).
 *
 * Bilingual / RTL safety:
 * - Splits by LINES ONLY. Char/word splitting would break Arabic cursive
 *   shaping (letters de-ligate); line splitting never cuts inside a word.
 *   Vertical rise is direction-agnostic, so the same motion works in RTL.
 * - `autoSplit` waits for fonts (Thmanyah has very different metrics from
 *   the fallback) and re-splits on resize; the tween returned from onSplit
 *   is re-created against the fresh lines automatically.
 * - `aria: "auto"` keeps a readable aria-label on the tag while split, so
 *   screen readers never see per-line fragments.
 * - On complete the split REVERTS to the original DOM. This also removes
 *   the masks, so tight display leading (lg:leading-[0.98]) can never
 *   guillotine Latin descenders at rest (see the .intro-mask gotcha).
 *
 * Reduced motion: text is simply shown, no split, no motion.
 * Prefer plain-string children (one t("...") value) so SplitText measures
 * clean text nodes.
 */
export default function SplitReveal({
  children,
  as: Tag = "h2",
  className = "",
  duration = 0.8,
  stagger = 0.1,
  delay = 0,
  start = "top 90%",
}: {
  children: ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  duration?: number;
  stagger?: number;
  delay?: number;
  start?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      gsap.set(el, { autoAlpha: 1 });
      return;
    }

    let split: SplitText | null = null;
    const ctx = gsap.context(() => {
      split = SplitText.create(el, {
        type: "lines",
        mask: "lines", // auto overflow-hidden wrapper per line
        autoSplit: true, // waits for fonts, re-splits on resize
        aria: "auto",
        onSplit(self) {
          // The element ships visibility:hidden (FOUC guard); reveal the
          // container now that lines are parked below their masks.
          gsap.set(el, { autoAlpha: 1 });
          return gsap.from(self.lines, {
            yPercent: 110,
            duration,
            delay,
            stagger,
            ease: "power4.out",
            scrollTrigger: { trigger: el, start, once: true },
            onComplete: () => self.revert(), // restore clean DOM at rest
          });
        },
      });
    }, el);

    return () => {
      ctx.revert();
      split?.revert();
    };
  }, [duration, stagger, delay, start]);

  const Component = Tag as any;
  return (
    <Component ref={ref} className={className} style={{ visibility: "hidden" }}>
      {children}
    </Component>
  );
}
