"use client";

import {useEffect, useRef} from "react";
import gsap from "gsap";
import {MARK} from "./logo-mark";

/**
 * The مزج mark writes itself in a loop inside the hero media square:
 * write (strokes draw via dash-offset, dots pop) -> hold -> unwrite -> rest.
 * `dismissed` flips true when a space is picked; the layer then fades out
 * for good and the photo crossfade owns the square.
 * Reduced motion renders the mark fully drawn with no timeline.
 * The layer starts opacity-0 so pre-hydration paint shows only the coral video.
 */
export default function LogoLoop({dismissed}: {dismissed: boolean}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const ioRef = useRef<IntersectionObserver | null>(null);
  const killedRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || killedRef.current) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(root, {autoAlpha: 1});
      return;
    }

    const strokes = Array.from(root.querySelectorAll<SVGPathElement>("[data-stroke]"));
    const dots = Array.from(root.querySelectorAll<SVGCircleElement>("[data-dot]"));
    // +1 over the true length so float rounding never leaks a seam of ink.
    const lens = strokes.map((p) => p.getTotalLength() + 1);
    strokes.forEach((p, i) => gsap.set(p, {strokeDasharray: lens[i], strokeDashoffset: lens[i]}));
    gsap.set(dots, {scale: 0, transformOrigin: "50% 50%"});
    gsap.set(root, {autoAlpha: 1});

    // write ~2.3s -> hold 2.5s -> unwrite ~1.6s -> rest 0.7s (repeatDelay)
    const tl = gsap.timeline({repeat: -1, delay: 0.9, repeatDelay: 0.7, paused: true});
    tl.to(strokes[0], {strokeDashoffset: 0, duration: 0.75, ease: "power2.inOut"})
      .to(strokes[1], {strokeDashoffset: 0, duration: 0.6, ease: "power2.inOut"}, "-=0.15")
      .to(dots[0], {scale: 1, duration: 0.35, ease: "back.out(2)"}, "-=0.1")
      .to(strokes[2], {strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut"}, "-=0.2")
      .to(dots[1], {scale: 1, duration: 0.35, ease: "back.out(2)"}, "-=0.1")
      .to(dots, {scale: 0, duration: 0.25, ease: "back.in(2)", stagger: 0.08}, "+=2.5")
      .to(strokes[2], {strokeDashoffset: lens[2], duration: 0.45, ease: "power2.in"}, "<0.15")
      .to(strokes[1], {strokeDashoffset: lens[1], duration: 0.4, ease: "power2.in"}, "-=0.1")
      .to(strokes[0], {strokeDashoffset: lens[0], duration: 0.5, ease: "power2.in"}, "-=0.1");
    tlRef.current = tl;

    // Run only while the hero square is on screen.
    const io = new IntersectionObserver(([entry]) => {
      if (killedRef.current) return;
      if (entry.isIntersecting) tl.play();
      else tl.pause();
    });
    io.observe(root);
    ioRef.current = io;

    return () => {
      io.disconnect();
      tl.kill();
      gsap.killTweensOf(root);
    };
  }, []);

  useEffect(() => {
    if (!dismissed || killedRef.current) return;
    killedRef.current = true;
    tlRef.current?.kill();
    ioRef.current?.disconnect();
    gsap.to(rootRef.current, {autoAlpha: 0, duration: 0.4, ease: "power2.out"});
  }, [dismissed]);

  return (
    <div
      ref={rootRef}
      data-logo-loop
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 grid place-items-center opacity-0"
    >
      <svg className="w-[55%]" viewBox={MARK.viewBox} fill="none">
        {MARK.strokes.map((s) => (
          <path key={s.id} data-stroke d={s.d} stroke="#FFF7E9" strokeWidth={MARK.strokeWidth} strokeLinecap="butt" />
        ))}
        {MARK.dots.map((d) => (
          <circle key={d.id} data-dot cx={d.cx} cy={d.cy} r={d.r} fill="#FFF7E9" />
        ))}
      </svg>
    </div>
  );
}
