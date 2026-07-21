import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {NextIntlClientProvider, hasLocale} from "next-intl";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {routing} from "@/i18n/routing";
import "../globals.css";
import Navigation from "@/components/Navigation";
import ScrollFX from "@/components/ScrollFX";
import SmoothScroll from "@/components/motion/SmoothScroll";
import JsonLd from "@/components/JsonLd";
import {localBusinessSchema} from "@/lib/schema";
import {SITE_URL} from "@/lib/site";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});

  const title = t("title");
  const description = t("description");
  const siteName = t("siteName");
  const isAr = locale === "ar";
  const path = `/${locale}`;

  // TODO(launch): set NEXT_PUBLIC_SITE_URL to the real production domain.
  // The mazj.example fallback is an intentional placeholder so nothing ships a
  // fake canonical; `lib/site.ts` hard-fails a real production deploy that
  // still has it. Same value feeds the sitemap, robots.txt and JSON-LD.
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    applicationName: siteName,
    alternates: {
      // Per-locale canonical + hreflang so Google serves the right language.
      canonical: path,
      languages: {
        en: "/en",
        ar: "/ar",
        "x-default": "/en",
      },
    },
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url: path,
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

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Enables static rendering for this locale.
  setRequestLocale(locale);

  const dir = locale === "ar" ? "rtl" : "ltr";

  // Sitewide LocalBusiness node. MAZJ is a single physical location, so this is
  // the strongest local-search signal available and it belongs on every page,
  // not just /contact. Facts come from lib/contact.ts + lib/links.ts; the
  // human-readable strings come from i18n so each locale describes itself.
  const meta = await getTranslations({locale, namespace: "Meta"});
  const location = await getTranslations({locale, namespace: "Location"});
  const business = localBusinessSchema({
    locale,
    name: meta("siteName"),
    description: meta("description"),
    streetAddress: location("address"),
  });

  return (
    <html lang={locale} dir={dir}>
      <body className="bg-beige font-sans text-black antialiased">
        <JsonLd data={business} />
        <NextIntlClientProvider>
          <Navigation />
          {children}
          {/* Lenis smooth-scroll base (drives ScrollTrigger; skipped under reduced motion) */}
          <SmoothScroll />
          {/* GSAP scroll-motion enhancement layer (clip reveals, chip stagger, parallax, lazy fades) */}
          <ScrollFX />
          {/* Animated film-grain field over the whole page (matches original) */}
          <div className="grain-overlay" aria-hidden="true" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
