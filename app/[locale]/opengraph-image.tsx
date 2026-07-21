import {ImageResponse} from "next/og";
import {getTranslations} from "next-intl/server";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {routing} from "@/i18n/routing";

/**
 * Per-locale Open Graph card (1200x630), generated at build time.
 *
 * Why this exists: the site declared `twitter:card = summary_large_image` and
 * shipped no image at all, so every share on WhatsApp, Instagram, X or LinkedIn
 * rendered a blank grey rectangle. For a brand whose distribution is social and
 * word of mouth, that was a bigger real-traffic problem than anything in the
 * SERPs.
 *
 * Per-locale because Arabic sharers should get an Arabic card. Next.js maps
 * this file to `/{locale}/opengraph-image` automatically and injects the
 * `og:image` + `twitter:image` tags, so no metadata wiring is needed.
 *
 * 🔴 Fonts: Satori (which powers `next/og`) supports TTF/OTF/WOFF but NOT
 * WOFF2, and `public/fonts` ships only WOFF2. `assets/fonts/*.ttf` are
 * fonttools-decompressed copies of the same faces, kept OUT of `public/` so
 * they are never served to browsers as dead weight. Regenerate them if the
 * brand face ever changes:
 *   python3 -c "from fontTools.ttLib import TTFont; f=TTFont('public/fonts/thmanyah-sans-900.woff2'); f.flavor=None; f.save('assets/fonts/thmanyah-sans-900.ttf')"
 */

export const size = {width: 1200, height: 630};
export const contentType = "image/png";
export const alt = "MAZJ";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

const font = (weight: 400 | 900) =>
  readFile(path.join(process.cwd(), "assets", "fonts", `thmanyah-sans-${weight}.ttf`));

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: "Meta"});
  const location = await getTranslations({locale, namespace: "Location"});
  const isAr = locale === "ar";

  const [regular, black] = await Promise.all([font(400), font(900)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          // Near-black ground so the coral reads hot, matching the hero's
          // dark-video-under-coral relationship rather than the cream page.
          backgroundColor: "#111111",
          padding: 80,
          // Satori has no logical properties, so the whole card mirrors on dir.
          direction: isAr ? "rtl" : "ltr",
          fontFamily: "Thmanyah",
        }}
      >
        {/* Coral rule: the one brand-owned colour, doing the identifying. */}
        <div style={{display: "flex", width: 120, height: 8, backgroundColor: "#FF5A48"}} />

        <div style={{display: "flex", flexDirection: "column", gap: 28}}>
          <div
            style={{
              display: "flex",
              fontSize: isAr ? 92 : 86,
              fontWeight: 900,
              color: "#fff7e9",
              // Arabic ascenders/descenders need the looser leading the site
              // gives them globally via the html[lang="ar"] heading rule.
              lineHeight: isAr ? 1.35 : 1.05,
              letterSpacing: isAr ? 0 : -2,
              maxWidth: 940,
              direction: isAr ? "rtl" : "ltr",
            }}
          >
            {t("title").split("|")[1]?.trim() ?? t("title")}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              fontSize: 30,
              fontWeight: 400,
              color: "#a8a29a",
            }}
          >
            <span style={{color: "#FF5A48", fontWeight: 900}}>{t("siteName")}</span>
            <span>·</span>
            <span>{location("address")}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {name: "Thmanyah", data: regular, weight: 400, style: "normal"},
        {name: "Thmanyah", data: black, weight: 900, style: "normal"},
      ],
    }
  );
}
