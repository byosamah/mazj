import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {NextIntlClientProvider, hasLocale} from "next-intl";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {routing} from "@/i18n/routing";
import "../globals.css";
import Navigation from "@/components/Navigation";
import ScrollFX from "@/components/ScrollFX";
import SmoothScroll from "@/components/motion/SmoothScroll";
import ScrollReset from "@/components/ScrollReset";
import JsonLd from "@/components/JsonLd";
import {ogImage} from "@/lib/metadata";
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

  // Optional SEO override, same contract as `pageMetadata`'s `metaTitle` (see
  // the comment there). The homepage is the one route whose title is used
  // VERBATIM with no " | MAZJ" suffix appended, so `Meta.metaTitle` must carry
  // the brand itself.
  const title = t.has("metaTitle") ? t("metaTitle") : t("title");
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
  const nav = await getTranslations({locale, namespace: "Nav"});
  const business = localBusinessSchema({
    locale,
    name: meta("siteName"),
    description: meta("description"),
    streetAddress: location("address"),
  });

  return (
    <html lang={locale} dir={dir}>
      <body className="bg-beige font-sans text-black antialiased">
        {/*
          WCAG 2.4.1 Bypass Blocks (Level A). Every page already renders
          <main id="content" tabIndex={-1}>, but nothing pointed at it, so a
          keyboard or screen-reader visitor had to tab through the whole
          header on every single route. This must be the FIRST focusable
          thing in the document, hence its position above <JsonLd> and
          <Navigation>. The `.skip-link` class (offscreen until focused)
          lives in app/globals.css, which this file does not own.
        */}
        <a href="#content" className="skip-link">
          {nav("skipToContent")}
        </a>
        <JsonLd data={business} />
        <NextIntlClientProvider>
          <Navigation />
          {children}
          {/* Lenis smooth-scroll base (drives ScrollTrigger; skipped under reduced motion) */}
          <SmoothScroll />
          {/* Reset scroll to top on forward navigation (Lenis otherwise keeps the
              previous route's scroll — clicking a footer link left you at the bottom) */}
          <ScrollReset />
          {/* GSAP scroll-motion enhancement layer (clip reveals, chip stagger, parallax, lazy fades) */}
          <ScrollFX />
          {/* Animated film-grain field over the whole page (matches original) */}
          <div className="grain-overlay" aria-hidden="true" />
          {/*
            The WCAG 2.2.2 pause control (MotionToggle) is NOT mounted here.

            It was, as `fixed bottom-4 end-4 z-[9999]` on an opaque bg-black/85
            chip, and that floating chip OCCLUDED real content: measured 71.4 x
            3.7px over the footer's ZATCA line at 390px even at default zoom,
            and up to 44,640 px squared over it at 200% text zoom, where the chip
            grows to 856 x 208 and its inline-start edge leaves the viewport at
            x = -78.8. At 1024 AR it covered WhyMazj body copy. `elementsFromPoint`
            confirmed it painted on top. So the fix for one WCAG failure (2.2.2)
            created another (1.4.4 content loss), which is not a trade worth making.

            It now lives in the footer's bottom chrome row, in NORMAL FLOW, where
            it occludes nothing and reflows with everything else. Every one of the
            12 real routes renders <Footer />, so it is still reachable sitewide,
            and the footer is also where its beige-on-coral styling was designed
            to sit. The only routes without it are not-found and the error
            boundaries, which carry no autoplaying video.
          */}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
