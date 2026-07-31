import { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";

type Variant = "dark" | "light" | "onLavender" | "onTan";

/**
 * The signature MAZJ CTA. A rounded rectangle sweeps straight up from below
 * while the label lifts and changes colour. Colours per context are driven by
 * CSS custom properties consumed in globals.css (`.cta`).
 *
 * 🔴 THE ONE RULE EVERY VARIANT HERE OBEYS: **THE BUTTON MUST STILL LOOK LIKE A
 * BUTTON IN BOTH STATES.** Owner ruling 2026-07-31, after the hover states were
 * measured and three of the four failed it outright.
 *
 * What was wrong, in numbers, and it was not a matter of taste. A button's
 * SILHOUETTE is its fill against the surface behind it, and these swept to the
 * exact colour of that surface:
 *
 *   | variant     | rest silhouette | hover silhouette (before) |
 *   |-------------|-----------------|---------------------------|
 *   | dark        | 17.74:1         | **1.00:1** on cream       |
 *   | onTan       | 15.12:1         | **1.17:1** on tan         |
 *   | onLavender  |  7.39:1         | **1.89:1** on lavender    |
 *
 * `dark` swept to `#fff7e9`, which IS the page. So hovering the primary CTA did
 * not recolour it, it DELETED it: the fill matched the background exactly and
 * the reader was left with brown text floating on cream. That is the defect the
 * owner reported, and it had shipped on 14 of the 21 CTAs on the site.
 *
 * The replacement rule, which any new variant must clear:
 *   - silhouette ≥ 2:1 in BOTH states
 *   - label ≥ 4.5:1 (AA) in BOTH states
 *
 * 🔴 `--cta-sweep` MAY NEVER BE THE COLOUR OF THE SURFACE THE BUTTON SITS ON.
 * That single mistake is the whole bug, and it is easy to make again because the
 * inversion reads as elegant in the abstract.
 */
const VARIANTS: Record<Variant, CSSProperties> = {
  /**
   * The primary CTA on cream. Ink at rest, CORAL on hover: hovering makes it
   * more alive rather than erasing it, and coral is already the site's
   * primary-action colour (the header button). Measured: silhouette
   * 17.74 → 2.90:1, label 17.74 → 6.12:1.
   *
   * ⚠️ The hover label is INK, not cream. Cream on coral is 2.90:1 and fails
   * AA; ink on coral is 6.12:1 and passes. The coral itself is untouched at
   * full `#FF5A48`, per the standing ruling that it is never darkened.
   */
  dark: {
    ["--cta-bg" as any]: "#111111",
    ["--cta-fg" as any]: "#fff7e9",
    ["--cta-sweep" as any]: "#FF5A48",
    ["--cta-fg-hover" as any]: "#111111",
  },
  /**
   * The ghost. UNCHANGED, and it is the one variant that was always right:
   * outline at rest, fills ink on hover, so it GAINS weight (silhouette
   * 17.74:1, label 17.74:1). It also sets the hierarchy against `dark` above:
   * a ghost promotes to solid ink, a solid activates to coral.
   */
  light: {
    ["--cta-bg" as any]: "transparent",
    ["--cta-border" as any]: "1px solid rgba(17,17,17,0.25)",
    ["--cta-fg" as any]: "#111111",
    ["--cta-sweep" as any]: "#111111",
    ["--cta-fg-hover" as any]: "#fff7e9",
  },
  /**
   * Inside a lavender band. Indigo at rest, deepening to INK on hover.
   *
   * 🔴 NOT CORAL, AND THAT IS MEASURED RATHER THAN A STYLE OPINION: coral on
   * lavender is **1.63:1**, which is WORSE than the 1.89:1 white sweep it would
   * have replaced, so the one variant where the obvious fix looks consistent is
   * the one where it makes the bug worse. Ink gives 9.99:1 with a 17.74:1
   * label. It also keeps DESIGN.md's rule that the button fill inside a
   * lavender band is the indigo family, not the accent.
   */
  onLavender: {
    ["--cta-bg" as any]: "#321f61",
    ["--cta-fg" as any]: "#ffffff",
    ["--cta-sweep" as any]: "#111111",
    ["--cta-fg-hover" as any]: "#fff7e9",
  },
  /** Solid on a tan card. Same treatment as `dark`; silhouette 15.12 → 2.47:1. */
  onTan: {
    ["--cta-bg" as any]: "#111111",
    ["--cta-fg" as any]: "#fff7e9",
    ["--cta-sweep" as any]: "#FF5A48",
    ["--cta-fg-hover" as any]: "#111111",
  },
};

export default function CtaButton({
  children,
  href = "#",
  variant = "dark",
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  variant?: Variant;
  className?: string;
}) {
  const label = (
    <>
      <span className="cta__label">{children}</span>
      <span className="cta__sweep" aria-hidden="true" />
    </>
  );
  // External URLs (mazj.sa, socials) open in a new tab; internal routes go
  // through the locale-aware Link so the /en or /ar prefix is preserved.
  if (/^https?:\/\//.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`cta font-sans ${className}`}
        style={VARIANTS[variant]}
      >
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={`cta font-sans ${className}`} style={VARIANTS[variant]}>
      {label}
    </Link>
  );
}
