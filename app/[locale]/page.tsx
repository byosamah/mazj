import {setRequestLocale} from "next-intl/server";
import Hero from "@/components/Hero";
import USP from "@/components/USP";
import FoundingBand from "@/components/FoundingBand";
import SpacesGrid from "@/components/SpacesGrid";
import HostEvent from "@/components/HostEvent";
// Steps ("How it works" 01/02/03) is hidden for now; restore by uncommenting here and below.
// import Steps from "@/components/Steps";
import WhyMazj from "@/components/WhyMazj";
import Network from "@/components/Network";
import LocationHours from "@/components/LocationHours";
import FaqSection from "@/components/FaqSection";
import StepInto from "@/components/StepInto";

export default async function Home({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);

  return (
    <main id="content" tabIndex={-1} className="w-full overflow-x-hidden">
      {/* Section order is "believe, then buy": the problem/mission (WhyMazj)
          and community (Network) qualify the visitor before the bookable
          catalogue (SpacesGrid → HostEvent), and the niche startups offer
          (FoundingBand) lands last, after its audience is warmed. USP's airy
          cream cuts straight into WhyMazj's dark full-bleed photos as the
          mid-page contrast beat. Tail (Location → FAQ → StepInto) unchanged. */}
      <Hero />
      <USP />
      <WhyMazj />
      <Network />
      <SpacesGrid />
      <HostEvent />
      {/* <Steps /> */}
      <FoundingBand />
      <LocationHours surface="bg-beige-card" />
      {/* Landing shows a teaser; /faq carries the full categorised set. */}
      <FaqSection limit={6} />
      <StepInto />
    </main>
  );
}
