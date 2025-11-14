import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: InsertUser) {
    setIsLoading(true);
    try {
      // TODO: Implement signup logic in Task 2 & 3
      console.log("Signup data:", data);
      
      toast({
        title: "Conta criada com sucesso!",
        description: "Bem-vindo ao FinScope! Seu teste grátis de 10 dias começou.",
      });
      
      setTimeout(() => {
        setLocation("/dashboard");
      }, 1000);
    } catch (error) {
      toast({
        title: "Erro ao criar conta",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer" data-testid="link-logo">
              <TrendingUp className="h-8 w-8 text-primary" />
              <span className="text-2xl font-poppins font-bold">FinScope</span>
            </div>
          </Link>
          <p className="text-muted-foreground text-center">
            Crie sua conta e ganhe 10 dias grátis
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-poppins" data-testid="text-signup-title">Criar sua conta</CardTitle>
            <CardDescription data-testid="text-signup-description">
              Preencha os dados abaixo para começar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="João Silva" 
                          data-testid="input-fullname"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="seu@email.com" 
                          data-testid="input-email"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Mínimo 6 caracteres" 
                          data-testid="input-password"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  data-testid="button-submit"
                >
                  {isLoading ? "Criando conta..." : "Criar conta e iniciar teste"}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground text-center">
              Ao criar uma conta, você concorda com nossos{" "}
              <a href="#" className="text-primary hover:underline">
                Termos de Uso
              </a>{" "}
              e{" "}
              <a href="#" className="text-primary hover:underline">
                Política de Privacidade
              </a>
            </p>
            <p className="text-sm text-center text-muted-foreground">
              Já tem uma conta?{" "}
              <Link href="/login">
                <span className="text-primary hover:underline cursor-pointer" data-testid="link-login">
                  Entrar
                </span>
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
