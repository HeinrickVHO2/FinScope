import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { CaktoCheckoutModal } from "@/components/CaktoCheckoutModal";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";

export default function BillingRequiredPage() {
  const { user, isLoading, refetchUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user?.billingStatus === "active") {
      setLocation("/dashboard");
    }
  }, [isLoading, user?.billingStatus, setLocation]);

  useEffect(() => {
    setModalOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoOpen") === "1") {
      setModalOpen(true);
      params.delete("autoOpen");
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState(null, "", next || window.location.pathname);
    }
  }, []);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-full w-full py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Carregando seu status de cobrança...</p>
        </div>
      </div>
    );
  }

  const checkoutIntent = user.billingStatus === "active" ? "upgrade" : "signup";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Card className="border-destructive/40">
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <CardTitle className="font-poppins text-2xl">
              Estamos tentando confirmar seu pagamento
            </CardTitle>
          </div>
          <CardDescription>
            Assim que a operadora confirmar o pagamento, liberaremos imediatamente seu acesso ao FinScope.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Caso o checkout precise ser reaberto, utilize os botões abaixo para retomar o processo.
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="flex-1" onClick={() => setModalOpen(true)}>
              Abrir checkout novamente
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={async () => {
                await refetchUser();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar pagamento
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Prefere abrir o checkout em outra página? {""}
            <button
              onClick={() => setLocation("/billing?return=/billing-required&autoOpen=1")}
              className="text-primary underline"
            >
              Clique aqui
            </button>.
          </p>
        </CardContent>
      </Card>

      <CaktoCheckoutModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        intent={checkoutIntent}
        onFinished={async () => {
          await refetchUser();
        }}
      />
    </div>
  );
}
