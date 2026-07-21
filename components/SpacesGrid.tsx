import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import MediaFrame from "./MediaFrame";
import CtaButton from "./CtaButton";
import {BOOKING} from "@/lib/links";

/**
 * The four bookable products as cards: photo, name, capacity, one-line
 * "includes", and a CTA. On the landing the CTA books straight on mazj.sa;
 * with `detail`, it links to each space's own page instead (used on /spaces).
 * Prices intentionally never appear here; mazj.sa shows the live price.
 */
const CARDS = [
  {id: "openDesk", href: BOOKING.sharedSeat, detailHref: "/spaces/coworking", img: "/images/spaces/day-desk.jpg"},
  {id: "privateOffice", href: BOOKING.privateOffice, detailHref: "/spaces/private-office", img: "/images/spaces/office-month.jpg"},
  {id: "meetingRoom", href: BOOKING.meeting, detailHref: "/spaces/meeting-room", img: "/images/spaces/meeting.jpg"},
  {id: "eventHall", href: BOOKING.event, detailHref: "/spaces/event-hall", img: "/images/spaces/event.jpg"},
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
  const cards = exclude ? CARDS.filter((c) => c.id !== exclude) : CARDS;

  return (
    <section className={`relative w-full ${surface} px-6 py-24 lg:px-10 lg:py-32`}>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-14">
        {showHeader && (
          <Reveal className="flex flex-col items-center gap-5 text-center">
            <p className="eyebrow text-12 text-muted">{t("eyebrow")}</p>
            <h2 className="whitespace-pre-line font-sans text-32 font-medium leading-[1.05] text-black lg:text-50">
              {t("title")}
            </h2>
          </Reveal>
        )}

        {heading && (
          <Reveal className="flex flex-col gap-4 border-t border-black/10 pt-6">
            <h2 className="font-sans text-24 font-medium leading-tight text-black lg:text-32">
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
              {/* alt="" — the h3 below already names the card */}
              <MediaFrame src={card.img} ratio="aspect-[3/2]" width={1200} height={800} />
              <div className="flex flex-1 flex-col gap-3 border-t border-black/10 pt-5">
                <p className="eyebrow text-12 text-muted tabular-nums">
                  {t(`cards.${card.id}.capacity`)}
                </p>
                <h3 className="font-sans text-20 font-medium leading-tight text-black text-balance">
                  {t(`cards.${card.id}.name`)}
                </h3>
                <p className="text-14 leading-relaxed text-muted text-pretty">{t(`cards.${card.id}.includes`)}</p>
                <div className="mt-auto pt-4">
                  <CtaButton href={detail ? card.detailHref : card.href} variant="dark">
                    {detail ? t("viewCta") : t("bookCta")}
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
