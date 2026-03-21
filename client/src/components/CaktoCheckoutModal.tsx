import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, ArrowRightLeft, Loader2, CreditCard, Clock3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { CHECKOUT_PLAN_OPTIONS, type CheckoutPlanId } from "@/constants/checkout-plans";
import { apiFetch } from "@/lib/api";

type CheckoutIntent = "signup" | "upgrade";

interface CaktoCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent: CheckoutIntent;
  initialPlanId?: CheckoutPlanId | null;
  onFinished?: () => void;
}

export default function CaktoCheckoutModal({
  open,
  onOpenChange,
  intent,
  initialPlanId = null,
  onFinished,
}: CaktoCheckoutModalProps) {
  const { toast } = useToast();
  const { refetchUser, user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlanId | null>(null);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentPlan = (user?.plan as CheckoutPlanId | undefined) ?? null;
  const hasSelectablePlan =
    intent !== "upgrade" ? true : CHECKOUT_PLAN_OPTIONS.some((plan) => plan.id !== currentPlan);

  useEffect(() => {
    if (!open) {
      setSelectedPlan(null);
      setCheckoutUrl(null);
      setErrorMessage(null);
      setIsCreatingCheckout(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (intent === "upgrade") {
      const defaultPlan =
        (initialPlanId && initialPlanId !== currentPlan
          ? initialPlanId
          : CHECKOUT_PLAN_OPTIONS.find((plan) => plan.id !== currentPlan)?.id) ?? null;
      setSelectedPlan(defaultPlan);
    } else {
      setSelectedPlan(initialPlanId);
    }
  }, [open, intent, currentPlan, initialPlanId]);

  const currentPlanOption = useMemo(
    () => CHECKOUT_PLAN_OPTIONS.find((plan) => plan.id === currentPlan) ?? null,
    [currentPlan],
  );
  const selectedPlanOption = useMemo(
    () => CHECKOUT_PLAN_OPTIONS.find((plan) => plan.id === selectedPlan) ?? null,
    [selectedPlan],
  );

  const dialogTitle = intent === "signup" ? "Escolha um plano para começar" : "Alterar plano";
  const subtitle = useMemo(() => {
    if (intent === "signup") {
      return "Veja o preço atual, compare as diferenças e conclua o pagamento sem sair do FinScope.";
    }
    return "Revise seu plano atual, compare o plano alvo e siga para o checkout com contexto claro.";
  }, [intent]);

  async function createCheckout() {
    if (!selectedPlan) {
      toast({
        title: "Escolha um plano",
        description: "Escolha entre Pro ou Premium para continuar.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingCheckout(true);
    setErrorMessage(null);

    try {
      const response = await apiFetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          plan: selectedPlan,
          mode: intent === "upgrade" ? "upgrade" : "trial",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Não foi possível abrir a tela de pagamento.");
      }

      setCheckoutUrl(data.checkoutUrl);
      await refetchUser();
    } catch (error) {
      const message = (error as Error).message || "Não conseguimos abrir o pagamento agora.";
      setErrorMessage(message);
      toast({
        title: "Não foi possível abrir o pagamento",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingCheckout(false);
    }
  }

  const handleFinish = async () => {
    await refetchUser();
    onFinished?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full">
        <DialogHeader>
          <DialogTitle className="font-poppins text-2xl">{dialogTitle}</DialogTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </DialogHeader>

        {!checkoutUrl ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                <Clock3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-primary">Garantia total de 10 dias</p>
                <p className="text-muted-foreground">
                  Se o FinScope não fizer sentido para você dentro de 10 dias, devolvemos 100% do valor sem perguntas.
                </p>
              </div>
            </div>

            {intent === "upgrade" && selectedPlanOption && (
              <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano atual</p>
                  <p className="mt-2 font-poppins text-lg font-semibold">{currentPlanOption?.name ?? "Plano atual"}</p>
                  <p className="text-sm text-muted-foreground">{currentPlanOption?.price ?? ""}</p>
                  {currentPlanOption?.commercialCopy.dailyPriceLabel ? (
                    <p className="mt-1 text-xs font-medium text-primary">
                      {currentPlanOption.commercialCopy.dailyPriceLabel}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-muted-foreground">{currentPlanOption?.comparisonSummary ?? ""}</p>
                </div>
                <div className="flex items-center justify-center text-muted-foreground">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-primary">Plano alvo</p>
                  <p className="mt-2 font-poppins text-lg font-semibold">{selectedPlanOption.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedPlanOption.price}</p>
                  {selectedPlanOption.commercialCopy.dailyPriceLabel ? (
                    <p className="mt-1 text-xs font-medium text-primary">
                      {selectedPlanOption.commercialCopy.dailyPriceLabel}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-muted-foreground">{selectedPlanOption.comparisonSummary}</p>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {CHECKOUT_PLAN_OPTIONS.map((plan) => {
                const isCurrentPlan = intent === "upgrade" && currentPlan === plan.id;
                const isSelected = selectedPlan === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      if (isCurrentPlan) return;
                      setSelectedPlan(plan.id);
                    }}
                    disabled={isCurrentPlan}
                    className={`rounded-xl border p-5 text-left transition-all ${
                      isSelected ? "border-primary shadow-md ring-2 ring-primary/10" : "border-border hover:border-primary/60"
                    } ${isCurrentPlan ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-poppins text-lg font-semibold">{plan.name}</p>
                        <p className="text-sm text-muted-foreground">{plan.price}</p>
                        {plan.commercialCopy.dailyPriceLabel ? (
                          <p className="mt-1 text-xs font-medium text-primary">{plan.commercialCopy.dailyPriceLabel}</p>
                        ) : null}
                      </div>
                      <div className="flex gap-1">
                        {plan.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {plan.badge}
                          </Badge>
                        )}
                        {isCurrentPlan && (
                          <Badge variant="outline" className="text-xs">
                            Plano atual
                          </Badge>
                        )}
                      </div>
                    </div>

                    <p className="mt-3 text-sm font-medium text-slate-900">{plan.marketingHeadline}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                    <p className="mt-2 text-sm text-slate-700">{plan.commercialCopy.checkoutSupport}</p>

                    <ul className="mt-4 space-y-2 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-secondary" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                      {plan.modalHighlights.join(" • ")}
                    </div>
                  </button>
                );
              })}
            </div>

            {intent === "upgrade" && !hasSelectablePlan && (
              <p className="text-sm text-muted-foreground">Você já está no plano mais completo disponível.</p>
            )}
            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={createCheckout} disabled={!selectedPlan || isCreatingCheckout || !hasSelectablePlan}>
                {isCreatingCheckout ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparando pagamento
                  </>
                ) : (
                  <>Continuar para o checkout</>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCheckoutUrl(null)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Trocar plano
              </Button>
              <p className="text-xs text-muted-foreground">
                Se preferir,{" "}
                <a href={checkoutUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                  abra o pagamento em outra aba
                </a>
                .
              </p>
            </div>

            <div className="h-[520px] overflow-hidden rounded-xl border bg-muted/30">
              <iframe
                key={checkoutUrl}
                src={checkoutUrl}
                title="Checkout Cakto"
                className="h-full w-full border-0"
                allow="payment *"
              />
            </div>

            <div className="flex flex-col justify-between gap-3 rounded-lg border bg-background p-4 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Conclua o pagamento</p>
                  <p className="text-sm text-muted-foreground">
                    Após confirmar o pagamento, clique em <strong>Verificar pagamento</strong> para atualizar o status.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sua assinatura continua com 10 dias de garantia para solicitar reembolso integral.
                  </p>
                </div>
              </div>
              <Button onClick={handleFinish}>Verificar pagamento</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
