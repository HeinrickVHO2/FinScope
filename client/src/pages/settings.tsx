import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Check, Crown, Pencil, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { BillingCheckoutSection } from "@/components/BillingCheckoutSection";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CheckoutPlanId } from "@/constants/checkout-plans";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, isLoading, refetchUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [showCheckoutSection, setShowCheckoutSection] = useState(false);
  const [checkoutIntent, setCheckoutIntent] = useState<"signup" | "upgrade">("signup");
  const [selectedPlanId, setSelectedPlanId] = useState<CheckoutPlanId | null>(null);
  const [confirmField, setConfirmField] = useState<"name" | "email" | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setEmail(user.email);
    }
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  const currentPlan = user.plan;
  const displayPlan = user.billingStatus === "active" ? user.plan : "pending";

  useEffect(() => {
    const shouldShow = displayPlan === "pending";
    setShowCheckoutSection(shouldShow);
    setCheckoutIntent(shouldShow ? "signup" : "upgrade");
    if (!shouldShow) {
      setSelectedPlanId(null);
    }
  }, [displayPlan]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const requestedPlan = params.get("plan") as CheckoutPlanId | null;
    const checkoutMode = params.get("checkout");

    if (requestedPlan) {
      setSelectedPlanId(requestedPlan);
    }

    if (checkoutMode === "signup" || checkoutMode === "upgrade" || requestedPlan) {
      setCheckoutIntent(checkoutMode === "signup" ? "signup" : "upgrade");
      setShowCheckoutSection(true);
    }

    if (params.toString()) {
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  const plans = [
    {
      name: "Pro",
      price: "R$ 19,90/mês",
      current: currentPlan === "pro",
      features: ["Até 3 contas", "Dashboard completo", "Alertas de pagamento", "Exportação PDF básico"],
    },
    {
      name: "Premium",
      price: "R$ 29,90/mês",
      current: currentPlan === "premium",
      recommended: true,
      features: ["Contas ilimitadas", "Dashboard avançado", "Categorização automática", "Gestão empresarial completa", "Relatórios PDF"],
    },
  ];

  const handleFieldSaveRequest = (field: "name" | "email") => {
    if (field === "name") {
      if (fullName.trim() === user.fullName) {
        toast({
          title: "Nada para atualizar",
          description: "Seu nome já está salvo com esse valor.",
        });
        return;
      }
    } else if (email.trim() === user.email) {
      toast({
        title: "Nada para atualizar",
        description: "Seu email já está salvo com esse valor.",
      });
      return;
    }
    setConfirmField(field);
  };

  const cancelEditField = (field: "name" | "email") => {
    if (field === "name") {
      setFullName(user.fullName);
      setIsEditingName(false);
    } else {
      setEmail(user.email);
      setIsEditingEmail(false);
    }
  };

  const confirmProfileUpdate = async () => {
    if (!confirmField) return;
    const payload =
      confirmField === "name"
        ? { fullName: fullName.trim() }
        : { email: email.trim() };

    try {
      const field = confirmField;
      setConfirmField(null);
      setIsUpdatingProfile(true);
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível atualizar seu perfil agora.");
      }

      await refetchUser();
      toast({
        title: "Perfil atualizado",
        description:
          field === "name"
            ? "Seu nome foi atualizado com sucesso."
            : "Seu email foi atualizado com sucesso.",
      });
      if (field === "name") {
        setIsEditingName(false);
      } else {
        setIsEditingEmail(false);
      }
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: (error as Error).message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-poppins font-bold" data-testid="text-settings-title">
          Configurações
        </h1>
        <p className="text-muted-foreground" data-testid="text-settings-subtitle">
          Gerencie sua conta e preferências
        </p>
      </div>


      <Card data-testid="card-profile">
        <CardHeader>
          <CardTitle className="font-poppins">Informações Pessoais</CardTitle>
          <CardDescription>Atualize seus dados cadastrais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome Completo</Label>
            <div className="flex items-center gap-2">
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={!isEditingName || isUpdatingProfile}
                data-testid="input-fullname"
              />
              {!isEditingName ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditingName(true)}
                  aria-label="Editar nome"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => cancelEditField("name")}
                    aria-label="Cancelar edição de nome"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={() => handleFieldSaveRequest("name")}
                    aria-label="Salvar nome"
                    disabled={isUpdatingProfile}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!isEditingEmail || isUpdatingProfile}
                data-testid="input-email"
              />
              {!isEditingEmail ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditingEmail(true)}
                  aria-label="Editar email"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => cancelEditField("email")}
                    aria-label="Cancelar edição de email"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={() => handleFieldSaveRequest("email")}
                    aria-label="Salvar email"
                    disabled={isUpdatingProfile}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-current-plan">
        <CardHeader>
          <CardTitle className="font-poppins">Plano Atual</CardTitle>
          <CardDescription>Gerencie sua assinatura</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold font-poppins text-lg" data-testid="text-current-plan-name">
                  {displayPlan === "pending" ? "Pagamento pendente" : `Plano ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {displayPlan === "pending"
                    ? "Conclua o checkout para liberar todos os recursos"
                    : "Assinatura confirmada"}
                </p>
              </div>
            </div>
            {displayPlan === "pending" ? (
              <Button
                variant="outline"
                data-testid="button-finish-payment"
                onClick={() => {
                  setCheckoutIntent("signup");
                  setSelectedPlanId((currentPlan as CheckoutPlanId) || null);
                  setShowCheckoutSection(true);
                }}
              >
                Concluir pagamento
              </Button>
            ) : currentPlan !== "premium" ? (
              <Button
                variant="outline"
                data-testid="button-upgrade-plan"
                onClick={() => {
                  setCheckoutIntent("upgrade");
                  setSelectedPlanId("premium");
                  setShowCheckoutSection(true);
                }}
              >
                Fazer Upgrade
              </Button>
            ) : null}
          </div>
          <Separator className="my-4" />
          <div className="text-sm text-muted-foreground">
            {displayPlan === "pending" && <p>Se já concluiu o pagamento, clique em &quot;Verificar pagamento&quot; abaixo.</p>}
            {displayPlan !== "pending" && currentPlan === "pro" && <p>Próxima cobrança em 25 de fevereiro de 2025 - R$ 19,90</p>}
            {displayPlan !== "pending" && currentPlan === "premium" && <p>Próxima cobrança em 25 de fevereiro de 2025 - R$ 29,90</p>}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-poppins font-bold" data-testid="text-plans-title">
          Planos Disponíveis
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan, index) => (
            <Card
              key={plan.name}
              className={`relative ${plan.current ? "border-primary" : ""} ${plan.recommended ? "border-primary border-2" : ""}`}
              data-testid={`card-plan-${plan.name.toLowerCase()}`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="default">Recomendado</Badge>
                </div>
              )}
              {plan.current && (
                <div className="absolute -top-3 right-4">
                  <Badge variant="secondary">Atual</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="font-poppins" data-testid={`text-plan-name-${index}`}>
                  {plan.name}
                </CardTitle>
                <div className="text-2xl font-bold font-poppins" data-testid={`text-plan-price-${index}`}>
                  {plan.price}
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2" data-testid={`text-feature-${index}-${featureIndex}`}>
                      <Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {!plan.current ? (
                  <Button
                    className="w-full"
                    variant={plan.recommended ? "default" : "outline"}
                    data-testid={`button-select-${plan.name.toLowerCase()}`}
                    onClick={() => {
                      const targetPlan = plan.name.toLowerCase() as CheckoutPlanId;
                      const isUpgradeFlow = displayPlan !== "pending";
                      setCheckoutIntent(isUpgradeFlow ? "upgrade" : "signup");
                      setSelectedPlanId(targetPlan);
                      setShowCheckoutSection(true);
                    }}
                  >
                    Selecionar plano
                  </Button>
                ) : (
                  <Button className="w-full" variant="secondary" disabled data-testid={`button-current-${plan.name.toLowerCase()}`}>
                    Plano Atual
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {showCheckoutSection && (
        <BillingCheckoutSection
          intent={checkoutIntent}
          currentPlan={currentPlan}
          autoVerify={false}
          initialPlanId={selectedPlanId}
          onFinished={async () => {
            await refetchUser();
            setShowCheckoutSection(false);
            setSelectedPlanId(null);
          }}
        />
      )}

      <Dialog
        open={!!confirmField}
        onOpenChange={(open) => {
          if (!open) setConfirmField(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar atualização</DialogTitle>
            <DialogDescription>
              {confirmField === "name"
                ? "Tem certeza que deseja alterar seu nome completo?"
                : "Tem certeza que deseja alterar seu email?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end sm:space-x-2 space-y-2 sm:space-y-0">
            <Button
              variant="outline"
              onClick={() => setConfirmField(null)}
              disabled={isUpdatingProfile}
            >
              Cancelar
            </Button>
            <Button onClick={confirmProfileUpdate} disabled={isUpdatingProfile}>
              {isUpdatingProfile ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
