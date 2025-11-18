import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

export default function OnboardingSuccessPage() {
  const [, setLocation] = useLocation();
  const { refetchUser } = useAuth();

  useEffect(() => {
    refetchUser();
  }, [refetchUser]);

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl font-poppins">
            Pagamento confirmado!
          </CardTitle>
          <CardDescription>
            Sua assinatura foi ativada com sucesso. Clique abaixo para acessar o dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" onClick={() => setLocation("/dashboard")}>
            Ir para o dashboard
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setLocation("/")}>
            Voltar para a página inicial
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
