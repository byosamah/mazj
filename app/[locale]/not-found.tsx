import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center gap-6 bg-beige px-6 text-center">
      <p className="font-mono text-12 uppercase tracking-[0.05em] text-muted">404</p>
      <h1 className="font-sans font-medium text-40 text-black lg:text-70">{t("title")}</h1>
      <Link
        href="/"
        className="cta font-sans [--cta-bg:#111111] [--cta-fg:#fff7e9] [--cta-sweep:#fff7e9] [--cta-fg-hover:#4c2806]"
      >
        <span className="cta__label">{t("cta")}</span>
        <span className="cta__sweep" aria-hidden="true" />
      </Link>
    </main>
  );
}
