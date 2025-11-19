import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CreditCard } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { BillingCheckoutSection } from "@/components/BillingCheckoutSection";

export default function BillingSettingsPage() {
  const [, setLocation] = useLocation();
  const { user, refetchUser } = useAuth();
  const returnPath = (() => {
    if (typeof window === "undefined") return "/dashboard";
    const params = new URLSearchParams(window.location.search);
    return params.get("return") || "/dashboard";
  })();

  const checkoutIntent = user?.billingStatus === "active" ? "upgrade" : "signup";

  return (
    <>
      <div className="p-6 space-y-6">
        <Button
          variant="ghost"
          className="flex items-center gap-2"
          onClick={() => setLocation(returnPath)}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="font-poppins text-2xl flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              Confirme seu pagamento
            </CardTitle>
            <CardDescription>
              Revise os planos disponíveis e conclua o checkout diretamente nesta página.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            Após concluir o pagamento, clique em “Verificar pagamento” para atualizar o acesso.
          </CardContent>
        </Card>
      </div>

      <div className="px-6 pb-10">
        <BillingCheckoutSection
          intent={checkoutIntent}
          onFinished={async () => {
            await refetchUser();
            setLocation(returnPath);
          }}
        />
      </div>
    </>
  );
}
