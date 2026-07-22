import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {pageMetadata} from "@/lib/metadata";
import {useTranslations} from "next-intl";
import PageIntro from "@/components/PageIntro";
import Reveal from "@/components/Reveal";
import WordReveal from "@/components/WordReveal";
import MediaFrame from "@/components/MediaFrame";
import CtaButton from "@/components/CtaButton";
import Footer from "@/components/Footer";

type Principle = {word: string; label: string; body: string};
type Fact = {value: string; label: string};

function Content() {
  const t = useTranslations("AboutPage");
  const principles = t.raw("principles") as Principle[];
  const facts = t.raw("facts") as Fact[];

  /**
   * Three chapters, three colour worlds. These used to be one `.map()` over
   * identical beige rows, so mirroring the photo was the ONLY thing telling
   * them apart — and five consecutive beige sections read as one long slab.
   * Each block now owns a surface plus its own three ink tiers (heading 1.0,
   * body ~0.8, rule ~0.15), so the page moves through light -> warm -> deep
   * and the flip becomes one variable among several instead of the only one.
   */
  const blocks = [
    {
      title: t("storyTitle"),
      body: t("storyBody"),
      img: "/images/step-into.jpg",
      alt: t("storyAlt"),
      w: 1000,
      h: 1333,
      ratio: "aspect-[3/4]",
      flip: false,
      surface: "bg-beige",
      heading: "text-black",
      copy: "text-muted",
      rule: "border-black/10",
    },
    {
      title: t("spaceTitle"),
      body: t("spaceBody"),
      img: "/images/spaces/office-day.jpg",
      alt: t("spaceAlt"),
      w: 1200,
      h: 800,
      ratio: "aspect-[3/2]",
      flip: true,
      surface: "bg-beige-card",
      heading: "text-brown",
      copy: "text-brown/85",
      rule: "border-brown/15",
    },
    {
      title: t("communityTitle"),
      body: t("communityBody"),
      img: "/images/spaces/event.jpg",
      alt: t("communityAlt"),
      w: 1200,
      h: 800,
      ratio: "aspect-[3/2]",
      flip: false,
      surface: "bg-purple-dark",
      heading: "text-beige",
      copy: "text-beige/75",
      rule: "border-beige/20",
    },
  ];

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} image="/images/why-mazj.jpg" imageRatio="aspect-[4/5]" />

      {/* MAZJ's own three-word framework, from its Arabic brand language on
          mazj.org: مقصد راسخ / وظيفية فاعلة / تكوين أخَّاذ. The Arabic term leads
          in BOTH locales because it is the brand's actual vocabulary rather than
          a translation: English carries the gloss as the label, Arabic carries
          the original adjective. */}
      <section className="relative w-full bg-beige px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-12">
          {/* This chapter had no heading at all — its only title was a 12px
              muted label, so the document outline ran h1 -> nothing -> h2 and
              MAZJ's own brand framework arrived unannounced. */}
          <Reveal className="flex flex-col gap-5 border-t border-black/10 pt-6">
            <p className="eyebrow text-12 text-muted">{t("principlesLabel")}</p>
            <WordReveal
              as="h2"
              className="max-w-[16ch] font-sans text-32 font-bold leading-[1.05] text-black lg:text-45"
            >
              {t("principlesTitle")}
            </WordReveal>
            <p className="max-w-[52ch] text-pretty text-15 leading-relaxed text-muted">
              {t("principlesNote")}
            </p>
          </Reveal>

          {/* A ruled ledger, NOT three cards. Boxing these forced every column
              to the tallest one and left ragged dead space under the shortest,
              and a white floating card is a pattern the landing page never
              uses. As ruled rows the words can run at display scale, the rules
              land at identical heights by construction, and the block reads as
              the brand statement it is. */}
          <ul className="flex flex-col">
            {principles.map((p, i) => (
              <Reveal
                as="li"
                key={p.word}
                delay={i * 90}
                className="grid grid-cols-1 items-baseline gap-x-12 gap-y-4 border-t border-black/15 py-8 last:border-b lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:py-12"
              >
                {/* Word + label are ONE Arabic noun phrase (مقصد راسخ /
                    وظيفية فاعلة / تكوين أخَّاذ), so the label sits on the same
                    baseline as a continuation rather than in the tiny grey
                    eyebrow register, which severed the phrase in the AR build.
                    leading-[1.35]: Arabic glyphs at display size in BOTH
                    locales, and the tight Latin leading would clip their tops.
                    lang="ar" dir="rtl" on the word for the same reason it is
                    unconditional: `word` is the Arabic term in BOTH message
                    files (only `label` translates), so inside the EN document
                    it is a foreign-language run that WCAG 3.1.2 requires be
                    marked, or an English TTS voice reads it as garbage. dir
                    carries as much weight as lang: it isolates the RTL run from
                    the surrounding LTR bidi context. Redundant in the AR build,
                    correct in both. `label` is deliberately NOT marked: it is
                    English in en.json and Arabic in ar.json, so it always
                    matches its document language already. */}
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span
                    lang="ar"
                    dir="rtl"
                    className="font-sans text-45 font-bold leading-[1.35] text-orange lg:text-70"
                  >
                    {p.word}
                  </span>
                  <span className="font-sans text-20 leading-[1.35] text-orange/60 lg:text-24">
                    {p.label}
                  </span>
                </div>
                <p className="max-w-[52ch] text-pretty text-15 leading-relaxed text-muted lg:text-16">
                  {p.body}
                </p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {blocks.map((block, i) => (
        <section
          key={i}
          className={`relative flex w-full items-center ${block.surface} px-6 py-20 lg:min-h-svh lg:px-10 lg:py-28`}
        >
          <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-20">
            <Reveal className={`flex flex-col gap-5 lg:ps-[8%] ${block.flip ? "lg:order-2" : ""}`}>
              {/* chapter number as a hairline-ruled marker, so each block
                  announces itself as a chapter rather than another row */}
              <span className={`eyebrow border-t ${block.rule} pt-5 text-12 ${block.copy} tabular-nums`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <WordReveal
                as="h2"
                className={`max-w-[14ch] font-sans text-32 font-bold leading-[1.05] ${block.heading} lg:text-50`}
              >
                {block.title}
              </WordReveal>
              <p className={`max-w-[480px] text-pretty text-15 leading-relaxed ${block.copy} lg:text-16`}>
                {block.body}
              </p>
            </Reveal>
            <Reveal
              delay={100}
              className={`flex items-center justify-center ${block.flip ? "lg:order-1" : ""}`}
            >
              {/* Shared MediaFrame = the landing page's media idiom (hairline
                  ring on the surface, no drop shadow). Each chapter runs at its
                  own source ratio rather than a uniform 4:3 — the story photo
                  is a 3:4 portrait and was being crushed into a landscape box,
                  and the varied ratios make the three chapters read as authored
                  rather than as one `.map()`. The alt describes the photograph,
                  never the chapter heading beside it. */}
              <MediaFrame
                fx="clip"
                src={block.img}
                alt={block.alt}
                ratio={block.ratio}
                width={block.w}
                height={block.h}
                className="w-full max-w-[620px]"
              />
            </Reveal>
          </div>
        </section>
      ))}

      {/* Hard capacity numbers, matching the real space. */}
      <section className="relative w-full bg-beige px-6 py-14 lg:px-10 lg:py-20">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8">
          <Reveal className="border-t border-black/10 pt-6">
            <p className="eyebrow text-12 text-muted">{t("factsLabel")}</p>
          </Reveal>
          <ul className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {facts.map((f, i) => (
              <Reveal as="li" key={f.label} delay={i * 80} className="flex flex-col gap-2">
                <p className="font-sans text-40 font-bold leading-[1.35] text-black tabular-nums lg:text-50">
                  {f.value}
                </p>
                <p className="text-14 leading-relaxed text-muted text-pretty">{f.label}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Closing plate. This used to be two naked buttons centred on empty
          beige — no eyebrow, no headline, no body, no surface. The page simply
          stopped and offered a choice with no sentence framing it, and the
          centring broke the start-aligned axis every other block establishes.
          On lavender it lands as a real closing beat and gives the route a
          fourth colour world. */}
      <section className="relative w-full bg-beige px-6 pb-24 pt-16 lg:px-10 lg:pb-32 lg:pt-24">
        <Reveal className="mx-auto flex w-full max-w-[1400px] flex-col items-start gap-6 rounded-[16px] bg-purple p-10 lg:p-16">
          <h2 className="max-w-[14ch] whitespace-pre-line text-balance font-sans text-32 font-medium leading-[1.05] text-purple-dark lg:text-45">
            {t("closingTitle")}
          </h2>
          <p className="max-w-[52ch] text-pretty text-15 leading-relaxed text-purple-dark/80 lg:text-16">
            {t("closingBody")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <CtaButton href="/spaces" variant="onLavender">
              {t("tourCta")}
            </CtaButton>
            <CtaButton href="/events" variant="light">
              {t("eventsCta")}
            </CtaButton>
          </div>
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
