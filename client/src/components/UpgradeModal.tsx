import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { CheckoutPlanId } from "@/constants/checkout-plans";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string;
  targetPlan?: CheckoutPlanId;
}

const PREMIUM_BENEFITS = [
  "Gestão completa da sua empresa",
  "Relatórios em PDF com visão detalhada",
  "Organização automática das categorias",
  "Atendimento prioritário e ajuda na configuração",
];

export default function UpgradeModal({ open, onOpenChange, featureName, targetPlan = "premium" }: UpgradeModalProps) {
  const { user } = useAuth();

  const planLabel = (() => {
    const plan = user?.plan ?? "free";
    if (plan === "premium") return "Premium";
    if (plan === "pro") return "Pro";
    return "Free";
  })();

  const handleUpgradeNow = () => {
    const params = new URLSearchParams({
      plan: targetPlan,
      checkout: "upgrade",
    });
    window.location.href = `/settings?${params.toString()}`;
  };

  const handleLearnMore = () => {
    onOpenChange(false);
    window.location.href = "/settings#planos";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-poppins text-2xl flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Recurso Premium
            </DialogTitle>
            <DialogDescription>
              {featureName
                ? `Ative ${featureName} no plano Premium e veja os detalhes na área de planos.`
                : "Ative recursos avançados ao mudar para o plano Premium."}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border bg-muted/40 p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Plano atual</p>
            <Badge variant="secondary" className="w-fit flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" />
              {planLabel === "Premium" ? "Premium" : `Plano ${planLabel}`}
            </Badge>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Benefícios do Premium</p>
            <ul className="space-y-2">
              {PREMIUM_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button className="flex-1" onClick={handleUpgradeNow}>
              Ver planos
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleLearnMore}>
              Entenda os diferenciais
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
