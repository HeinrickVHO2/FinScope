import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft, Loader2, CreditCard, Clock3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

type CheckoutIntent = "signup" | "upgrade";

interface CaktoCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent: CheckoutIntent;
  onFinished?: () => void;
}

const PLAN_OPTIONS = [
    {
      id: "pro",
      name: "Plano Pro",
      price: "R$ 19,90/mês",
    description: "Para quem precisa organizar as finanças com mais controle.",
    features: [
      "Até 3 contas",
      "Dashboard completo",
      "Alertas de pagamento",
      "Exportação CSV",
    ],
  },
  {
    id: "premium",
    name: "Plano Premium",
    price: "R$ 29,90/mês",
    description: "Tudo do Pro + recursos avançados para empresas e MEI.",
    badge: "Mais popular",
    features: [
      "Contas ilimitadas",
      "Categorização automática",
      "Relatórios avançados",
      "Gestão MEI completa",
    ],
  },
] as const;

export function CaktoCheckoutModal({ open, onOpenChange, intent, onFinished }: CaktoCheckoutModalProps) {
  const { toast } = useToast();
  const { refetchUser } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "premium" | null>(null);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedPlan(null);
      setCheckoutUrl(null);
      setErrorMessage(null);
      setIsCreatingCheckout(false);
    }
  }, [open]);

  const dialogTitle = intent === "signup" ? "Escolha um plano para começar" : "Atualize seu plano";

  const subtitle = useMemo(() => {
    if (intent === "signup") {
      return "Finalize sua assinatura sem sair do FinScope. Caso não curta em até 10 dias, reembolsamos 100% do valor.";
    }
    return "Troque de plano imediatamente. Cancelamos o plano atual e criamos o novo sem período de teste.";
  }, [intent]);

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
      const response = await fetch("/api/checkout/create", {
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
      await refetchUser();
    } catch (error) {
      const message = (error as Error).message || "Erro inesperado ao criar checkout";
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

  const handleFinish = async () => {
    await refetchUser();
    onFinished?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle className="font-poppins text-2xl">{dialogTitle}</DialogTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </DialogHeader>

        {!checkoutUrl ? (
          <div className="space-y-4">
            {intent === "signup" && (
              <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Clock3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-primary">Garantia de 10 dias</p>
                  <p className="text-muted-foreground">
                    Pague agora e, se não gostar em até 10 dias, reembolsamos o valor integral sem burocracia.
                  </p>
                </div>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              {PLAN_OPTIONS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    selectedPlan === plan.id ? "border-primary shadow-md" : "border-border hover:border-primary/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-poppins text-lg font-semibold">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">{plan.price}</p>
                    </div>
                    {plan.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {plan.badge}
                      </Badge>
                    )}
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
              ))}
            </div>
            {errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={createCheckout} disabled={!selectedPlan || isCreatingCheckout}>
                {isCreatingCheckout ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Iniciando checkout
                  </>
                ) : (
                  <>
                    Continuar para pagamento
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCheckoutUrl(null)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Trocar plano
              </Button>
              <p className="text-xs text-muted-foreground">
                Se preferir,{" "}
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border rounded-lg p-4 bg-background">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
              <div>
                <p className="font-medium">Finalize o pagamento no modal</p>
                <p className="text-sm text-muted-foreground">
                  Após confirmar o pagamento, clique em &quot;Verificar pagamento&quot; para atualizar seu acesso.
                </p>
                {intent === "signup" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Lembre-se: você tem 10 dias para testar com tranquilidade. Se cancelar nesse prazo, devolvemos tudo.
                  </p>
                )}
              </div>
            </div>
              <Button onClick={handleFinish}>
                Verificar pagamento
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
