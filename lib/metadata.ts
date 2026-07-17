import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";

/**
 * Per-page metadata for sub-pages: page-specific title/description plus a
 * per-path canonical + hreflang. The root layout's generateMetadata only
 * knows the locale root, so without this every sub-page canonicalizes to the
 * homepage. `namespace` must provide `title` and `intro`.
 */
export async function pageMetadata(
  locale: string,
  namespace: string,
  path: string
): Promise<Metadata> {
  const t = await getTranslations({locale, namespace});
  const meta = await getTranslations({locale, namespace: "Meta"});

  const title = `${t("title").replace(/\s*\n\s*/g, " ")} | ${meta("siteName")}`;
  const description = t("intro");
  const isAr = locale === "ar";

  return {
    title,
    description,
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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
