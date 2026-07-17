import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {NextIntlClientProvider, hasLocale} from "next-intl";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {routing} from "@/i18n/routing";
import "../globals.css";
import Navigation from "@/components/Navigation";
import ScrollFX from "@/components/ScrollFX";
import SmoothScroll from "@/components/motion/SmoothScroll";

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
  // The mazj.example fallback is an intentional placeholder so nothing ships a fake canonical.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mazj.example";

  return {
    metadataBase: new URL(siteUrl),
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

  return (
    <html lang={locale} dir={dir}>
      <body className="bg-beige font-sans text-black antialiased">
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
