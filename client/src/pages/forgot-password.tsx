import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const { register, handleSubmit } = useForm();
  const { toast } = useToast();

  async function onSubmit(data: any) {
    const response = await apiFetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({} as { error?: string }));
      toast({
        title: "Nao foi possivel enviar o link agora",
        description: payload.error || "Tente novamente em instantes.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Se existir uma conta com esse email...",
      description: "Enviamos um link para redefinir sua senha.",
    });
  }

  return (
    <div className="flex justify-center pt-20">
      <div className="mb-6 flex justify-center" />
      <Card className="w-[380px]">
        <CardHeader>
          <CardTitle>Recuperar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input {...register("email")} placeholder="Seu e-mail" required />
            <Button type="submit" className="w-full">
              Enviar link de recuperacao
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
