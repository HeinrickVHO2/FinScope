import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CreditCard } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { CaktoCheckoutModal } from "@/components/CaktoCheckoutModal";

export default function BillingSettingsPage() {
  const [, setLocation] = useLocation();
  const { user, refetchUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const returnPath = useMemo(() => {
    if (typeof window === "undefined") return "/dashboard";
    const params = new URLSearchParams(window.location.search);
    return params.get("return") || "/dashboard";
  }, []);

  useEffect(() => {
    setIsModalOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoOpen") === "1") {
      setIsModalOpen(true);
      params.delete("autoOpen");
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState(null, "", next || window.location.pathname);
    }
  }, []);

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
              Abriremos o checkout seguro para que você finalize ou atualize sua assinatura.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Após concluir o pagamento, volte para esta tela e clique em "Verificar pagamento" para liberar o acesso.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setIsModalOpen(true)}>Abrir checkout</Button>
              <Button variant="outline" onClick={() => setLocation(returnPath)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <CaktoCheckoutModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setLocation(returnPath);
          }
        }}
        intent={checkoutIntent}
        onFinished={async () => {
          await refetchUser();
          setLocation(returnPath);
        }}
      />
    </>
  );
}
