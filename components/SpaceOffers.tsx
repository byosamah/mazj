import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import Reveal from "./Reveal";
import WordReveal from "./WordReveal";
import MediaFrame from "./MediaFrame";
import CtaButton from "./CtaButton";
import {BOOKING} from "@/lib/links";
import {waLink} from "@/lib/contact";

/**
 * The full booking menu for /spaces: the same four products mazj.sa sells.
 *
 * Rebuilt to speak the landing page's language instead of the generic card
 * grid it used to be. Three concrete changes:
 *   1. No white boxes. Media sits on the beige surface inside MediaFrame's
 *      hairline ring, exactly as USP does. The old
 *      `bg-white rounded-[16px] shadow-[0_10px_32px]` wrapper appears nowhere
 *      on the landing page.
 *   2. Two-up, not four-up. Four thumbnails read as a marketplace listing;
 *      two columns give the photography room and the copy a real measure.
 *   3. Media runs at the source frames' native 3:2, so object-cover stops
 *      trimming the sides of every product shot.
 *
 * Each offer maps 1:1 to a BOOKING url; the four detail pages are the deeper
 * read behind each. Prices never appear here, mazj.sa shows the live one.
 */
const OFFERS = [
  {id: "sharedSeat", href: BOOKING.sharedSeat, detailHref: "/spaces/coworking", img: "/images/spaces/membership.jpg"},
  {id: "privateOffice", href: BOOKING.privateOffice, detailHref: "/spaces/private-office", img: "/images/spaces/office-month.jpg"},
  {id: "meeting", href: BOOKING.meeting, detailHref: "/spaces/meeting-room", img: "/images/spaces/meeting.jpg"},
  {id: "eventHall", href: BOOKING.event, detailHref: "/spaces/event-hall", img: "/images/spaces/event.jpg"},
] as const;

export default function SpaceOffers() {
  const t = useTranslations("SpacesPage");

  return (
    <section className="relative w-full bg-beige px-6 py-24 lg:px-10 lg:py-32">
      {/* same faint hairline design grid the landing sections carry */}
      <div className="grid-overlay" aria-hidden="true" />

      <div className="relative z-[2] mx-auto flex w-full max-w-[1400px] flex-col gap-16 lg:gap-20">
        <Reveal className="flex flex-col gap-5">
          <p className="eyebrow text-12 text-muted">{t("sectionEyebrow")}</p>
          <WordReveal
            as="h2"
            className="max-w-[18ch] font-sans text-32 font-bold leading-[1.05] text-black lg:text-50"
          >
            {t("sectionTitle")}
          </WordReveal>
          {/* The hub's indexable prose: names all four offers in the words
              people actually search (the card labels alone carried none). */}
          <p className="max-w-[62ch] text-pretty text-15 leading-relaxed text-muted lg:text-16">
            {t("sectionIntro")}
          </p>
          <p className="max-w-[62ch] text-pretty text-15 leading-relaxed text-muted lg:text-16">
            {t("sectionIntro2")}
          </p>
        </Reveal>

        <ul className="grid grid-cols-1 gap-x-10 gap-y-16 md:grid-cols-2 lg:gap-x-16 lg:gap-y-20">
          {OFFERS.map((offer, i) => (
            <Reveal
              as="li"
              key={offer.id}
              delay={(i % 2) * 90}
              className="reveal-card flex flex-col gap-6"
            >
              <MediaFrame
                src={offer.img}
                alt={t(`offers.${offer.id}.photoAlt`)}
                ratio="aspect-[3/2]"
                width={1200}
                height={800}
                eager={i === 0}
              />

              <div className="flex flex-1 flex-col gap-4">
                {/* index + capacity share one ruled row, so every card's first
                    rule lands at the same height regardless of copy length */}
                <div className="flex items-baseline justify-between gap-6 border-t border-black/10 pt-5">
                  <span className="eyebrow text-12 text-orange tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="eyebrow text-12 text-muted tabular-nums">
                    {t(`offers.${offer.id}.capacity`)}
                  </span>
                </div>

                <h3 className="text-balance font-sans text-24 font-medium leading-[1.1] text-black lg:text-32">
                  {t(`offers.${offer.id}.name`)}
                </h3>

                <p className="max-w-[46ch] text-pretty text-15 leading-relaxed text-muted lg:text-16">
                  {t(`offers.${offer.id}.includes`)}
                </p>

                <div className="mt-auto flex flex-col gap-4 pt-4">
                  <div className="flex items-baseline justify-between gap-6 border-t border-black/10 pt-4">
                    <span className="eyebrow shrink-0 text-12 text-muted">{t("durationsLabel")}</span>
                    <span className="text-end text-14 leading-relaxed text-black/75 tabular-nums text-pretty">
                      {t(`offers.${offer.id}.durations`)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
                    <CtaButton href={offer.href} variant="dark">
                      {t("bookCta")}
                    </CtaButton>
                    {/* `active:scale-[0.96]` compiles to transform, so transform
                        must be in the transition list or the press snaps. */}
                    <Link
                      href={offer.detailHref}
                      className="relative text-14 text-muted underline underline-offset-4 before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] [transition:color_160ms,transform_120ms] hover:text-black active:scale-[0.96]"
                    >
                      {/* Four identical "See the space" anchors to four URLs are
                          indistinguishable in a links list; the sr-only span
                          appends the space's name (visible label stays a prefix
                          of the accessible name, so WCAG 2.5.3 holds). */}
                      <span aria-hidden="true">{t("detailCta")}</span>
                      <span className="sr-only">
                        {t("detailAria", {space: t(`offers.${offer.id}.name`)})}
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>

        {/* Closing plate on tan: a change of subject, not a fifth card. Also the
            one place WhatsApp survives outside /contact — picking a space and a
            length is a real decision and a human beats a bounce. */}
        <Reveal className="flex flex-col items-start gap-5 rounded-[16px] bg-beige-card p-10 lg:p-16">
          <h3 className="max-w-[16ch] text-balance font-sans text-32 font-medium leading-[1.05] text-brown lg:text-45">
            {t("help.title")}
          </h3>
          <p className="max-w-[52ch] text-pretty text-15 leading-relaxed text-brown/85 lg:text-16">
            {t("help.body")}
          </p>
          <div className="mt-2">
            <CtaButton href={waLink(t("help.msg"))} variant="onTan">
              {t("help.cta")}
            </CtaButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
