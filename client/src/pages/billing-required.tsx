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
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user?.billingStatus === "active") {
      setLocation("/dashboard");
    }
  }, [isLoading, user?.billingStatus, setLocation]);

  useEffect(() => {
    const query = location.split("?")[1] || "";
    if (query.includes("autoOpen=1")) {
      setModalOpen(true);
    }
  }, [location]);

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

  const checkoutIntent = user.plan === "free" ? "signup" : "upgrade";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Card className="border-destructive/40">
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <CardTitle className="font-poppins text-2xl">
              Pagamento pendente
            </CardTitle>
          </div>
          <CardDescription>
            Ainda não recebemos a confirmação da Cakto. Conclua o checkout para liberar o acesso ao dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Assim que a Cakto confirmar a compra, seu plano será ativado automaticamente e você será redirecionado para o dashboard.
            Você continua coberto pela nossa garantia de 10 dias: se cancelar nesse período, devolvemos todo o valor.
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
            Se você já confirmou o pagamento, clique em &quot;Verificar pagamento&quot; e aguarde alguns segundos.
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
