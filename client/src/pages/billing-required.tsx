import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { BillingCheckoutSection } from "@/components/BillingCheckoutSection";

export default function BillingRequiredPage() {
  const { user, isLoading, refetchUser } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && user?.billingStatus === "active") {
      setLocation("/dashboard");
    }
  }, [isLoading, user?.billingStatus, setLocation]);

  if (isLoading || !user) {
    return (
      <div className="flex h-full w-full items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Verificando seu pagamento...</p>
        </div>
      </div>
    );
  }

  const checkoutIntent = user.billingStatus === "active" ? "upgrade" : "signup";

  return (
    <div className="mx-auto max-w-3xl p-6">
      <BillingCheckoutSection
        intent={checkoutIntent}
        currentPlan={user.plan}
        subtitle="Compare os planos com contexto claro. O Premium combina WhatsApp, relatórios avançados e mais automação por menos de R$ 1,33 por dia."
        onFinished={refetchUser}
      />
    </div>
  );
}
