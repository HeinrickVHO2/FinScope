import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import { HeroSection } from "@/components/site/HeroSection";
import { PainSolutionSection } from "@/components/site/PainSolutionSection";
import { HowItWorksSection } from "@/components/site/HowItWorksSection";
import { SocialProofSection } from "@/components/site/SocialProofSection";
import { DifferentialsSection } from "@/components/site/DifferentialsSection";
import { DemoSection } from "@/components/site/DemoSection";
import { PricingSection } from "@/components/site/PricingSection";
import { FinalCTASection } from "@/components/site/FinalCTASection";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <FinScopeHeader landingMode />
      <main className="flex flex-col gap-0 bg-white">
        <HeroSection />
        <PainSolutionSection />
        <HowItWorksSection />
        <DemoSection />
        <DifferentialsSection />
        <SocialProofSection />
        <PricingSection />
        <FinalCTASection />
      </main>
      <FinScopeFooter />
    </div>
  );
}
