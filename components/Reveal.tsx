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
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: keyof React.JSX.IntrinsicElements;
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

  const Component = Tag as any;
  return (
    <Component
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Component>
  );
}
