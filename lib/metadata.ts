import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

/**
 * The per-locale share card. Static PNGs committed under `public/og/`, built by
 * `scripts/generate-og-cards.py` (real Chromium, so Arabic shapes and measures
 * correctly -- see that script's header for why `next/og` could not be used).
 *
 * These are the ONLY images the site declares to social platforms. Before this
 * existed, `twitter:card` promised `summary_large_image` with no image behind
 * it, so every WhatsApp / Instagram / LinkedIn share of the site rendered a
 * blank grey rectangle. Relative paths resolve against `metadataBase`.
 *
 * Re-run the script whenever `Meta.title` / `siteName` / `city` changes.
 */
export function ogImage(locale: string) {
  return {
    url: `/og/${locale === "ar" ? "ar" : "en"}.png`,
    width: 1200,
    height: 630,
    alt: locale === "ar" ? "مزج" : "MAZJ",
  };
}

/**
 * Per-page metadata for sub-pages: page-specific title/description plus a
 * per-path canonical + hreflang. The root layout's generateMetadata only
 * knows the locale root, so without this every sub-page canonicalizes to the
 * homepage. `namespace` must provide `title` and `intro`.
 */
export async function pageMetadata(
  locale: string,
  namespace: string,
  path: string,
  opts?: {noindex?: boolean}
): Promise<Metadata> {
  const t = await getTranslations({locale, namespace});
  const meta = await getTranslations({locale, namespace: "Meta"});

  // The SERP title and the on-page headline have OPPOSITE jobs, and deriving
  // one from the other let the design job win every time: the <h1> should be
  // evocative ("The blend is the point"), the <title> must be literal and carry
  // the query someone actually types ("About MAZJ | Coworking in Al-Khobar").
  // `metaTitle` is optional -- when a namespace omits it the display `title`
  // still drives the tag, so adding this key changed nothing on its own.
  // The headline's hand-placed \n line breaks are collapsed either way; they are
  // layout, and a newline in a <title> renders as a stray space in the SERP.
  const headline = t.has("metaTitle") ? t("metaTitle") : t("title");
  const title = `${headline.replace(/\s*\n\s*/g, " ")} | ${meta("siteName")}`;

  // `metaDescription` is optional and works exactly like `metaTitle`: the page
  // `intro` drives the description unless a namespace overrides it. Added
  // 2026-07-28 for `/events`, where the on-page intro and the SERP snippet want
  // different things (the intro sets a scene, the snippet has to carry
  // "Al-Khobar" and a reason to click).
  //
  // ⚠️ It is also the escape hatch for an `intro` that takes ICU arguments.
  // `t("intro")` with no argument does not render a placeholder, it THROWS, and
  // inside `generateMetadata` that takes the whole route down rather than
  // degrading. Any namespace whose `intro` gains a parameter needs this key.
  const description = t.has("metaDescription")
    ? t("metaDescription")
    : t("intro");
  const isAr = locale === "ar";

  return {
    title,
    description,
    // `noindex` keeps a route reachable and crawlable-through while stopping it
    // being listed. Used by /privacy and /terms, which still ship placeholder
    // clauses ("pending legal review", CR number outstanding) — indexing draft
    // legal text is a worse signal than not appearing in results at all.
    // follow:true so the footer links still pass through to real pages.
    ...(opts?.noindex ? {robots: {index: false, follow: true}} : {}),
    alternates: {
      canonical: `/${locale}${path}`,
      languages: {
        en: `/en${path}`,
        ar: `/ar${path}`,
        "x-default": `/en${path}`,
      },
    },
    openGraph: {
      type: "website",
      siteName: meta("siteName"),
      title,
      description,
      url: `/${locale}${path}`,
      locale: isAr ? "ar_SA" : "en_US",
      alternateLocale: isAr ? "en_US" : "ar_SA",
      images: [ogImage(locale)],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage(locale).url],
    },
  };
}
