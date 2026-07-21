import {useTranslations} from "next-intl";
import Reveal from "./Reveal";

/** Interior shots reused from the existing space library (rekaz originals). */
const GALLERY = [
  "/images/spaces/office-day.jpg",
  "/images/spaces/membership.jpg",
  "/images/spaces/event.jpg",
] as const;

/**
 * The space + honest proof. Review volume is thin, so instead of leaning on a
 * rating we lead with unfalsifiable legitimacy signals (real address, staffed
 * hours, 24/7 fingerprint, VAT-registered) and the real rooms. Testimonials
 * return here once real member quotes exist.
 */
export default function Proof() {
  const t = useTranslations("Proof");
  const legitimacy = t.raw("legitimacy") as string[];

  return (
    <section className="relative w-full bg-beige px-6 py-24 lg:px-10 lg:py-32">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-14">
        <Reveal className="flex flex-col items-center gap-6 text-center">
          <p className="eyebrow text-12 text-muted">{t("eyebrow")}</p>
          <h2 className="whitespace-pre-line text-balance font-sans text-32 font-medium leading-[1.05] text-black lg:text-50">
            {t("title")}
          </h2>
          {/* Legitimacy row: unfalsifiable trust signals, the honest proof to
              lead with while the review base is still thin. */}
          <ul className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {legitimacy.map((item, i) => (
              <li key={item} className="flex items-center gap-4">
                {i > 0 && <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-black/25 sm:block" />}
                <span className="eyebrow text-11 tabular-nums text-brown/70">{item}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        {/* Gallery: same rounded frame treatment as the USP imagery */}
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {GALLERY.map((src, i) => (
            <Reveal as="li" key={src} delay={i * 80} className="relative overflow-clip rounded-[4px] after:pointer-events-none after:absolute after:inset-0 after:rounded-[4px] after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] after:content-['']">
              <div className="relative aspect-[4/5] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
