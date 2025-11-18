import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";

export default function OnboardingErrorPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <AlertTriangle className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-poppins">
            Não foi possível confirmar o pagamento
          </CardTitle>
          <CardDescription>
            Ocorreu um erro ao processar a assinatura. Tente novamente ou volte para o dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" onClick={() => setLocation("/settings/billing")}>
            Tentar novamente
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setLocation("/dashboard")}>
            Voltar ao dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
