import { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";

type Variant = "dark" | "light" | "onLavender" | "onTan";

/**
 * The signature MAZJ CTA. A rounded rectangle sweeps up from below with a
 * slight rotation while the label lifts and changes colour. Colours per
 * context are driven by CSS custom properties consumed in globals.css (.cta).
 */
const VARIANTS: Record<Variant, CSSProperties> = {
  // dark base, cream sweep, label cream -> brown (used on light/tan)
  dark: {
    ["--cta-bg" as any]: "#111111",
    ["--cta-fg" as any]: "#fff7e9",
    ["--cta-sweep" as any]: "#fff7e9",
    ["--cta-fg-hover" as any]: "#4c2806",
  },
  // transparent base w/ border, dark sweep, label dark -> cream (on light)
  light: {
    ["--cta-bg" as any]: "transparent",
    ["--cta-border" as any]: "1px solid rgba(17,17,17,0.25)",
    ["--cta-fg" as any]: "#111111",
    ["--cta-sweep" as any]: "#111111",
    ["--cta-fg-hover" as any]: "#fff7e9",
  },
  // dark base on lavender, white sweep, label white -> purple-dark
  onLavender: {
    ["--cta-bg" as any]: "#321f61",
    ["--cta-fg" as any]: "#ffffff",
    ["--cta-sweep" as any]: "#ffffff",
    ["--cta-fg-hover" as any]: "#321f61",
  },
  // dark base on tan card, cream sweep, label cream -> brown
  onTan: {
    ["--cta-bg" as any]: "#111111",
    ["--cta-fg" as any]: "#fff7e9",
    ["--cta-sweep" as any]: "#fff7e9",
    ["--cta-fg-hover" as any]: "#4c2806",
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
