import type {Metadata} from "next";
import {setRequestLocale} from "next-intl/server";
import {pageMetadata} from "@/lib/metadata";
import {useTranslations} from "next-intl";
import PageIntro from "@/components/PageIntro";
import Reveal from "@/components/Reveal";
import CtaButton from "@/components/CtaButton";
import Footer from "@/components/Footer";
import {BOOKING} from "@/lib/links";

/** Plan order + booking destinations. Names/blurbs come from i18n. */
const PLANS = [
  {id: "dayPass", href: BOOKING.dayDesk},
  {id: "membership", href: BOOKING.membership},
  {id: "officeDaily", href: BOOKING.officeDay},
  {id: "officeMonthly", href: BOOKING.officeMonth},
  {id: "meetingRoom", href: BOOKING.meeting},
  {id: "eventHall", href: BOOKING.event},
] as const;

function Content() {
  const t = useTranslations("PricingPage");

  return (
    <>
      <PageIntro eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")} />
      <section className="relative w-full bg-beige px-6 pb-24 pt-4 lg:px-10 lg:pb-32">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-10">
          {/* Live prices + checkout stay on mazj.sa by design: no SAR on this site. */}
          <Reveal>
            <p className="max-w-[620px] font-mono text-12 uppercase tracking-[0.05em] text-muted">
              {t("note")}
            </p>
          </Reveal>

          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PLANS.map((plan, i) => (
              <Reveal
                as="li"
                key={plan.id}
                delay={Math.min(i, 3) * 60}
                className="flex flex-col gap-3 rounded-[16px] bg-white p-7 shadow-[0_10px_32px_rgba(0,0,0,0.08)]"
              >
                <h2 className="font-sans text-20 font-medium leading-tight text-black">
                  {t(`plans.${plan.id}.name`)}
                </h2>
                <p className="text-14 leading-relaxed text-muted">{t(`plans.${plan.id}.desc`)}</p>
                <div className="mt-auto pt-4">
                  <CtaButton href={plan.href} variant="dark">
                    {t("seeCta")}
                  </CtaButton>
                </div>
              </Reveal>
            ))}
          </ul>
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
  return pageMetadata(locale, "PricingPage", "/pricing");
}

export default async function PricingPage({
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
