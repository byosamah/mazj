import type { Config } from "tailwindcss";

/**
 * MAZJ design tokens.
 * Palette, typography scale and easings for the site.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
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
    },
  },
  plugins: [],
};
export default config;
