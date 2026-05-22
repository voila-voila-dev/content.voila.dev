import { createFileRoute } from "@tanstack/react-router";

import { ArchitectureSection } from "#/site/sections/architecture";
import { BuiltWithSection } from "#/site/sections/built-with";
import { CommunitySection } from "#/site/sections/community";
import { ComparisonSection } from "#/site/sections/comparison";
import { CtaSection } from "#/site/sections/cta";
import { FaqSection } from "#/site/sections/faq";
import { FeaturesSection } from "#/site/sections/features";
import { HeroSection } from "#/site/sections/hero";
import { HowItWorksSection } from "#/site/sections/how-it-works";
import { RoadmapSection } from "#/site/sections/roadmap";
import { SponsorsSection } from "#/site/sections/sponsors";
import { SiteFooter } from "#/site/site-footer";
import { SiteHeader } from "#/site/site-header";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <HeroSection />
        <BuiltWithSection />
        <FeaturesSection />
        <HowItWorksSection />
        <ArchitectureSection />
        <ComparisonSection />
        <RoadmapSection />
        <SponsorsSection />
        <CommunitySection />
        <FaqSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}
