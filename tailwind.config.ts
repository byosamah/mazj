import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

/**
 * Enter/exit motion for the admin's overlay components, and NOTHING else.
 *
 * 🔴 THIS REPLACES `tailwindcss-animate`, DELIBERATELY. DO NOT SWAP IT BACK.
 *
 * The shadcn overlays (today `select`; tomorrow any popover, dropdown or dialog
 * added with `npx shadcn add`) style their transitions with ten utilities:
 * animate-in / animate-out, fade-in-0 / fade-out-0, zoom-in-95 / zoom-out-95
 * and slide-in-from-{top,bottom,left,right}-2. The conventional way to supply
 * them is the `tailwindcss-animate` plugin, and it was tried here first.
 *
 * It is not safe in THIS repo, because there is only one Tailwind build and the
 * marketing site shares it. That plugin also registers `duration-*`, `delay-*`
 * and `ease-*` as ANIMATION utilities, under the exact names Tailwind already
 * uses for TRANSITION utilities. Compiling the marketing content against it and
 * diffing showed the collision directly:
 *
 *     .ease-expo-out { transition-timing-function: cubic-bezier(...) }   ← was
 *     .ease-expo-out { animation-timing-function: cubic-bezier(...) }   ← added
 *     .duration-200  { transition-duration: 200ms }                     ← was
 *     .duration-200  { animation-duration: 200ms }                      ← added
 *
 * Both declarations survive, so nothing is broken TODAY: all seven marketing
 * uses of `duration-*`/`ease-*` sit on elements with `transition-*` and no
 * keyframe animation, and every marketing animation (intro-line, sf-panel,
 * spectrumDrift, grainShift) lives on its own class in globals.css. But it
 * means that from then on, any element given BOTH a `duration-*` utility and a
 * CSS animation silently has its animation retimed — a bug with no error, no
 * failing test, and a cause three layers away from its symptom.
 *
 * Ten utilities are needed and ten are provided. Nothing here shares a name
 * with an existing Tailwind utility, so the collision cannot occur.
 *
 * The timing is MAZJ's, not the plugin's: 200ms on `--ease-expo`, which is
 * DESIGN.md's documented pairing for interface motion of this size, rather than
 * the library default of 150ms on `ease-out`.
 */
const adminOverlayMotion = plugin(({ addBase, addUtilities }) => {
  // Keyframes read the --tw-enter-*/--tw-exit-* custom properties that the
  // fade/zoom/slide utilities below set, which is what lets them compose:
  // `zoom-in-95 slide-in-from-top-2` is one animation driven by two variables,
  // not two animations fighting over `transform`.
  addBase({
    "@keyframes admin-enter": {
      from: {
        opacity: "var(--tw-enter-opacity, 1)",
        transform:
          "translate3d(var(--tw-enter-translate-x, 0), var(--tw-enter-translate-y, 0), 0) scale3d(var(--tw-enter-scale, 1), var(--tw-enter-scale, 1), 1)",
      },
    },
    "@keyframes admin-exit": {
      to: {
        opacity: "var(--tw-exit-opacity, 1)",
        transform:
          "translate3d(var(--tw-exit-translate-x, 0), var(--tw-exit-translate-y, 0), 0) scale3d(var(--tw-exit-scale, 1), var(--tw-exit-scale, 1), 1)",
      },
    },
  });

  const base = {
    animationDuration: "200ms",
    animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", // --ease-expo
    animationFillMode: "both",
  };

  addUtilities({
    ".animate-in": { ...base, animationName: "admin-enter" },
    ".animate-out": { ...base, animationName: "admin-exit" },
    ".fade-in-0": { "--tw-enter-opacity": "0" },
    ".fade-out-0": { "--tw-exit-opacity": "0" },
    ".zoom-in-95": { "--tw-enter-scale": "0.95" },
    ".zoom-out-95": { "--tw-exit-scale": "0.95" },
    ".slide-in-from-top-2": { "--tw-enter-translate-y": "-0.5rem" },
    ".slide-in-from-bottom-2": { "--tw-enter-translate-y": "0.5rem" },
    ".slide-in-from-left-2": { "--tw-enter-translate-x": "-0.5rem" },
    ".slide-in-from-right-2": { "--tw-enter-translate-x": "0.5rem" },
  });
});

/**
 * MAZJ design tokens.
 * Palette, typography scale and easings for the site.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // 🔴 PINNED TO "class", and it must stay pinned even though nothing here
  // toggles a theme. Tailwind 3's default is "media", which means a bare
  // `dark:` utility fires on the reader's OPERATING SYSTEM preference. The
  // shadcn primitives under `components/ui/` ship dozens of them, so an
  // unpinned config would repaint /admin for any member of staff whose Mac is
  // in dark mode, in colours nobody designed and nobody could reproduce.
  // `scripts/vendor-shadcn.py` also strips those classes on the way in, so this
  // is the second of two locks; keep both, because the next `shadcn add` will
  // reintroduce them and only this one is automatic.
  //
  // Safe to add: the marketing site contains ZERO `dark:` utilities (verified
  // 2026-07-29 — the single grep hit is a `dark:` object key in CtaButton.tsx).
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        beige: "#fff7e9",        // page background + light text (Daylight beige)
        "beige-1": "#f7eed9",    // Daylight beige 1.0 — warmer surface tier
        "beige-card": "#f0e5cf", // tan process-card background (Daylight beige 2.0)
        "dark-beige": "#dacab6", // Daylight dark beige
        brown: "#4c2806",        // headings on tan
        black: "#111111",        // primary text (near-black, not pure)
        purple: "#c8b0ff",       // lavender CTA background (Daylight light purple)
        "purple-dark": "#321f61",// deep indigo accent
        orange: "#FF5A48",       // brand coral — MAZJ-owned, kept (NOT Daylight #F66F00)
        // Body/label grey. Was #a09b93 (the Daylight brand BOOK's "Grey"), which
        // measured 2.59:1 on bg-beige — failing WCAG AA for body (4.5) and even
        // for large text (3.0), across 41 usages including the legal routes.
        // #514E4A is what Daylight actually ships as text grey in production and
        // measures 7.77:1 on beige / 6.62:1 on the tan card. Never used on a dark
        // surface anywhere in the codebase, so darkening it carries no regression.
        muted: "#514E4A",

        // ────────────────────────────────────────────────────────────────
        // /admin ONLY. Added 2026-07-29 with the shadcn primitives.
        // ────────────────────────────────────────────────────────────────
        // The values are NOT here. Every one resolves through a CSS custom
        // property defined in `app/admin/admin.css`, which is imported by
        // `app/admin/layout.tsx` and by nothing else. Since the admin is a
        // SECOND root layout, that stylesheet never reaches the marketing
        // document, so these utilities are inert everywhere except /admin.
        //
        // ⚠️ The corollary, and the one trap here: using `bg-primary` or any
        // other token below on a marketing page produces an invalid
        // declaration that the browser drops, so the element keeps whatever it
        // inherited and NOTHING VISIBLY BREAKS. It fails silently. Marketing
        // components use the literal MAZJ tokens above (beige, orange, muted…);
        // these exist so the vendored shadcn components compile unmodified and
        // so `npx shadcn add` keeps working.
        //
        // The `rgb(… / <alpha-value>)` form, rather than a plain `var()`, is
        // what makes opacity modifiers work: the shadcn components lean on
        // `bg-primary/90`, `ring-ring/50` and `border-destructive/20`
        // throughout, and a bare `var(--x)` silently ignores the `/n`.
        //
        // 🔴 Deliberately ABSENT: shadcn's standard `borderRadius` override
        // (`lg: "var(--radius)"`). It would repaint the 59 places the
        // marketing site already uses rounded-sm/md/lg/xl, and break them
        // outright because `--radius` is undefined there. Nothing is lost:
        // Tailwind 3.4's default radius ladder (2/4/6/8/12/16px) already
        // matches DESIGN.md's xs→2xl exactly.
        //
        // 🔴 `muted` is TAKEN (above, #514E4A, 69 uses on the public site), so
        // shadcn's `muted`/`muted-foreground` pair is vendored in as
        // `subtle`/`subtle-foreground`. See `scripts/vendor-shadcn.py`.
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        "card-foreground": "rgb(var(--card-foreground) / <alpha-value>)",
        popover: "rgb(var(--popover) / <alpha-value>)",
        "popover-foreground": "rgb(var(--popover-foreground) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        "primary-foreground": "rgb(var(--primary-foreground) / <alpha-value>)",
        secondary: "rgb(var(--secondary) / <alpha-value>)",
        "secondary-foreground": "rgb(var(--secondary-foreground) / <alpha-value>)",
        subtle: "rgb(var(--subtle) / <alpha-value>)",
        "subtle-foreground": "rgb(var(--subtle-foreground) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-foreground": "rgb(var(--accent-foreground) / <alpha-value>)",
        destructive: "rgb(var(--destructive) / <alpha-value>)",
        "destructive-foreground": "rgb(var(--destructive-foreground) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",

        // The admin-only STATUS palette, per the owner's 2026-07-29 ruling.
        // DESIGN.md forbids status hues on the marketing surface and says a new
        // surface must introduce them deliberately rather than borrow from the
        // brand palette. This is that deliberate introduction, and it is the
        // change that lets the coral go back to meaning exactly one thing.
        // Values, and the reasoning behind each hue, live in admin.css.
        ok: "rgb(var(--ok) / <alpha-value>)",
        "ok-foreground": "rgb(var(--ok-foreground) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        "warn-foreground": "rgb(var(--warn-foreground) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "8": "8px", "9": "9px", "10": "10px", "11": "11px", "12": "12px",
        "13": "13px", "14": "14px", "15": "15px", "16": "16px", "18": "18px",
        "20": "20px", "24": "24px", "28": "28px", "32": "32px", "36": "36px",
        "40": "40px", "45": "45px", "50": "50px", "70": "70px", "85": "85px",
      },
      transitionTimingFunction: {
        "expo-out": "cubic-bezier(0.16, 1, 0.3, 1)",
        "quart-out": "cubic-bezier(0.25, 1, 0.5, 1)",
        premium: "cubic-bezier(0.16, 1.08, 0.38, 0.98)",
      },
      zIndex: {
        "1": "1", "2": "2", "3": "3", "4": "4", "100": "100",
      },
      // 🔴 Tailwind 3 ships a FIXED list of aria-* variants (busy, checked,
      // disabled, expanded, hidden, pressed, readonly, required, selected) and
      // `invalid` is not on it. Every shadcn form control styles its error state
      // with `aria-invalid:border-destructive`, so without this line the class
      // compiles to nothing and an invalid field on the events form looks
      // exactly like a valid one — the failure is invisible precisely when it
      // matters. Verified by compiling components/ui against this config:
      // 0 occurrences of `aria-invalid` in the output before, present after.
      //
      // Extends rather than replaces, so the nine built-in aria variants
      // survive. Nothing on the marketing site uses any of them.
      aria: {
        invalid: 'invalid="true"',
      },
    },
  },
  plugins: [adminOverlayMotion],
};
export default config;
