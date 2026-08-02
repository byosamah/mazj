"use client";

import {useLocale} from "next-intl";
import {Link, usePathname, useRouter} from "@/i18n/navigation";
import {useTransition} from "react";

/**
 * Toggles between English (/en) and Arabic (/ar) while staying on the same
 * page. Shows the *other* language's own name, the common i18n convention.
 *
 * 🔴 IT MUST RENDER A REAL `<a href>`, AND IT SHIPPED AS A `<button>` UNTIL
 * 2026-08-02. That is not a styling detail: this is the ONLY control anywhere
 * on the site that crosses between the English and Arabic page sets, and a
 * button carries no href, so a crawler following links found **zero** edges
 * between the two clusters. Measured on the 26 rendered production pages:
 * 0 cross-locale anchors out of 616 internal anchors, 52 switcher buttons, and
 * a breadth-first walk from either homepage reached 13 of 26 pages.
 *
 * ⚠️ Discovery was never the risk, which is why this is a real defect rather
 * than an emergency: sitemap.xml declares all 22 indexable URLs with their full
 * hreflang clusters, so both halves get FOUND. What a button costs is the link
 * equity that would otherwise flow between them, on a site whose Arabic half
 * holds every ranking it has.
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
   *
   * 🔴 So the handler still exists, and it now PREEMPTS the href rather than
   * replacing it. The plain href (search-less, hash-less) is the no-JS and
   * crawler path; this restores the query string for a real visitor. Removing
   * the `preventDefault` would let both fire.
   */
  function switchLocale(event: React.MouseEvent<HTMLAnchorElement>) {
    // Let the browser handle modified clicks (new tab, new window, download)
    // exactly as it would for any other link. Swallowing them is the classic
    // way a JS-intercepted anchor stops behaving like one.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const {search, hash} = window.location;
    startTransition(() => router.replace(`${pathname}${search}${hash}`, {locale: other}));
  }

  // Touch target: the label alone measures ~36x40 in English, under the 44px
  // guideline on both axes. `min-h-[44px]` lifts the height to the site's 44px
  // convention, and the `before:` pseudo-element widens the hit box outward
  // without moving the label or the nav items beside it.
  //
  // 🔴 NO `aria-label`. It used to read "Switch to Arabic" / "التبديل إلى
  // الإنجليزية", which fails WCAG 2.5.3 Label in Name: the accessible name has
  // to CONTAIN the visible label, and on the 13 Arabic routes the visible label
  // is "English" while the name was entirely Arabic, so speech-input users
  // could not say what they could see. The language's own name, marked with
  // `lang` and `hrefLang`, is the conventional accessible switcher and is now
  // the accessible name itself.
  return (
    <Link
      href={pathname}
      locale={other}
      onClick={switchLocale}
      hrefLang={other}
      rel="alternate"
      aria-disabled={isPending || undefined}
      className={`text-14 text-black relative inline-flex items-center min-h-[44px] before:absolute before:inset-y-0 before:inset-x-[-4px] before:content-[''] underline decoration-transparent underline-offset-[6px] hover:decoration-black [transition:text-decoration-color_200ms,opacity_200ms,transform_120ms] active:scale-[0.96] ${isPending ? "opacity-40" : ""} ${className}`}
      lang={other}
    >
      {label}
    </Link>
  );
}
