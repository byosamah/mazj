"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * GSAP ScrollTrigger enhancement layer, mirroring the original site's
 * signature motions. Progressive enhancement: elements are fully visible
 * without JS (the CSS reveal system is the base); this upgrades the feel.
 *
 * Data-attribute API:
 *   data-fx="clip"   → media grows from a small rounded rect to full-bleed,
 *                      scrubbed to scroll (the original's inset(..round 1rem)
 *                      → inset(0) reveal).
 *   data-fx="rise"   → block rises + fades in on enter.
 *   data-fx="chips"  → staggered fade/slide for the hero telemetry chips.
 *   data-fx="lazy"   → media fades in once it is BOTH in view and loaded
 *                      (batched, staggered). Put it on the <img> or on a
 *                      wrapper containing one.
 *   data-parallax    → scrubbed vertical drift while the element crosses
 *                      the viewport. Value = depth (default 0.2): the
 *                      element travels depth×its height, symmetric around
 *                      its natural position, so it sits true mid-viewport.
 */
export default function ScrollFX() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    gsap.registerPlugin(ScrollTrigger);
    const rtl = document.documentElement.dir === "rtl";
    const ctx = gsap.context(() => {
      // Pinned cards — the text/media pin while the media clip-reveals across
      // the pinned scroll distance (the original's signature scrollytelling).
      const canPin = window.innerWidth >= 1024;
      if (canPin) {
        gsap.utils.toArray<HTMLElement>('[data-fx="pin-card"]').forEach((card) => {
          const clipMedia = card.querySelector<HTMLElement>("[data-pin-media]");
          const scaleMedia = card.querySelector<HTMLElement>("[data-pin-media-scale]");
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: card,
              start: "top top",
              end: "+=45%",
              pin: true,
              pinSpacing: true,
              scrub: 0.5,
            },
          });
          if (clipMedia) {
            tl.fromTo(
              clipMedia,
              { clipPath: "inset(30% 14% 26% 14% round 16px)" },
              { clipPath: "inset(0% 0% 0% 0% round 4px)", ease: "none" },
              0
            );
          }
          if (scaleMedia) {
            tl.fromTo(
              scaleMedia,
              { scale: 0.86, autoAlpha: 0.5 },
              { scale: 1, autoAlpha: 1, ease: "none" },
              0
            );
          }
        });
      }

      // Pinned scale-reveal articles (the "why mazj" full-screen video
      // statements pin while their content scales/fades up, as in the original).
      if (canPin) {
        gsap.utils.toArray<HTMLElement>('[data-fx="pin-scale"]').forEach((card) => {
          const content = card.querySelector<HTMLElement>("[data-pin-content]");
          const media = card.querySelector<HTMLElement>("video");
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: card,
              start: "top top",
              end: "+=45%",
              pin: true,
              pinSpacing: true,
              scrub: 0.5,
            },
          });
          if (media) tl.fromTo(media, { scale: 1.12 }, { scale: 1, ease: "none" }, 0);
          if (content) tl.fromTo(content, { autoAlpha: 0.35, y: 40 }, { autoAlpha: 1, y: 0, ease: "none" }, 0);
        });
      }

      // Clip-path scrub reveals
      gsap.utils.toArray<HTMLElement>('[data-fx="clip"]').forEach((el) => {
        gsap.fromTo(
          el,
          { clipPath: "inset(34% 12% 28% 12% round 16px)" },
          {
            clipPath: "inset(0% 0% 0% 0% round 2px)",
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top 78%",
              end: "top 22%",
              scrub: 0.6,
            },
          }
        );
      });

      // Rise + fade blocks
      gsap.utils.toArray<HTMLElement>('[data-fx="rise"]').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 40, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 1,
            ease: "expo.out",
            scrollTrigger: { trigger: el, start: "top 82%" },
          }
        );
      });

      // Hero panel — grows in from a clipped rounded rect on mount
      gsap.utils.toArray<HTMLElement>('[data-fx="clip-hero"]').forEach((el) => {
        const final = el.style.clipPath || "inset(0% 0% 0% 0% round 2px)";
        // Mirror the collapsed start-clip for RTL so it grows from the same
        // (mirrored) side as the final panel window.
        const start = rtl
          ? "inset(48% 74% 48% 24% round 6px)"
          : "inset(48% 24% 48% 74% round 6px)";
        gsap.fromTo(
          el,
          { clipPath: start, autoAlpha: 0.35 },
          { clipPath: final, autoAlpha: 1, duration: 1.2, ease: "expo.out", delay: 0.25 }
        );
      });

      // Scrubbed parallax drift (data-parallax="0.2" = 20% depth). Linear
      // ease because scroll drives it; runs across the element's full
      // viewport transit so the drift is symmetric around rest.
      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
        const depth = parseFloat(el.dataset.parallax || "") || 0.2;
        gsap.fromTo(
          el,
          { yPercent: depth * 50 },
          {
            yPercent: -depth * 50,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
              invalidateOnRefresh: true,
            },
          }
        );
      });

      // Lazy media fade-ins: hidden until in view AND decoded, then a
      // quiet opacity-only fade (safe for photography; no motion vector).
      const lazies = gsap.utils.toArray<HTMLElement>('[data-fx="lazy"]');
      if (lazies.length) {
        gsap.set(lazies, { autoAlpha: 0 });
        ScrollTrigger.batch(lazies, {
          start: "top 92%",
          once: true,
          onEnter: (batch) => {
            batch.forEach((el, i) => {
              const img =
                el instanceof HTMLImageElement ? el : el.querySelector("img");
              const show = () =>
                gsap.to(el, {
                  autoAlpha: 1,
                  duration: 0.7,
                  ease: "power2.out",
                  delay: i * 0.08,
                });
              if (img && !img.complete) {
                // Reveal on load; on error too, so a broken image never
                // leaves an invisible hole in the layout.
                img.addEventListener("load", show, { once: true });
                img.addEventListener("error", show, { once: true });
              } else {
                show();
              }
            });
          },
        });
      }

      // Hero telemetry chips — staggered entrance
      const chips = gsap.utils.toArray<HTMLElement>('[data-fx="chip"]');
      if (chips.length) {
        gsap.fromTo(
          chips,
          { y: 16, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.9, ease: "expo.out", stagger: 0.12, delay: 0.7 }
        );
      }
    });

    return () => ctx.revert();
  }, []);

  return null;
}
