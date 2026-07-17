import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import CtaButton from "./CtaButton";
import {BOOKING} from "@/lib/links";

/**
 * The four bookable products as cards: photo, name, capacity, one-line
 * "includes", and a CTA. On the landing the CTA books straight on mazj.sa;
 * with `detail`, it links to each space's own page instead (used on /spaces).
 * Prices intentionally never appear here; mazj.sa shows the live price.
 */
const CARDS = [
  {id: "openDesk", href: BOOKING.dayDesk, detailHref: "/spaces/coworking", img: "/images/spaces/day-desk.jpg"},
  {id: "privateOffice", href: BOOKING.officeMonth, detailHref: "/spaces/private-office", img: "/images/spaces/office-month.jpg"},
  {id: "meetingRoom", href: BOOKING.meeting, detailHref: "/spaces/meeting-room", img: "/images/spaces/meeting.jpg"},
  {id: "eventHall", href: BOOKING.event, detailHref: "/spaces/event-hall", img: "/images/spaces/event.jpg"},
] as const;

export default function SpacesGrid({
  detail = false,
  showHeader = true,
}: {
  detail?: boolean;
  showHeader?: boolean;
}) {
  const t = useTranslations("Spaces");

  return (
    <section className="relative w-full bg-beige px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-14">
        {showHeader && (
          <Reveal className="flex flex-col items-center gap-5 text-center">
            <p className="font-mono text-12 uppercase tracking-[0.05em] text-muted">{t("eyebrow")}</p>
            <h2 className="whitespace-pre-line font-sans text-32 font-medium leading-[1.05] text-black lg:text-50">
              {t("title")}
            </h2>
          </Reveal>
        )}

        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CARDS.map((card, i) => (
            <Reveal
              as="li"
              key={card.id}
              delay={i * 80}
              className="flex flex-col overflow-clip rounded-[16px] bg-white shadow-[0_10px_32px_rgba(0,0,0,0.08)]"
            >
              <div className="relative aspect-[4/3] w-full overflow-clip">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.img}
                  alt={t(`cards.${card.id}.name`)}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-3 p-6">
                <p className="font-mono text-12 uppercase tracking-[0.05em] text-muted">
                  {t(`cards.${card.id}.capacity`)}
                </p>
                <h3 className="font-sans text-20 font-medium leading-tight text-black">
                  {t(`cards.${card.id}.name`)}
                </h3>
                <p className="text-14 leading-relaxed text-muted">{t(`cards.${card.id}.includes`)}</p>
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
