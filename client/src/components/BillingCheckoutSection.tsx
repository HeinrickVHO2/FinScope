import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHECKOUT_PLAN_OPTIONS, type CheckoutPlanId } from "@/constants/checkout-plans";
import { Check, Clock3, ArrowLeft, Loader2, CreditCard } from "lucide-react";
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
  title = "Finalize sua assinatura agora",
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
      return "Escolha seu plano e finalize por aqui mesmo. Pagamento confirmado na hora com 10 dias de garantia total.";
    }
    return "Troque de plano em segundos. Toda nova cobrança também possui 10 dias de garantia para reembolso.";
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
        title: "Selecione um plano",
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
        throw new Error(data.error || "Não foi possível iniciar o checkout");
      }
      setCheckoutUrl(data.checkoutUrl);
    } catch (error) {
      const message = (error as Error).message || "Erro inesperado ao iniciar checkout";
      setErrorMessage(message);
      toast({
        title: "Erro ao iniciar checkout",
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
          description: "Finalize o checkout e tente novamente em instantes.",
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
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Clock3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-primary">Garantia total de 10 dias</p>
                <p className="text-muted-foreground">
                  Se o FinScope não fizer sentido para você dentro desse período, devolvemos 100% do valor sem perguntas.
                </p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {CHECKOUT_PLAN_OPTIONS.map((plan) => {
                const isCurrent = intent === "upgrade" && normalizedCurrentPlan === plan.id;
                return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    if (isCurrent) return;
                    setSelectedPlan(plan.id);
                  }}
                  disabled={isCurrent}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    selectedPlan === plan.id ? "border-primary shadow-md" : "border-border hover:border-primary/60"
                  } ${isCurrent ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-poppins text-lg font-semibold">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">{plan.price}</p>
                    </div>
                    <div className="flex gap-1">
                      {plan.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {plan.badge}
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="outline" className="text-xs">
                          Plano atual
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-secondary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
                );
              })}
            </div>
            {intent === "upgrade" && !hasSelectablePlan && (
              <p className="text-sm text-muted-foreground">
                Você já está no plano Premium. Nenhum outro plano disponível para upgrade.
              </p>
            )}
            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
            <div className="flex justify-end">
              <Button onClick={createCheckout} disabled={!selectedPlan || isCreatingCheckout || !hasSelectablePlan}>
                {isCreatingCheckout ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Preparando checkout
                  </>
                ) : (
                  <>Continuar para pagamento</>
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCheckoutUrl(null)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Trocar plano
              </Button>
              <p className="text-xs text-muted-foreground">
                Se preferir, {""}
                <a href={checkoutUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                  abra o checkout em outra aba
                </a>.
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 h-[520px] overflow-hidden">
              <iframe
                key={checkoutUrl}
                src={checkoutUrl}
                title="Checkout Cakto"
                className="w-full h-full border-0"
                allow="payment *"
              />
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border rounded-lg p-4 bg-background">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Finalize o pagamento no painel</p>
                  <p className="text-sm text-muted-foreground">
                    Seu acesso é liberado automaticamente. Caso continue vendo esta tela, clique em <strong>Verificar pagamento</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Verificamos em segundo plano para você não se preocupar.</p>
                </div>
              </div>
              <Button onClick={() => verifyPayment(true)} disabled={isVerifying}>
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
