import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    // id + tabIndex match every other route so the header's skip link has a
    // real target here too (WCAG 2.4.1). tabIndex={-1} is what makes the
    // <main> programmatically focusable when the skip link jumps to it.
    <main
      id="content"
      tabIndex={-1}
      className="flex min-h-svh w-full flex-col items-center justify-center gap-6 bg-beige px-6 text-center"
    >
      <p className="eyebrow text-12 text-muted">404</p>
      <h1 className="text-balance font-sans font-medium text-40 text-black lg:text-70">{t("title")}</h1>
      <Link
        href="/"
        className="cta font-sans [--cta-bg:#111111] [--cta-fg:#fff7e9] [--cta-sweep:#FF5A48] [--cta-fg-hover:#111111]"
      >
        <span className="cta__label">{t("cta")}</span>
        <span className="cta__sweep" aria-hidden="true" />
      </Link>
    </main>
  );
}
