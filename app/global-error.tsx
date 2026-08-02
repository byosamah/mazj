"use client";

import {useEffect} from "react";

/**
 * Last-resort error boundary.
 *
 * This one only fires when `app/[locale]/layout.tsx` itself failed, which is
 * also the ONLY root layout in this repo. So by the time this renders, nothing
 * the rest of the site depends on can be assumed to exist:
 *
 *  - No `NextIntlClientProvider`, so `useTranslations` would throw. There is no
 *    locale context and no messages to read, which is exactly why this file is
 *    deliberately ENGLISH-ONLY and hardcodes its copy. That is correct here and
 *    is NOT a violation of the site's i18n rule: the alternative is a boundary
 *    that throws inside the boundary and shows the browser's blank page.
 *  - No `<html>` / `<body>`, because global-error REPLACES the root layout.
 *    Rendering them here is required, not optional.
 *  - No guaranteed stylesheet, since `globals.css` is imported by the layout
 *    that just died. Hence inline styles and system fonts only: no Tailwind
 *    class, no `.cta`, no Thmanyah. Everything here must be self-contained.
 *
 * `lang="en"` for the same reason the copy is English: the locale is unknown
 * at this point, and claiming the wrong one would mislead a screen reader.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & {digest?: string};
  reset: () => void;
}) {
  useEffect(() => {
    // In production the real stack is stripped from the client bundle, so the
    // digest is the only thing that can be matched against server logs.
    console.error("[mazj] global error", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "24px",
          padding: "24px",
          textAlign: "center",
          backgroundColor: "#fff7e9",
          color: "#111111",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          // This route replaces the whole document and imports no stylesheet,
          // so it never inherits the smoothing globals.css sets on `html` and
          // the same copy renders heavier here than on every other route.
          // Restated inline for the same reason the fonts and colours are.
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            fontWeight: 500,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#514E4A",
          }}
        >
          Error
        </p>
        <h1 style={{margin: 0, fontSize: "40px", fontWeight: 700, lineHeight: 1.1, textWrap: "balance"}}>
          Something went wrong
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: "46ch",
            fontSize: "16px",
            lineHeight: 1.5,
            color: "#4c2806",
            textWrap: "pretty",
          }}
        >
          The page could not be loaded. Try again, or head back to the homepage.
        </p>
        {error.digest ? (
          <p style={{margin: 0, fontSize: "12px", color: "#514E4A"}}>Reference: {error.digest}</p>
        ) : null}

        <div style={{display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center"}}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              minHeight: "44px",
              padding: "12px 24px",
              border: "none",
              borderRadius: "6px",
              backgroundColor: "#111111",
              color: "#fff7e9",
              fontSize: "15px",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {/* Plain anchor, not next/link: the router may be part of what
              failed, and `/` redirects to the default locale anyway.
              A full document load is the POINT here: global-error replaces the
              root layout, so client-side navigation would depend on the very
              runtime that just crashed. next/link is the wrong tool at this
              one call site, hence the suppression rather than a code change. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "44px",
              padding: "12px 24px",
              borderRadius: "6px",
              border: "1px solid rgba(17,17,17,0.25)",
              color: "#111111",
              fontSize: "15px",
              textDecoration: "none",
            }}
          >
            Back home
          </a>
        </div>
      </body>
    </html>
  );
}
