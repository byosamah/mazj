import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {pageMetadata} from "@/lib/metadata";
import {useTranslations} from "next-intl";
import PageIntro from "@/components/PageIntro";
import Reveal from "@/components/Reveal";
import CtaButton from "@/components/CtaButton";
import Footer from "@/components/Footer";
import {BOOKING} from "@/lib/links";

function Content() {
  const t = useTranslations("CommunityPage");
  const programs = t.raw("programs") as Array<{name: string; desc: string}>;

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} />

      <section className="relative w-full bg-beige px-6 pb-24 pt-4 lg:px-10 lg:pb-32">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-14">
          <Reveal>
            <p className="max-w-[720px] text-15 leading-relaxed text-black lg:text-18">{t("body")}</p>
          </Reveal>

          <div className="flex flex-col gap-8">
            <Reveal>
              <p className="font-mono text-12 uppercase tracking-[0.05em] text-muted">{t("programsTitle")}</p>
            </Reveal>
            <ul className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {programs.map((program, i) => (
                <Reveal
                  as="li"
                  key={i}
                  delay={i * 80}
                  className="flex flex-col gap-3 rounded-[16px] bg-beige-card p-7"
                >
                  <h2 className="font-sans text-20 font-medium leading-tight text-brown">{program.name}</h2>
                  <p className="text-14 leading-relaxed text-brown/80">{program.desc}</p>
                </Reveal>
              ))}
            </ul>
          </div>

          {/* Newsletter slot: no backend yet, so the CTA routes to the contact
              page. TODO(owner): swap in the real signup form/service when ready. */}
          <Reveal className="flex flex-col items-start gap-4 rounded-[16px] bg-white p-8 shadow-[0_10px_32px_rgba(0,0,0,0.08)] lg:p-10">
            <h2 className="font-sans text-24 font-medium leading-tight text-black lg:text-28">
              {t("newsletterTitle")}
            </h2>
            <p className="max-w-[560px] text-15 leading-relaxed text-muted">{t("newsletterBody")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <CtaButton href="/contact" variant="dark">
                {t("newsletterCta")}
              </CtaButton>
              <CtaButton href={BOOKING.membership} variant="light">
                {t("joinCta")}
              </CtaButton>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  return pageMetadata(locale, "CommunityPage", "/community");
}

export default async function CommunityPage({
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
