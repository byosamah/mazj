import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {pageMetadata} from "@/lib/metadata";
import {useTranslations} from "next-intl";
import PageIntro from "@/components/PageIntro";
import Reveal from "@/components/Reveal";
import CtaButton from "@/components/CtaButton";
import Footer from "@/components/Footer";

function Content() {
  const t = useTranslations("AboutPage");

  const blocks = [
    {title: t("storyTitle"), body: t("storyBody"), img: "/images/step-into.jpg", flip: false},
    {title: t("spaceTitle"), body: t("spaceBody"), img: "/images/spaces/office-day.jpg", flip: true},
    {title: t("communityTitle"), body: t("communityBody"), img: "/images/spaces/event.jpg", flip: false},
  ];

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} />

      {blocks.map((block, i) => (
        <section key={i} className="relative w-full bg-beige px-6 py-14 lg:px-10 lg:py-20">
          <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal className={`flex flex-col gap-5 lg:ps-[8%] ${block.flip ? "lg:order-2" : ""}`}>
              <h2 className="whitespace-pre-line font-sans text-32 font-medium leading-[1.05] text-black lg:text-45">
                {block.title}
              </h2>
              <p className="max-w-[480px] text-15 leading-relaxed text-muted lg:text-16">{block.body}</p>
            </Reveal>
            <Reveal delay={100} className={`flex items-center justify-center ${block.flip ? "lg:order-1" : ""}`}>
              <div className="relative aspect-[4/3] w-full max-w-[560px] overflow-clip rounded-[16px] shadow-[0_10px_32px_rgba(0,0,0,0.12)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={block.img} alt={block.title} className="h-full w-full object-cover" />
              </div>
            </Reveal>
          </div>
        </section>
      ))}

      {/* Closing invitation */}
      <section className="relative w-full bg-beige px-6 pb-24 pt-10 lg:px-10 lg:pb-32">
        <Reveal className="mx-auto flex w-full max-w-[1400px] justify-center">
          <CtaButton href="/contact" variant="dark">
            {t("tourCta")}
          </CtaButton>
        </Reveal>
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
  return pageMetadata(locale, "AboutPage", "/about");
}

export default async function AboutPage({
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
