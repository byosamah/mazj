import {useLocale, useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import Reveal from "./Reveal";
import MediaFrame from "./MediaFrame";
import CtaButton from "./CtaButton";
import {bookingUrl} from "@/lib/links";

/**
 * The four bookable products as cards: photo, name, capacity, one-line
 * "includes", and a CTA. On the landing the CTA books straight on mazj.sa;
 * with `detail`, it links to each space's own page instead (used on /spaces).
 * Prices intentionally never appear here; mazj.sa shows the live price.
 *
 * ⚠️ **`space` replaced a ready-made `href` on 2026-08-01**, because the
 * destination is no longer a bare path: booking went back out to mazj.sa and a
 * store URL carries the visitor's locale, which a module-scope constant cannot
 * know. See `bookingUrl()` in `lib/links.ts`.
 */
const CARDS = [
  {id: "openDesk", space: "sharedSeat", detailHref: "/spaces/coworking", img: "/images/spaces/day-desk.jpg"},
  {id: "privateOffice", space: "privateOffice", detailHref: "/spaces/private-office", img: "/images/spaces/office-day.jpg"},
  {id: "meetingRoom", space: "meeting", detailHref: "/spaces/meeting-room", img: "/images/spaces/meeting.jpg"},
  {id: "eventHall", space: "event", detailHref: "/spaces/event-hall", img: "/images/spaces/event.jpg"},
] as const;

export default function SpacesGrid({
  detail = false,
  showHeader = true,
  exclude,
  heading,
  surface = "bg-beige",
}: {
  detail?: boolean;
  showHeader?: boolean;
  /** Card id to drop — used on a detail page so it never links to itself. */
  exclude?: string;
  /** Optional plain heading, for the "other spaces" strip on detail pages. */
  heading?: string;
  surface?: string;
}) {
  const t = useTranslations("Spaces");
  const locale = useLocale();
  const cards = exclude ? CARDS.filter((c) => c.id !== exclude) : CARDS;

  return (
    <section className={`relative w-full ${surface} px-6 py-24 lg:px-10 lg:py-32`}>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-14">
        {showHeader && (
          <Reveal className="flex flex-col items-center gap-5 text-center">
            <p className="eyebrow text-12 text-muted">{t("eyebrow")}</p>
            <h2 className="whitespace-pre-line text-balance font-sans text-32 font-medium leading-[1.05] text-black lg:text-50">
              {t("title")}
            </h2>
          </Reveal>
        )}

        {heading && (
          <Reveal className="flex flex-col gap-4 border-t border-black/10 pt-6">
            <h2 className="text-balance font-sans text-24 font-medium leading-tight text-black lg:text-32">
              {heading}
            </h2>
          </Reveal>
        )}

        <ul
          className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${
            cards.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"
          }`}
        >
          {cards.map((card, i) => (
            <Reveal
              as="li"
              key={card.id}
              delay={i * 80}
              className="reveal-card flex flex-col gap-5"
            >
              {/* The alt describes the PHOTOGRAPH (image search reads it), not
                  the product — the h3 below already names the card. */}
              <MediaFrame
                src={card.img}
                alt={t(`cards.${card.id}.photoAlt`)}
                ratio="aspect-[3/2]"
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              />
              <div className="flex flex-1 flex-col gap-3 border-t border-black/10 pt-5">
                <p className="eyebrow text-12 text-muted tabular-nums">
                  {t(`cards.${card.id}.capacity`)}
                </p>
                <h3 className="font-sans text-20 font-medium leading-tight text-black text-balance">
                  {/* The title links each card to its own /spaces/* page, so the
                      four money pages get homepage equity with the space's name
                      as anchor text; the CTA below keeps its booking job. */}
                  <Link
                    href={card.detailHref}
                    className="inline-block underline decoration-transparent underline-offset-[6px] hover:decoration-black [transition:text-decoration-color_200ms,transform_120ms] active:scale-[0.96]"
                  >
                    {t(`cards.${card.id}.name`)}
                  </Link>
                </h3>
                <p className="text-14 leading-relaxed text-muted text-pretty">{t(`cards.${card.id}.includes`)}</p>
                {/* Four cards, four different mazj.sa destinations, and until
                    now four links whose accessible name was the single word
                    "Book" — indistinguishable in a screen reader's links list
                    (WCAG 2.4.4). The <h3> gives sighted users the context that
                    the name never carried.

                    The name is fixed with visually-hidden text rather than an
                    aria-label because CtaButton takes no aria-label prop and is
                    owned elsewhere. The visible word is hidden from the
                    accessibility tree and the full `Spaces.bookAria` string
                    ("Book {space}" / "احجز {space}") supplies the name, so the
                    visible label stays a subset of the accessible name (WCAG
                    2.5.3 holds, and voice control still matches "Book"). */}
                <div className="mt-auto pt-4">
                  <CtaButton href={detail ? card.detailHref : bookingUrl(card.space, locale)} variant="dark">
                    {detail ? (
                      <>
                        <span aria-hidden="true">{t("viewCta")}</span>
                        <span className="sr-only">
                          {t("viewAria", {space: t(`cards.${card.id}.name`)})}
                        </span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">{t("bookCta")}</span>
                        <span className="sr-only">
                          {t("bookAria", {space: t(`cards.${card.id}.name`)})}
                        </span>
                      </>
                    )}
                  </CtaButton>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
