import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Wallet, Building2, MoreVertical, TrendingUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAccountSchema, type InsertAccount, PLAN_LIMITS } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

export default function AccountsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Mock current user plan - will be replaced with real data in Task 3
  const currentPlan = "free";
  const planLimit = PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS].accounts;

  // Mock accounts - will be replaced with real data in Task 3
  const accounts = [
    { id: "1", name: "Conta Pessoal", type: "pessoal", initialBalance: "5000.00", currentBalance: 6250.00 },
  ];

  const canAddAccount = accounts.length < planLimit;

  const form = useForm<InsertAccount>({
    resolver: zodResolver(insertAccountSchema),
    defaultValues: {
      name: "",
      type: "pessoal",
      initialBalance: "0.00",
      userId: "temp-user-id", // Will be set from auth in Task 3
    },
  });

  async function onSubmit(data: InsertAccount) {
    try {
      // TODO: Implement account creation in Task 3
      console.log("Create account:", data);
      
      toast({
        title: "Conta criada!",
        description: `A conta "${data.name}" foi criada com sucesso.`,
      });
      
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({
        title: "Erro ao criar conta",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-poppins font-bold" data-testid="text-accounts-title">Contas</h1>
          <p className="text-muted-foreground" data-testid="text-accounts-subtitle">
            Gerencie suas contas financeiras
            {planLimit !== Infinity && (
              <span className="ml-2">
                ({accounts.length}/{planLimit} contas usadas)
              </span>
            )}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canAddAccount} data-testid="button-add-account">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Conta
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-account">
            <DialogHeader>
              <DialogTitle className="font-poppins">Adicionar Nova Conta</DialogTitle>
              <DialogDescription>
                Crie uma nova conta para organizar suas finanças
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Conta</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Conta Corrente" 
                          data-testid="input-account-name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Conta</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-account-type">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pessoal">Pessoal</SelectItem>
                          <SelectItem value="empresa">Empresa (MEI)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="initialBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Saldo Inicial</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="0.00" 
                          data-testid="input-initial-balance"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" data-testid="button-submit-account">
                    Criar Conta
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {!canAddAccount && (
        <Card className="border-destructive/50 bg-destructive/5" data-testid="card-limit-warning">
          <CardContent className="pt-6">
            <p className="text-sm">
              Você atingiu o limite de {planLimit} conta(s) do plano {currentPlan.toUpperCase()}. 
              <Button variant="link" className="px-1 h-auto" data-testid="button-upgrade">
                Faça upgrade para adicionar mais contas
              </Button>
            </p>
          </CardContent>
        </Card>
      )}

      {accounts.length === 0 ? (
        <Card data-testid="card-empty-state">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-poppins font-semibold mb-2">Nenhuma conta ainda</h3>
            <p className="text-muted-foreground text-center mb-4">
              Adicione sua primeira conta para começar a organizar suas finanças
            </p>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-first-account">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Primeira Conta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account, index) => (
            <Card key={account.id} className="hover-elevate" data-testid={`card-account-${index}`}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {account.type === "pessoal" ? (
                      <Wallet className="h-5 w-5 text-primary" />
                    ) : (
                      <Building2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base font-poppins" data-testid={`text-account-name-${index}`}>
                      {account.name}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs mt-1" data-testid={`badge-account-type-${index}`}>
                      {account.type === "pessoal" ? "Pessoal" : "Empresa"}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-account-menu-${index}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem data-testid={`menu-edit-${index}`}>Editar</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" data-testid={`menu-delete-${index}`}>
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo Atual</p>
                    <p className="text-2xl font-bold font-poppins text-secondary" data-testid={`text-account-balance-${index}`}>
                      R$ {account.currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +R$ {(account.currentBalance - parseFloat(account.initialBalance)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} desde criação
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
