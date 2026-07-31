import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {pageMetadata} from "@/lib/metadata";
import {useTranslations} from "next-intl";
import PageIntro from "@/components/PageIntro";
import LocationHours from "@/components/LocationHours";
import Reveal from "@/components/Reveal";
import CtaButton from "@/components/CtaButton";
import Footer from "@/components/Footer";
import {SOCIALS} from "@/lib/links";
import {waLink} from "@/lib/contact";

const SOCIAL_LINKS = [
  {label: "X", href: SOCIALS.x},
  {label: "Instagram", href: SOCIALS.instagram},
  {label: "Linkedin", href: SOCIALS.linkedin},
];

function Content() {
  const t = useTranslations("ContactPage");

  return (
    <>
      {/* Hospitality, not product: this opener used to be a private-office pod,
          which is a room you buy, not a welcome. The two private-office frames
          are reserved for /spaces/private-office. */}
      <PageIntro variant="hero" eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} image="/images/contact-welcome.jpg" />

      {/* Tour requests + reaching us. The primary CTA is the approved WhatsApp
          Business line (lib/contact.ts), matching how every other tour CTA on
          the site already behaves — Location, SpaceOffers and the Faq copy all
          say "book a tour on WhatsApp". This previously pointed at Instagram,
          which dropped tour requests into DMs. */}
      <section className="relative w-full bg-beige px-6 pb-8 pt-4 lg:px-10">
        <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal className="flex flex-col gap-5 rounded-[16px] bg-beige-card p-10 lg:p-12">
            {/* These were the smallest headings on the site (24/28px) sitting
                directly above LocationHours' 32/50px, so the page's own authored
                content ranked visually below a block reused from the landing. */}
            <p className="eyebrow text-12 text-brown/60">{t("tourEyebrow")}</p>
            <h2 className="text-balance font-sans text-32 font-medium leading-[1.05] text-brown lg:text-40">
              {t("tourTitle")}
            </h2>
            <p className="max-w-[480px] text-15 leading-relaxed text-brown/85 text-pretty">{t("tourBody")}</p>
            <div className="mt-2">
              <CtaButton href={waLink(t("tourMsg"))} variant="onTan">
                {t("tourCta")}
              </CtaButton>
            </div>
          </Reveal>

          {/* Hairline-outlined panel, not a second floating white card. One
              tan surface + one white drop-shadowed box read as two unrelated
              widgets; a ruled panel belongs to the same system as every other
              rule on the site. */}
          <Reveal
            delay={100}
            className="flex flex-col gap-5 rounded-[16px] border border-black/12 p-10 lg:p-12"
          >
            <p className="eyebrow text-12 text-muted">{t("socialsEyebrow")}</p>
            <h2 className="text-balance font-sans text-32 font-medium leading-[1.05] text-black lg:text-40">
              {t("socialsTitle")}
            </h2>
            <p className="max-w-[480px] text-15 leading-relaxed text-muted text-pretty">{t("socialsBody")}</p>
            {/* Touch targets: these measured 34.1 x 40.0 in English and
                32.3 x 40.0 in Arabic at 390px, under 44px on both axes (WCAG
                2.5.8). `min-h-[44px]` matches the height convention being
                applied across the nav and footer, and the `before:` pseudo
                widens the hit box outward. The row's gap-8 (32px) is wider than
                the 12px of added reach, so neighbouring targets never overlap
                and nothing shifts visually. */}
            <div className="eyebrow mt-2 flex flex-wrap items-center gap-8 text-12 text-black">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-flex min-h-[44px] items-center gap-[8px] before:absolute before:inset-y-0 before:inset-x-[-6px] before:content-[''] [transition:transform_120ms] active:scale-[0.96]"
                >
                  {/* The brackets carry the hover, not an opacity fade on the
                      whole link. See the note on the same idiom in Footer.tsx:
                      fading a link makes it less legible exactly when it is
                      being pointed at. */}
                  <span className="opacity-50 [transition:opacity_200ms] group-hover:opacity-100">[</span>
                  <span>{s.label}</span>
                  <span className="opacity-50 [transition:opacity_200ms] group-hover:opacity-100">]</span>
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Address, hours, map placeholder, phone/WhatsApp placeholders */}
      <LocationHours />
    </>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  return pageMetadata(locale, "ContactPage", "/contact");
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  return (
    <main id="content" tabIndex={-1} className="w-full overflow-x-hidden">
      <Content />
      <Footer />
    </main>
  );
}
