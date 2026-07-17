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
 * No-JS / reduced-motion safe: the CSS leaves words visible by default and the
 * reduced-motion block in globals.css neutralises the per-word transform, so
 * nothing depends on JS to render the text.
 */
export default function WordReveal({
  children,
  className = "",
  as: Tag = "div",
  stagger = 45,
  baseDelay = 0,
  amount = 0.25,
}: {
  children: string;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  stagger?: number;
  baseDelay?: number;
  amount?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
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
  }, [amount]);

  const lines = String(children).split("\n");
  let wi = 0; // running word index across all lines for one continuous stagger

  const Component = Tag as any;
  return (
    <Component
      ref={ref}
      className={`word-reveal ${className}`}
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
