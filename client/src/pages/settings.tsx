import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Check, Crown } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  
  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setEmail(user.email);
    }
  }, [user]);

  // DashboardLayout already handles auth redirect, but we need loading state
  // while user data is being fetched within the authenticated session
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
  const trialDaysLeft = user.trialEnd 
    ? Math.ceil((new Date(user.trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;
  const isOnTrial = trialDaysLeft > 0;

  const plans = [
    {
      name: "Pro",
      price: "R$ 14,90/mês",
      current: currentPlan === "pro",
      features: [
        "Até 3 contas",
        "Dashboard completo",
        "Alertas de pagamento",
        "Exportação CSV",
      ],
    },
    {
      name: "Premium",
      price: "R$ 29,90/mês",
      current: currentPlan === "premium",
      recommended: true,
      features: [
        "Contas ilimitadas",
        "Dashboard avançado",
        "Categorização automática",
        "Gestão MEI completa",
        "Relatórios PDF",
      ],
    },
  ];

  const handleSaveProfile = () => {
    // TODO: Implement real profile update API call
    // For now, just show feedback that feature is not yet implemented
    toast({
      title: "Recurso em desenvolvimento",
      description: "A atualização de perfil será implementada em breve.",
      variant: "default",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-poppins font-bold" data-testid="text-settings-title">Configurações</h1>
        <p className="text-muted-foreground" data-testid="text-settings-subtitle">
          Gerencie sua conta e preferências
        </p>
      </div>

      {/* Trial Banner */}
      {isOnTrial && (
        <Card className="border-primary/50 bg-primary/5" data-testid="card-trial-banner">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold mb-1">Teste Grátis Ativo</h3>
                <p className="text-sm text-muted-foreground">
                  Você tem {trialDaysLeft} dias restantes no seu teste gratuito do plano Premium.
                </p>
              </div>
              <Button variant="default" data-testid="button-activate-plan">
                Ativar Plano
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile Settings */}
      <Card data-testid="card-profile">
        <CardHeader>
          <CardTitle className="font-poppins">Informações Pessoais</CardTitle>
          <CardDescription>Atualize seus dados cadastrais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome Completo</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              data-testid="input-fullname"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-email"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveProfile} data-testid="button-save-profile">
            Salvar Alterações
          </Button>
        </CardFooter>
      </Card>

      {/* Current Plan */}
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
                  Plano {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isOnTrial ? `${trialDaysLeft} dias de teste grátis restantes` : "Ativo"}
                </p>
              </div>
            </div>
            {currentPlan !== "premium" && (
              <Button variant="outline" data-testid="button-upgrade-plan">
                Fazer Upgrade
              </Button>
            )}
          </div>
          <Separator className="my-4" />
          <div className="text-sm text-muted-foreground">
            {currentPlan === "free" && (
              <p>Você está no plano gratuito. Faça upgrade para desbloquear recursos avançados.</p>
            )}
            {currentPlan === "pro" && (
              <p>Próxima cobrança em 25 de fevereiro de 2025 - R$ 14,90</p>
            )}
            {currentPlan === "premium" && (
              <p>Próxima cobrança em 25 de fevereiro de 2025 - R$ 29,90</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div className="space-y-4">
        <h2 className="text-2xl font-poppins font-bold" data-testid="text-plans-title">Planos Disponíveis</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan, index) => (
            <Card 
              key={plan.name} 
              className={`relative ${plan.current ? 'border-primary' : ''} ${plan.recommended ? 'border-primary border-2' : ''}`}
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
                <CardTitle className="font-poppins" data-testid={`text-plan-name-${index}`}>{plan.name}</CardTitle>
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
                  <Button className="w-full" variant={plan.recommended ? "default" : "outline"} data-testid={`button-select-${plan.name.toLowerCase()}`}>
                    {plan.name === "Free" ? "Fazer Downgrade" : "Selecionar Plano"}
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

      {/* Danger Zone */}
      <Card className="border-destructive/50" data-testid="card-danger-zone">
        <CardHeader>
          <CardTitle className="font-poppins text-destructive">Zona de Perigo</CardTitle>
          <CardDescription>Ações irreversíveis com sua conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Cancelar Assinatura</p>
              <p className="text-sm text-muted-foreground">
                Você perderá acesso aos recursos premium
              </p>
            </div>
            <Button variant="outline" className="text-destructive" data-testid="button-cancel-subscription">
              Cancelar
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Excluir Conta</p>
              <p className="text-sm text-muted-foreground">
                Todos os seus dados serão permanentemente removidos
              </p>
            </div>
            <Button variant="destructive" data-testid="button-delete-account">
              Excluir Conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
