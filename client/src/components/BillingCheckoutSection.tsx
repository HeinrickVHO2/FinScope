import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHECKOUT_PLAN_OPTIONS, type CheckoutPlanId } from "@/constants/checkout-plans";
import { Check, Clock3, ArrowLeft, ArrowRightLeft, Loader2, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface BillingCheckoutSectionProps {
  intent: "signup" | "upgrade";
  currentPlan?: string;
  autoVerify?: boolean;
  title?: string;
  subtitle?: string;
  onFinished?: () => Promise<void> | void;
  className?: string;
  initialPlanId?: CheckoutPlanId | null;
}

export function BillingCheckoutSection({
  intent,
  currentPlan,
  autoVerify,
  title = "Escolha seu plano",
  subtitle,
  onFinished,
  className,
  initialPlanId = null,
}: BillingCheckoutSectionProps) {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlanId | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const normalizedCurrentPlan = (currentPlan?.toLowerCase() ?? null) as CheckoutPlanId | null;
  const currentPlanOption = useMemo(
    () => CHECKOUT_PLAN_OPTIONS.find((plan) => plan.id === normalizedCurrentPlan) ?? null,
    [normalizedCurrentPlan],
  );
  const selectedPlanOption = useMemo(
    () => CHECKOUT_PLAN_OPTIONS.find((plan) => plan.id === selectedPlan) ?? null,
    [selectedPlan],
  );
  const hasSelectablePlan =
    intent !== "upgrade" ? true : CHECKOUT_PLAN_OPTIONS.some((plan) => plan.id !== normalizedCurrentPlan);

  useEffect(() => {
    setCheckoutUrl(null);
    setErrorMessage(null);
    setIsCreatingCheckout(false);
    setIsVerifying(false);
    stopPolling();

    if (intent === "upgrade") {
      const defaultPlan =
        (initialPlanId && initialPlanId !== normalizedCurrentPlan
          ? initialPlanId
          : CHECKOUT_PLAN_OPTIONS.find((plan) => plan.id !== normalizedCurrentPlan)?.id) ?? null;
      setSelectedPlan(defaultPlan);
    } else {
      setSelectedPlan(initialPlanId);
    }
  }, [intent, normalizedCurrentPlan, initialPlanId]);

  const computedSubtitle = useMemo(() => {
    if (subtitle) return subtitle;
    if (intent === "signup") {
      return "Compare os planos com preço, recursos e diferenças antes de seguir para o checkout.";
    }
    return "Revise seu plano atual, veja o plano alvo e siga para o checkout com contexto claro.";
  }, [intent, subtitle]);

  const shouldAutoVerify = autoVerify ?? intent === "signup";

  useEffect(() => {
    if (checkoutUrl && shouldAutoVerify) {
      startPolling();
    } else {
      stopPolling();
    }
    return stopPolling;
  }, [checkoutUrl, shouldAutoVerify]);

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      verifyPayment(false);
    }, 4000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

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

  async function verifyPayment(manual = true) {
    try {
      if (manual) setIsVerifying(true);
      const response = await apiFetch("/api/auth/me", { credentials: "include" });
      if (!response.ok) return;
      const user = await response.json();
      const ready = user?.billingStatus === "active";
      let success = ready;

      if (intent === "upgrade") {
        const planChanged = !!currentPlan && user?.plan && user.plan !== currentPlan;
        const matchesSelection = selectedPlan ? user?.plan === selectedPlan : true;
        success = ready && planChanged && matchesSelection;
      }

      if (success) {
        stopPolling();
        toast({
          title: "Pagamento confirmado",
          description: "Atualizamos seu acesso automaticamente.",
        });
        await onFinished?.();
      } else if (manual) {
        toast({
          title: "Pagamento ainda pendente",
          description: "Conclua o pagamento e tente novamente em instantes.",
        });
      }
    } finally {
      if (manual) setIsVerifying(false);
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="space-y-2">
        <CardTitle className="font-poppins text-2xl">{title}</CardTitle>
        <CardDescription>{computedSubtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!checkoutUrl ? (
          <>
            <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                <Clock3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-primary">Garantia total de 10 dias</p>
                <p className="text-muted-foreground">
                  Se o FinScope não fizer sentido para você dentro desse período, devolvemos 100% do valor.
                </p>
              </div>
            </div>

            {intent === "upgrade" && currentPlanOption && selectedPlanOption ? (
              <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano atual</p>
                  <p className="mt-2 font-poppins text-lg font-semibold">{currentPlanOption.name}</p>
                  <p className="text-sm text-muted-foreground">{currentPlanOption.price}</p>
                  {currentPlanOption.commercialCopy.dailyPriceLabel ? (
                    <p className="mt-1 text-xs font-medium text-primary">
                      {currentPlanOption.commercialCopy.dailyPriceLabel}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-muted-foreground">{currentPlanOption.comparisonSummary}</p>
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
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              {CHECKOUT_PLAN_OPTIONS.map((plan) => {
                const isCurrent = intent === "upgrade" && normalizedCurrentPlan === plan.id;
                const isSelected = selectedPlan === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      if (isCurrent) return;
                      setSelectedPlan(plan.id);
                    }}
                    disabled={isCurrent}
                    className={`rounded-xl border p-5 text-left transition-all ${
                      isSelected ? "border-primary shadow-md ring-2 ring-primary/10" : "border-border hover:border-primary/60"
                    } ${isCurrent ? "cursor-not-allowed opacity-60" : ""}`}
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
                        {plan.badge ? (
                          <Badge variant="secondary" className="text-xs">
                            {plan.badge}
                          </Badge>
                        ) : null}
                        {isCurrent ? (
                          <Badge variant="outline" className="text-xs">
                            Plano atual
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-3 text-sm font-medium text-slate-900">{plan.marketingHeadline}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                    <p className="mt-2 text-sm text-slate-700">{plan.commercialCopy.checkoutSupport}</p>

                    <ul className="mt-4 space-y-2 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 text-secondary" />
                          <span>{feature}</span>
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

            {intent === "upgrade" && !hasSelectablePlan ? (
              <p className="text-sm text-muted-foreground">Você já está no plano mais completo disponível.</p>
            ) : null}
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

            <div className="flex justify-end">
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
          </>
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
              <iframe key={checkoutUrl} src={checkoutUrl} title="Checkout Cakto" className="h-full w-full border-0" allow="payment *" />
            </div>

            <div className="flex flex-col justify-between gap-4 rounded-lg border bg-background p-4 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Conclua o pagamento</p>
                  <p className="text-sm text-muted-foreground">
                    Seu acesso é liberado automaticamente. Caso continue vendo esta tela, clique em <strong>Verificar pagamento</strong>.
                  </p>
                </div>
              </div>
              <Button onClick={() => verifyPayment(true)} disabled={isVerifying}>
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>Verificar pagamento</>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
