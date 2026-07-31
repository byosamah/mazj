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

  /**
   * next-intl's `usePathname` returns the locale-stripped PATH ONLY: no search,
   * no hash. Replacing with it alone silently destroyed both, so a visitor who
   * arrived on /en/spaces?utm_source=... and switched language landed on
   * /ar/spaces with the campaign attribution gone (the conversion then counts
   * as direct traffic), and any /en/faq#section deep link lost its anchor.
   *
   * `window.location` is the simplest correct source here because this handler
   * is already client-side; `useSearchParams` would force a Suspense boundary
   * onto every route that renders the switcher, which is all of them.
   */
  function switchLocale() {
    const {search, hash} = window.location;
    startTransition(() => router.replace(`${pathname}${search}${hash}`, {locale: other}));
  }

  // Touch target: the label alone measures ~36x40 in English, under the 44px
  // guideline on both axes. `min-h-[44px]` lifts the height to the site's 44px
  // convention, and the `before:` pseudo-element widens the hit box outward
  // without moving the label or the nav items beside it.
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={switchLocale}
      aria-label={locale === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
      className={`text-14 text-black relative inline-flex items-center min-h-[44px] before:absolute before:inset-y-0 before:inset-x-[-4px] before:content-[''] underline decoration-transparent underline-offset-[6px] hover:decoration-black disabled:opacity-40 [transition:text-decoration-color_200ms,opacity_200ms,transform_120ms] active:scale-[0.96] ${className}`}
      lang={other}
    >
      {label}
    </button>
  );
}
