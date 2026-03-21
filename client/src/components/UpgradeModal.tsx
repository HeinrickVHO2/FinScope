import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Shield, ArrowRightLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { CheckoutPlanId } from "@/constants/checkout-plans";
import { getBillingPlan, type BillingPlanId } from "@shared/plans";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string;
  targetPlan?: CheckoutPlanId;
}

export default function UpgradeModal({
  open,
  onOpenChange,
  featureName,
  targetPlan = "premium",
}: UpgradeModalProps) {
  const { user } = useAuth();
  const currentPlanId = (user?.plan as BillingPlanId | undefined) ?? "pro";
  const currentPlan = getBillingPlan(currentPlanId);
  const nextPlan = getBillingPlan(targetPlan);

  const handleUpgradeNow = () => {
    const params = new URLSearchParams({
      plan: targetPlan,
      checkout: "upgrade",
    });
    window.location.href = `/settings?${params.toString()}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-poppins text-2xl">
            <Crown className="h-5 w-5 text-primary" />
            Disponível no {nextPlan.shortName}
          </DialogTitle>
          <DialogDescription>
            {featureName
              ? `${featureName} fica disponível ao mudar para o ${nextPlan.shortName}.`
              : `Veja o que muda ao trocar seu plano.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-2xl border bg-muted/40 p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano atual</p>
            <Badge variant="secondary" className="w-fit flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              {currentPlan.name}
            </Badge>
            <p className="font-poppins text-lg font-semibold">{currentPlan.priceLabel}</p>
            {currentPlan.commercialCopy.dailyPriceLabel ? (
              <p className="text-xs font-medium text-primary">{currentPlan.commercialCopy.dailyPriceLabel}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">{currentPlan.comparisonSummary}</p>
          </div>
          <div className="flex items-center justify-center text-muted-foreground">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-primary">Plano alvo</p>
            <Badge className="w-fit">{nextPlan.name}</Badge>
            <p className="font-poppins text-lg font-semibold">{nextPlan.priceLabel}</p>
            {nextPlan.commercialCopy.dailyPriceLabel ? (
              <p className="text-xs font-medium text-primary">{nextPlan.commercialCopy.dailyPriceLabel}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">{nextPlan.comparisonSummary}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-slate-900">{nextPlan.commercialCopy.upsellSupport}</p>
          <p className="mt-1 text-sm text-muted-foreground">{nextPlan.commercialCopy.checkoutSupport}</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">O que muda no {nextPlan.shortName}</p>
          <ul className="space-y-2">
            {nextPlan.modalHighlights.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 text-primary" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button className="flex-1" onClick={handleUpgradeNow}>
            Continuar para o checkout
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
