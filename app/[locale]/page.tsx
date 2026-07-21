import {setRequestLocale} from "next-intl/server";
import Hero from "@/components/Hero";
import USP from "@/components/USP";
import FoundingBand from "@/components/FoundingBand";
import SpacesGrid from "@/components/SpacesGrid";
import HostEvent from "@/components/HostEvent";
import Steps from "@/components/Steps";
import WhyMazj from "@/components/WhyMazj";
import Network from "@/components/Network";
import LocationHours from "@/components/LocationHours";
import FaqSection from "@/components/FaqSection";
import StepInto from "@/components/StepInto";
import Footer from "@/components/Footer";

export default async function Home({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  return (
    <main id="content" tabIndex={-1} className="w-full overflow-x-hidden">
      <Hero />
      <USP />
      <FoundingBand />
      <SpacesGrid />
      <HostEvent />
      <Steps />
      <WhyMazj />
      <Network />
      <LocationHours />
      {/* Landing shows a teaser; /faq carries the full categorised set. */}
      <FaqSection limit={6} />
      <StepInto />
      <Footer />
    </main>
  );
}
