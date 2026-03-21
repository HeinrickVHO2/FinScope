import { useEffect, useMemo, useState } from "react";
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
import CaktoCheckoutModal from "@/components/CaktoCheckoutModal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CHECKOUT_PLAN_OPTIONS, type CheckoutPlanId } from "@/constants/checkout-plans";
import { apiFetch } from "@/lib/api";
import { PasswordInput } from "@/components/auth/password-input";
import { PasswordStrengthChecklist } from "@/components/auth/password-strength-checklist";
import { validatePasswordStrength } from "@shared/password-policy";
import { getBillingPlan } from "@shared/plans";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, isLoading, refetchUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutIntent, setCheckoutIntent] = useState<"signup" | "upgrade">("signup");
  const [selectedPlanId, setSelectedPlanId] = useState<CheckoutPlanId | null>(null);
  const [confirmField, setConfirmField] = useState<"name" | "email" | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setEmail(user.email);
    }
  }, [user]);

  const currentPlan = (user?.plan as CheckoutPlanId | undefined) ?? "pro";
  const displayPlan = user?.billingStatus === "active" ? currentPlan : "pending";
  const currentPlanConfig = getBillingPlan(currentPlan);
  const passwordValidation = validatePasswordStrength(newPassword, {
    email,
    fullName,
  });

  const plans = useMemo(
    () =>
      CHECKOUT_PLAN_OPTIONS.map((plan) => ({
        ...plan,
        current: currentPlan === plan.id,
      })),
    [currentPlan],
  );

  useEffect(() => {
    if (displayPlan !== "pending") {
      setCheckoutIntent("upgrade");
      return;
    }

    setCheckoutIntent("signup");
    setSelectedPlanId((current) => current ?? currentPlan);
    setIsCheckoutModalOpen(true);
  }, [displayPlan, currentPlan]);

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
      setIsCheckoutModalOpen(true);
    }

    if (params.toString()) {
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  if (isLoading || !user) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

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
      return;
    }

    setEmail(user.email);
    setIsEditingEmail(false);
  };

  const confirmProfileUpdate = async () => {
    if (!confirmField) return;

    const payload = confirmField === "name" ? { fullName: fullName.trim() } : { email: email.trim() };

    try {
      const field = confirmField;
      setConfirmField(null);
      setIsUpdatingProfile(true);

      const response = await apiFetch("/api/user/profile", {
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
        description: field === "name" ? "Seu nome foi atualizado com sucesso." : "Seu email foi atualizado com sucesso.",
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

  const handlePasswordUpdate = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword.trim()) {
      setPasswordError("Informe sua senha atual para continuar.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }

    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.errors[0] || "Sua nova senha ainda não atende aos critérios mínimos.");
      return;
    }

    try {
      setIsUpdatingPassword(true);
      const response = await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Não foi possível atualizar sua senha agora.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordSuccess("Senha atualizada com sucesso.");
      toast({
        title: "Senha atualizada",
        description: "Sua nova senha já está valendo para os próximos acessos.",
      });
    } catch (error) {
      setPasswordError((error as Error).message || "Não foi possível atualizar sua senha agora.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-poppins font-bold" data-testid="text-settings-title">
          Configurações
        </h1>
        <p className="text-muted-foreground" data-testid="text-settings-subtitle">
          Atualize seus dados e acompanhe sua assinatura
        </p>
      </div>

      <Card data-testid="card-profile">
        <CardHeader>
          <CardTitle className="font-poppins">Informações pessoais</CardTitle>
          <CardDescription>Mantenha seus dados sempre em dia</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <div className="flex items-center gap-2">
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={!isEditingName || isUpdatingProfile}
                data-testid="input-fullname"
              />
              {!isEditingName ? (
                <Button variant="ghost" size="icon" onClick={() => setIsEditingName(true)} aria-label="Editar nome">
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => cancelEditField("name")} aria-label="Cancelar edição de nome">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="icon" onClick={() => handleFieldSaveRequest("name")} aria-label="Salvar nome" disabled={isUpdatingProfile}>
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
                onChange={(event) => setEmail(event.target.value)}
                disabled={!isEditingEmail || isUpdatingProfile}
                data-testid="input-email"
              />
              {!isEditingEmail ? (
                <Button variant="ghost" size="icon" onClick={() => setIsEditingEmail(true)} aria-label="Editar email">
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => cancelEditField("email")} aria-label="Cancelar edição de email">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="icon" onClick={() => handleFieldSaveRequest("email")} aria-label="Salvar email" disabled={isUpdatingProfile}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-security">
        <CardHeader>
          <CardTitle className="font-poppins">Segurança</CardTitle>
          <CardDescription>Atualize sua senha com uma combinação mais forte e difícil de adivinhar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Senha atual</Label>
            <PasswordInput
              id="currentPassword"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={isUpdatingPassword}
              placeholder="Digite sua senha atual"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova senha</Label>
            <PasswordInput
              id="newPassword"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={isUpdatingPassword}
              placeholder="Crie uma nova senha"
            />
          </div>

          <PasswordStrengthChecklist password={newPassword} userContext={{ email, fullName }} />

          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword">Confirmar nova senha</Label>
            <PasswordInput
              id="confirmNewPassword"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              disabled={isUpdatingPassword}
              placeholder="Repita a nova senha"
            />
          </div>

          {passwordError ? <p className="text-sm font-medium text-destructive">{passwordError}</p> : null}
          {passwordSuccess ? <p className="text-sm font-medium text-emerald-600">{passwordSuccess}</p> : null}

          <Button onClick={handlePasswordUpdate} disabled={isUpdatingPassword} className="w-full sm:w-auto">
            {isUpdatingPassword ? "Atualizando senha..." : "Atualizar senha"}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="card-current-plan">
        <CardHeader>
          <CardTitle className="font-poppins">Plano atual</CardTitle>
          <CardDescription>Gerencie sua assinatura</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold font-poppins" data-testid="text-current-plan-name">
                  {displayPlan === "pending" ? "Pagamento pendente" : currentPlanConfig.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {displayPlan === "pending"
                    ? "Conclua o pagamento para liberar todos os recursos."
                    : `${currentPlanConfig.priceLabel} • ${currentPlanConfig.marketingHeadline}`}
                </p>
                {displayPlan !== "pending" ? (
                  <p className="mt-1 text-xs text-primary">
                    {currentPlanConfig.commercialCopy.dailyPriceLabel ?? currentPlanConfig.commercialCopy.priceSupport}
                  </p>
                ) : null}
              </div>
            </div>

            {displayPlan === "pending" ? (
              <Button
                variant="outline"
                data-testid="button-finish-payment"
                onClick={() => {
                  setCheckoutIntent("signup");
                  setSelectedPlanId(currentPlan);
                  setIsCheckoutModalOpen(true);
                }}
              >
                Concluir pagamento
              </Button>
            ) : (
              <Button
                variant="outline"
                data-testid={currentPlan === "premium" ? "button-downgrade-plan" : "button-upgrade-plan"}
                onClick={() => {
                  setCheckoutIntent("upgrade");
                  setSelectedPlanId(currentPlan === "premium" ? "pro" : "premium");
                  setIsCheckoutModalOpen(true);
                }}
              >
                {currentPlan === "premium" ? "Alterar para Pro" : "Ver Premium"}
              </Button>
            )}
          </div>

          <Separator className="my-4" />

          <div className="text-sm text-muted-foreground">
            {displayPlan === "pending" ? (
              <p>Se você já pagou, clique em "Verificar pagamento" na modal para atualizar o acesso.</p>
            ) : (
              <p>{currentPlanConfig.comparisonSummary}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-2xl font-poppins font-bold" data-testid="text-plans-title">
          Planos disponíveis
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan, index) => (
            <Card
              key={plan.id}
              className={`relative ${plan.current ? "border-primary" : ""} ${plan.recommended ? "border-primary border-2" : ""}`}
              data-testid={`card-plan-${plan.id}`}
            >
              {plan.recommended ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="default">{plan.badge || "Recomendado"}</Badge>
                </div>
              ) : null}
              {plan.current ? (
                <div className="absolute -top-3 right-4">
                  <Badge variant="secondary">Atual</Badge>
                </div>
              ) : null}

              <CardHeader>
                <CardTitle className="font-poppins" data-testid={`text-plan-name-${index}`}>
                  {plan.name}
                </CardTitle>
                <CardDescription>{plan.marketingHeadline}</CardDescription>
                <div className="text-2xl font-bold font-poppins" data-testid={`text-plan-price-${index}`}>
                  {plan.price}
                </div>
                <p className="text-sm text-primary">
                  {plan.commercialCopy.dailyPriceLabel ?? plan.commercialCopy.priceSupport}
                </p>
                <p className="text-sm text-muted-foreground">{plan.comparisonSummary}</p>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2" data-testid={`text-feature-${index}-${featureIndex}`}>
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                  {plan.commercialCopy.checkoutSupport}
                </div>
              </CardContent>

              <CardFooter>
                {!plan.current ? (
                  <Button
                    className="w-full"
                    variant={plan.recommended ? "default" : "outline"}
                    data-testid={`button-select-${plan.id}`}
                    onClick={() => {
                      const isUpgradeFlow = displayPlan !== "pending";
                      setCheckoutIntent(isUpgradeFlow ? "upgrade" : "signup");
                      setSelectedPlanId(plan.id);
                      setIsCheckoutModalOpen(true);
                    }}
                  >
                    {plan.id === "premium" ? "Quero o Premium" : "Selecionar plano"}
                  </Button>
                ) : (
                  <Button className="w-full" variant="secondary" disabled data-testid={`button-current-${plan.id}`}>
                    Plano atual
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      <CaktoCheckoutModal
        open={isCheckoutModalOpen}
        onOpenChange={(open) => {
          setIsCheckoutModalOpen(open);
          if (!open) {
            setSelectedPlanId(null);
          }
        }}
        intent={checkoutIntent}
        initialPlanId={selectedPlanId}
        onFinished={async () => {
          await refetchUser();
          setIsCheckoutModalOpen(false);
          setSelectedPlanId(null);
        }}
      />

      <Dialog
        open={!!confirmField}
        onOpenChange={(open) => {
          if (!open) setConfirmField(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar alteração?</DialogTitle>
            <DialogDescription>
              {confirmField === "name"
                ? "Tem certeza que deseja alterar seu nome completo?"
                : "Tem certeza que deseja alterar seu email?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col space-y-2 sm:flex-row sm:justify-end sm:space-x-2 sm:space-y-0">
            <Button variant="outline" onClick={() => setConfirmField(null)} disabled={isUpdatingProfile}>
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
