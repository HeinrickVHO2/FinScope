import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CreditCard } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { CaktoCheckoutModal } from "@/components/CaktoCheckoutModal";

export default function BillingSettingsPage() {
  const [, setLocation] = useLocation();
  const { refetchUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(true);

  useEffect(() => {
    setIsModalOpen(true);
  }, []);

  return (
    <>
      <div className="p-6 space-y-6">
        <Button
          variant="ghost"
          className="flex items-center gap-2"
          onClick={() => setLocation("/settings")}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para configurações
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="font-poppins text-2xl flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              Upgrade de Plano
            </CardTitle>
            <CardDescription>
              Escolha um novo plano e finalize a assinatura pelo checkout seguro da Cakto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O plano atual será cancelado imediatamente e um novo será criado. Você continua com 10 dias de garantia para solicitar reembolso caso não esteja satisfeito.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setIsModalOpen(true)}>Abrir checkout</Button>
              <Button variant="outline" onClick={() => setLocation("/settings")}>
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
            setLocation("/settings");
          }
        }}
        intent="upgrade"
        onFinished={async () => {
          await refetchUser();
          setLocation("/settings");
        }}
      />
    </>
  );
}
