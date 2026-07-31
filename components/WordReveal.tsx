"use client";

import { useEffect, useRef } from "react";

/**
 * Word-by-word scroll reveal — Daylight's signature statement motion.
 *
 * Splits the text on WORD boundaries only (whitespace), never inside a word,
 * so Arabic intra-word letter joining is preserved in the RTL build. Each word
 * fades and rises in with a running stagger once the block scrolls into view.
 * A `\n` in the text becomes a hard line break (one `.wr-line` block per line),
 * replacing the need for `whitespace-pre-line`.
 *
 * ⚠️ This docblock used to claim the component was "No-JS safe: the CSS leaves
 * words visible by default". It is not, and never was: `.word-reveal .wr-word`
 * rests at `opacity: 0` in globals.css and is restored only by the
 * `.is-visible` class this file's observer adds. With JavaScript off, every
 * heading using it renders blank. The reduced-motion half of the claim IS true
 * (the block at the bottom of globals.css restores opacity and transform).
 *
 * Pass `immediate` for a heading in the opening viewport, which swaps the
 * observer for a pure-CSS load animation and does not depend on JS at all.
 */
export default function WordReveal({
  children,
  className = "",
  as: Tag = "div",
  stagger = 45,
  baseDelay = 0,
  amount = 0.25,
  immediate = false,
}: {
  children: string;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  stagger?: number;
  baseDelay?: number;
  amount?: number;
  /**
   * Run the word stagger on LOAD, from CSS, instead of on scroll.
   *
   * 🔴 For the opening viewport only. Every sub-page h1 is a WordReveal, and
   * the words rest at `opacity:0` until the IntersectionObserver adds
   * `.is-visible` — which cannot happen before React hydrates. That made the
   * h1 unpaintable until the JavaScript had landed, on a heading that is on
   * screen from the first frame. See the note in globals.css.
   */
  immediate?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    // Driven by CSS in the immediate case; an observer here would re-drive the
    // same properties through `.is-visible`.
    if (immediate) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add("is-visible");
            io.unobserve(el);
          }
        });
      },
      { threshold: amount, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [amount, immediate]);

  const lines = String(children).split("\n");
  let wi = 0; // running word index across all lines for one continuous stagger

  const Component = Tag as any;
  return (
    <Component
      ref={ref}
      className={`word-reveal ${immediate ? "word-reveal--immediate " : ""}${className}`}
      style={{
        ["--wr-step" as string]: `${stagger}ms`,
        ["--wr-base" as string]: `${baseDelay}ms`,
      }}
    >
      {lines.map((line, li) => (
        <span className="wr-line" key={li}>
          {/* keep the capturing split so inter-word whitespace survives as text */}
          {line.split(/(\s+)/).map((tok, ti) => {
            if (tok === "" || /^\s+$/.test(tok)) return tok;
            const idx = wi++;
            return (
              <span className="wr-word" style={{ ["--wi" as string]: idx }} key={ti}>
                {tok}
              </span>
            );
          })}
        </span>
      ))}
    </Component>
  );
}
