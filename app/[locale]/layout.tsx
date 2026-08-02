import type {Metadata} from "next";
import {notFound} from "next/navigation";
import {NextIntlClientProvider, hasLocale} from "next-intl";
import {getTranslations, setRequestLocale} from "next-intl/server";
import {routing} from "@/i18n/routing";
import "../globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
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
  // 🔴 `Meta.description` and `Meta.metaDescription` are two different jobs, and
  // the homepage used the first one for both until 2026-08-02. `description` is
  // the BUSINESS description: it also feeds the JSON-LD `LocalBusiness.description`
  // via `localBusinessSchema`, where length is free and completeness is the
  // point. A search snippet is the opposite: Google shows roughly 160 characters
  // and the English string is 177, so the sentence was being cut mid-clause on
  // the site's single most valuable result. Same optional-key pattern
  // `pageMetadata` already uses for every other route.
  const description = t.has("metaDescription")
    ? t("metaDescription")
    : t("description");
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
  // 🔴 The product names must come from the SAME strings the page renders, per
  // locale. They were four English literals inside `lib/schema.ts` until
  // 2026-08-02, which meant every Arabic route described what MAZJ sells in
  // English, on the half of the site that carries the ranking equity.
  const spaces = await getTranslations({locale, namespace: "Spaces"});
  const business = localBusinessSchema({
    locale,
    name: meta("siteName"),
    description: meta("description"),
    streetAddress: location("address"),
    products: {
      sharedSeat: spaces("cards.openDesk.name"),
      privateOffice: spaces("cards.privateOffice.name"),
      meeting: spaces("cards.meetingRoom.name"),
      event: spaces("cards.eventHall.name"),
    },
  });

  return (
    <html lang={locale} dir={dir}>
      {/*
        🔴 THE FONTS ARE DELIBERATELY **NOT** PRELOADED, AND THIS IS THE ONE
        OPTIMISATION IN THIS LAYOUT THAT WAS BUILT, MEASURED, AND THEN TAKEN
        BACK OUT. Do not "fix" the missing preload from an audit.

        The observation that motivated it is real: on a throttled mobile load
        the four woff2 files were requested at **169ms**, dead last, because a
        @font-face URL cannot be discovered until globals.css has been fetched,
        parsed and matched against laid-out text. Preloading them in the head
        does move that request to the front.

        It also makes the page slower, because `font-display: swap` means the
        fonts were never blocking paint in the first place. Text renders
        immediately in the fallback face and swaps when the real one lands, so
        the ONLY thing preloading changes on the paint timeline is that 152 KB
        of font bytes now compete with the render-blocking stylesheet — and win,
        because a preload sits above it in the head.

        Measured, same build, one variable, mobile Lighthouse:

          route        FCP with preload    FCP without
          /en/about          2.0s              0.9s
          /en/spaces         2.0s              0.9s
          /en                4.3s LCP          3.3s LCP

        Mean performance across six routes was 84 with and 85 without, and the
        two routes that had been the FASTEST on the site (`/about` and
        `/contact`, both 95+) were the ones it hurt most. So it is not a wash
        that happens to land badly; it is a systematic ~1s tax on first paint
        that buys a slightly earlier swap.

        ⚠️ If a preload is ever wanted here (to kill the swap flash rather than
        to chase a metric), subset the fonts FIRST. Each file carries Latin AND
        Arabic AND the 690 kashida swashes. Split by `unicode-range` they are
        11.4 KB Latin + 43.2 KB Arabic against 75.7 KB combined, which was built
        and verified during this pass: zero codepoints lost and all 690 kashida
        glyphs retained (the naive subset silently drops 140 of them — see the
        note in components/CLAUDE.md). At 11.4 KB a Latin preload would be
        genuinely free. It was not shipped because English pages render Arabic
        too, so both subsets load and the real saving is ~63 KB rather than the
        ~190 KB it first appears to be, which did not justify touching a brand
        asset unattended.
      */}
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
          {/* 🔴 MOUNTED HERE, AS A SIBLING OF `<main>`, NOT INSIDE IT.
              It was rendered by each of the 14 route files as the last child of
              their own `<main>`, and it had two costs, both measured on the 26
              rendered production pages 2026-08-02.

              1. `<main>` opened before `<footer>` and closed after it on 26 of
                 26. Per the HTML Accessibility API Mappings a `<footer>` that
                 descends from `main` does NOT map to the `contentinfo` role, so
                 the site shipped **zero** contentinfo landmarks and
                 `role="contentinfo"` appeared 0 times. A landmark rotor had no
                 way to jump to the footer on any page.
              2. 208 of 616 internal anchors, 33.8% of the site's whole internal
                 link graph, were site-wide boilerplate structurally filed as
                 main content. On /en/contact ALL 8 in-main internal anchors
                 were footer links and 0 were contextual, which is exactly the
                 signal a content-extraction pass reads to decide what a page is
                 about.

              One mount also means it can never again be forgotten on a new
              route, or ordered differently on one of them. */}
          <Footer />
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

            It briefly moved to the footer's bottom chrome row, in normal flow,
            and was then UNMOUNTED ENTIRELY at the owner's request. So it renders
            on no route at all today: components/MotionToggle.tsx is dead code
            (see the comment in components/Footer.tsx), and this is a known,
            ACCEPTED 2.2.2 gap, not an open bug. Do not re-add it from an audit.
            If it ever returns it belongs in that footer row, in normal flow,
            never as a fixed floating chip. Consequence to remember: nothing
            stamps html[data-motion="paused"] any more, so the globals.css pause
            block is unreachable and the ambient videos play for everyone,
            including visitors who ask for reduced motion.
          */}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
