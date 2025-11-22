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
    await apiFetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    toast({
      title: "Se existir uma conta com esse email...",
      description: "Enviamos um link para redefinir sua senha.",
    });
  }

  return (
    <div className="flex justify-center pt-20">
      <div className="flex justify-center mb-6">
</div>
      <Card className="w-[380px]">
        <CardHeader>
          <CardTitle>Recuperar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input {...register("email")} placeholder="Seu e-mail" required />
            <Button type="submit" className="w-full">
              Enviar link de recuperação
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
