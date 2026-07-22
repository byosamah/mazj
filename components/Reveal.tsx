"use client";

import { useEffect, useRef, ReactNode } from "react";

/**
 * Scroll-reveal wrapper. Adds `.is-visible` when the element enters the
 * viewport (once). Works with the `.reveal` and `.line-mask` CSS in
 * globals.css. `delay` staggers grouped reveals.
 */
export default function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
  amount = 0.2,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: keyof React.JSX.IntrinsicElements;
  amount?: number;
  /**
   * Anything else is forwarded to the rendered element. Needed so callers can
   * attach ScrollFX hooks (`data-fx="clip"`, `data-parallax`) to a revealed
   * block — without this they were accepted by TS and then silently dropped,
   * so the effect never fired.
   */
  [key: string]: unknown;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 🔴 The threshold must stay REACHABLE. An element taller than the viewport
    // can never hit `amount` visibility: its max intersection ratio is
    // viewportHeight / elementHeight. The /events 2023 archive list (29 rows,
    // 3278px) capped out at ratio 0.16 in a 568px phone viewport, so the 0.2
    // default never fired and 70% of the archive scrolled by as permanently
    // invisible opacity-0 rows. Capping at half a viewport's worth of the
    // element reveals tall blocks once they meaningfully enter while leaving
    // every viewport-sized-or-smaller element on the original behaviour.
    const reachable = (window.innerHeight * 0.5) / Math.max(el.offsetHeight, 1);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add("is-visible");
            io.unobserve(el);
          }
        });
      },
      { threshold: Math.min(amount, reachable), rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [amount]);

  const Component = Tag as any;
  return (
    <Component
      {...rest}
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Component>
  );
}
