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
import {Link} from "@/i18n/navigation";
import {waLink} from "@/lib/contact";

type Chapter = {
  title: string;
  body: string;
  img: string;
  alt: string;
  w: number;
  h: number;
  ratio: string;
  flip: boolean;
  surface: string;
  heading: string;
  copy: string;
  rule: string;
  /**
   * Optional inline link out of a chapter. Only the community chapter carries
   * one: the closing plate used to hold BOTH a /spaces and an /events button
   * next to a headline that also said "come see", so one card ran the word
   * three times. The events link belongs beside the sentence that earns it
   * (the one naming what has actually happened here) rather than in a CTA row
   * it was competing in. That sentence used to carry a count; it must not
   * again, see `TONE.md` §6.
   */
  link?: {href: string; label: string};
};

function Content() {
  const t = useTranslations("AboutPage");

  /**
   * Three chapters, three colour worlds. These used to be one `.map()` over
   * identical beige rows, so mirroring the photo was the ONLY thing telling
   * them apart — and five consecutive beige sections read as one long slab.
   * Each block now owns a surface plus its own three ink tiers (heading 1.0,
   * body ~0.8, rule ~0.15), so the page moves through light -> warm -> deep
   * and the flip becomes one variable among several instead of the only one.
   */
  const blocks: Chapter[] = [
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
      /* This chapter shipped on `spaces/day-desk.jpg`, which is the single
         most-reused frame on the site: the landing hero finder, SpacesGrid,
         FoundingBand, the /spaces hero AND the /spaces/coworking hero all
         carry it. So the visitor most likely to reach /about (one who has
         already scrolled the landing page) met it for the fifth time here.
         DSC_7854 is unused elsewhere, and it answers the heading better: an
         ADDRESS is a place, not an activity, so this is a room with its own
         light rather than another shot of people at laptops. */
      img: "/images/about-address.jpg",
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
      /* `spaces/event.jpg` is an EMPTY hall, and it was illustrating the one
         chapter on the site whose whole claim is that people gather here.
         It is also the most-repeated frame after day-desk (landing HostEvent,
         the /events hero, /spaces/event-hall, SpacesGrid, the hero finder,
         SpaceOffers). DSC_8011 is a real MAZJ community night, re-cut from
         the original 8256x5504 rather than from the already-compressed
         events/women-design.jpg crop. It appears once elsewhere, as a small
         card deep in the /events archive, which this chapter links to. */
      img: "/images/about-community.jpg",
      alt: t("communityAlt"),
      w: 1200,
      h: 800,
      ratio: "aspect-[3/2]",
      flip: false,
      surface: "bg-purple-dark",
      heading: "text-beige",
      copy: "text-beige/75",
      rule: "border-beige/20",
      link: {href: "/events", label: t("eventsCta")},
    },
  ];

  return (
    <>
      {/* The opener used to be `why-mazj.jpg`, which is not a photograph at all:
          it is frame 0 of `why-mazj.mp4`, the video card on the LANDING page. So
          a visitor arriving here from the home page met the same shot twice, the
          second time upscaled from a 1280x720 video still across a full-bleed
          700px band. This is a real photograph (DSC_8182, 1600x1066), used on no
          other route, and it is the only overhead frame on the site, so it
          cannot read as a repeat of the booth photos on /spaces either. Shot
          from above, it puts the whole floor's mix of people in one frame, which
          is the h1's claim rather than a decoration beside it. alt="" stands:
          the photo sits BEHIND that h1 (see PageIntro), and it appears nowhere
          else on the page to describe. */}
      <PageIntro variant="hero" eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} image="/images/about-blend.jpg" />


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
              {/* Colour comes from the chapter, so this link renders in THREE
                  different inks across the three surfaces (`text-muted`,
                  `text-brown/85`, `text-beige/75`). That is why the hover may
                  not name a colour.

                  🔴 It used to be `hover:opacity-70`, which was the right
                  instinct for the wrong reason: colour-agnostic, yes, but it
                  makes the link HARDER to read at the moment it is pointed at.
                  The underline THICKENS instead (1px to 2px). That is equally
                  colour-agnostic, because thickness has no hue, and it adds
                  presence rather than removing it. ⚠️ Do not reach for
                  `decoration-current/30` here: an alpha modifier on
                  `currentColor` does not reliably compile, and it would fail
                  silently in the way a dead Tailwind class always does.

                  `active:scale-[0.96]` compiles to `transform`, so the
                  transition list must name transform or the press snaps with no
                  easing. The `before:` band lifts the hit area to 44px without
                  moving the text (WCAG 2.5.8). */}
              {block.link ? (
                <Link
                  href={block.link.href}
                  className={`relative w-fit text-14 underline decoration-1 underline-offset-4 hover:decoration-2 ${block.copy} before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] [transition:text-decoration-thickness_200ms,transform_120ms] active:scale-[0.96]`}
                >
                  {block.link.label}
                </Link>
              ) : null}
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
                sizes="(min-width: 1024px) 620px, 100vw"
                className="w-full max-w-[620px]"
              />
            </Reveal>
          </div>
        </section>
      ))}

      {/* 🔴 There is NO "MAZJ in numbers" stat block here, and that is an owner
          ruling (2026-07-28), not an oversight. It held 25 open desks / 3
          private offices / 30 seats in Al-Ma'arij / 24-7, and it was removed in
          the same instruction that banned the event count site-wide. Do not
          "restore the missing proof" from an audit: the page argues by chapter
          now, not by counter. See `TONE.md` §6.

          ⚠️ Be precise about what survived, because the first version of this
          comment was WRONG and an audit caught it. TWO of the four are still
          stated elsewhere: 30 seats (19 places) and 24/7 (32 places). The other
          TWO are now stated NOWHERE in either message file: there is no "25"
          in any string, and no string anywhere says how many private offices
          exist. `spaceBody` right above names the open desks and the private
          offices WITHOUT a figure. That is a consequence of the ruling, not a
          bug to fix here: if the office count is ever wanted back, its home is
          the private-office page at the buyer's decision point. */}

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
          {/* 🔴 The primary CTA here is WhatsApp, which is the ONE exception to
              the site's self-serve-first rule (see components/CLAUDE.md), and it
              is the same exception /faq's closing CTA already holds. The reason
              is that `closingBody` promised "book a tour" while both buttons
              went to listing pages, so the page's last line named an action no
              control on it performed. A tour is not self-servable: there is no
              tour product in Rekaz, and every other tour CTA on the site
              (Location, SpaceOffers, the Faq answer, /contact) is already
              `waLink`. The self-serve path is preserved as the secondary
              button, so /spaces did not lose its entry point. `tourMsg` is
              deliberately NOT ContactPage's string: a distinct prefill tells
              the team the request came from /about. */}
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <CtaButton href={waLink(t("tourMsg"))} variant="onLavender">
              {t("tourCta")}
            </CtaButton>
            <CtaButton href="/spaces" variant="light">
              {t("spacesCta")}
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
