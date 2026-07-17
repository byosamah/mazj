"use client";

import { Children, CSSProperties, ReactNode, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Sticky-deck stacking cards (the original's "how it works" stack).
 *
 * Mechanics: every card is position:sticky at the same `top`, so each
 * incoming card slides over the stuck previous one; no GSAP pinning, which
 * keeps it cheap and RTL-proof. GSAP only drives the recede: as the next
 * card covers it, the previous card scrubs scale 1 -> `scale` and fades
 * (extracted values: scale .7, ease sine.in, fade to 0).
 *
 * Trigger math uses each card's flow position (offsetTop inside the deck),
 * NOT its sticky rect, so ScrollTrigger.refresh() mid-page can never
 * mis-measure a stuck card. `invalidateOnRefresh` re-reads it on resize.
 *
 * Reduced motion: the transforms are skipped entirely; the deck degrades
 * to plain CSS sticky stacking (scroll-position behavior, not animation).
 *
 * Usage: each child is one card; give cards their own bg + rounding so
 * they visually cover the previous one.
 */
export default function StickyDeck({
  children,
  className = "",
  top = 96,
  scale = 0.7,
  fade = true,
}: {
  children: ReactNode;
  className?: string;
  /** Sticky offset from the viewport top, px. */
  top?: number;
  /** Scale a card recedes to while the next covers it. */
  scale?: number;
  /** Fade the covered card out (true matches the original). */
  fade?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);

  useEffect(() => {
    const deck = ref.current;
    if (!deck) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>(":scope > .sdeck-card", deck);
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return; // the last card never recedes
        gsap.fromTo(
          card,
          { scale: 1, autoAlpha: 1 },
          {
            scale,
            autoAlpha: fade ? 0 : 1,
            ease: "sine.in",
            transformOrigin: "center top",
            scrollTrigger: {
              // Flow position of the NEXT card (offsetTop is unaffected by
              // sticky offsets): recede from the moment it enters the
              // viewport bottom until it reaches the stack top.
              trigger: deck,
              start: () => `top+=${next.offsetTop} bottom`,
              end: () => `top+=${next.offsetTop} ${top}px`,
              scrub: true,
              invalidateOnRefresh: true,
            },
          }
        );
      });
    }, deck);

    return () => ctx.revert();
  }, [top, scale, fade]);

  const stickyStyle: CSSProperties = { position: "sticky", top };

  return (
    <div ref={ref} className={className} style={{ position: "relative" }}>
      {items.map((child, i) => (
        <div key={i} className="sdeck-card" style={stickyStyle}>
          {child}
        </div>
      ))}
    </div>
  );
}
