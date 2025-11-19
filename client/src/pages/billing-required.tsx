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
    <div className="p-6 max-w-3xl mx-auto">
      <BillingCheckoutSection
        intent={checkoutIntent}
        initialPlan={user.plan}
        onFinished={refetchUser}
      />
    </div>
  );
}
