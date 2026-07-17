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

const SOCIAL_LINKS = [
  {label: "X", href: SOCIALS.x},
  {label: "Instagram", href: SOCIALS.instagram},
  {label: "Linkedin", href: SOCIALS.linkedin},
];

function Content() {
  const t = useTranslations("ContactPage");

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} />

      {/* Tour requests + reaching us. The socials are the only confirmed
          channels today. TODO(owner): once the phone/WhatsApp number exists,
          make the primary CTA a wa.me link instead of Instagram. */}
      <section className="relative w-full bg-beige px-6 pb-8 pt-4 lg:px-10">
        <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal className="flex flex-col gap-5 rounded-[16px] bg-beige-card p-8 lg:p-10">
            <h2 className="font-sans text-24 font-medium leading-tight text-brown lg:text-28">
              {t("tourTitle")}
            </h2>
            <p className="max-w-[480px] text-15 leading-relaxed text-brown/85">{t("tourBody")}</p>
            <div className="mt-2">
              <CtaButton href={SOCIALS.instagram} variant="onTan">
                {t("tourCta")}
              </CtaButton>
            </div>
          </Reveal>

          <Reveal delay={100} className="flex flex-col gap-5 rounded-[16px] bg-white p-8 shadow-[0_10px_32px_rgba(0,0,0,0.08)] lg:p-10">
            <h2 className="font-sans text-24 font-medium leading-tight text-black lg:text-28">
              {t("socialsTitle")}
            </h2>
            <p className="max-w-[480px] text-15 leading-relaxed text-muted">{t("socialsBody")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-8 font-mono text-12 uppercase tracking-[0.05em] text-black">
              {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-[8px] transition-opacity duration-200 hover:opacity-60"
                >
                  <span className="opacity-50">[</span>
                  <span>{s.label}</span>
                  <span className="opacity-50">]</span>
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
