import {useTranslations} from "next-intl";
import Reveal from "./Reveal";

export default function USP() {
  const t = useTranslations("Usp");

  const rows = [
    {
      surtitle: t("saveSurtitle"),
      title: t("saveTitle"),
      image: "/images/usp-save.jpg",
      side: "right" as const,
    },
    {
      surtitle: t("protectSurtitle"),
      title: t("protectTitle"),
      image: "/images/usp-protect.jpg",
      side: "left" as const,
    },
    {
      surtitle: t("controlSurtitle"),
      title: t("controlTitle"),
      image: "/images/usp-control.jpg",
      side: "right" as const,
    },
  ];

  return (
    <section className="relative z-10 w-full bg-beige">
      {/* faint hairline design grid */}
      <div className="grid-overlay" aria-hidden="true" />
      <ul className="relative z-[2] mx-auto flex max-w-[1400px] flex-col">
        {rows.map((row, i) => (
          <li
            key={i}
            data-fx="pin-card"
            className="relative grid min-h-svh grid-cols-1 items-center gap-10 px-6 py-20 lg:grid-cols-[1fr_1.4fr_1fr] lg:gap-16 lg:px-8"
          >
            <div
              className={`order-2 flex justify-center lg:order-none lg:row-start-1 ${
                row.side === "right" ? "lg:col-start-3" : "lg:col-start-1"
              }`}
            >
              <div
                data-pin-media
                className="relative aspect-[4/5] w-full max-w-[230px] overflow-clip rounded-[16px] lg:max-w-[355px] after:pointer-events-none after:absolute after:inset-0 after:rounded-[16px] after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] after:content-['']"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={row.image} alt={row.surtitle} className="h-full w-full object-cover" />
              </div>
            </div>

            <Reveal
              className="order-1 flex flex-col items-center gap-5 text-center lg:order-none lg:col-start-2 lg:row-start-1"
              delay={80}
            >
              <p className="eyebrow text-12 text-muted">{row.surtitle}</p>
              <h2 className="whitespace-pre-line text-balance font-sans text-32 font-medium leading-[1.05] text-black lg:text-50">
                {row.title}
              </h2>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
