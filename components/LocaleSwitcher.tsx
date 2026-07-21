"use client";

import {useLocale} from "next-intl";
import {usePathname, useRouter} from "@/i18n/navigation";
import {useTransition} from "react";

/**
 * Toggles between English (/en) and Arabic (/ar) while staying on the same
 * page. Shows the *other* language's own name, the common i18n convention.
 */
export default function LocaleSwitcher({className = ""}: {className?: string}) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const other = locale === "en" ? "ar" : "en";
  const label = locale === "en" ? "العربية" : "English";

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => router.replace(pathname, {locale: other}))}
      aria-label={locale === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
      className={`text-14 text-black inline-flex items-center min-h-[40px] hover:opacity-60 disabled:opacity-40 [transition:opacity_200ms,transform_120ms] active:scale-[0.96] ${className}`}
      lang={other}
    >
      {label}
    </button>
  );
}
