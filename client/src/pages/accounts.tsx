import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Wallet, Building2, MoreVertical, TrendingUp, Trash2, Edit } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAccountSchema, type InsertAccount, type Account, PLAN_LIMITS } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const currentPlan = user?.plan || "free";
  const planLimit = PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS].accounts;

  // Fetch accounts
  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const canAddAccount = accounts.length < planLimit;

  const form = useForm({
    resolver: zodResolver(insertAccountSchema.omit({ userId: true })),
    defaultValues: {
      name: "",
      type: "pessoal" as const,
      initialBalance: 0,
    },
  });

  // Create account mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; initialBalance: number }) => {
      const response = await apiRequest("POST", "/api/accounts", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Conta criada!",
        description: "A conta foi criada com sucesso.",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar conta",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  // Delete account mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Conta deletada!",
        description: "A conta e suas transações foram removidas.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao deletar conta",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  async function onSubmit(data: InsertAccount) {
    createMutation.mutate(data);
  }

  function handleDelete(id: string) {
    if (confirm("Tem certeza que deseja deletar esta conta? Todas as transações serão removidas.")) {
      deleteMutation.mutate(id);
    }
  }

  // Calculate current balance for each account
  function getCurrentBalance(account: Account): number {
    // For now, just return initial balance
    // In a real app, we'd calculate based on transactions
    return Number(account.initialBalance);
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
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                    data-testid="button-create-account"
                  >
                    {createMutation.isPending ? "Criando..." : "Criar Conta"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {!canAddAccount && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <h3 className="font-semibold mb-1">Limite de contas atingido</h3>
              <p className="text-sm text-muted-foreground">
                Faça upgrade para criar mais contas
              </p>
            </div>
            <Button variant="default">
              Fazer Upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Accounts Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="text-center p-12">
          <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">Nenhuma conta cadastrada</h3>
          <p className="text-muted-foreground mb-4">
            Crie sua primeira conta para começar a gerenciar suas finanças
          </p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Criar Primeira Conta
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} data-testid={`card-account-${account.id}`}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {account.type === "empresa" ? (
                      <Building2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Wallet className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold" data-testid={`text-account-name-${account.id}`}>
                      {account.name}
                    </CardTitle>
                    <Badge variant="secondary" className="mt-1">
                      {account.type === "empresa" ? "MEI" : "Pessoal"}
                    </Badge>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-account-menu-${account.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => handleDelete(account.id)}
                      className="text-destructive"
                      data-testid={`menu-item-delete-${account.id}`}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Deletar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo Atual</p>
                    <p className="text-2xl font-bold font-poppins text-primary" data-testid={`text-balance-${account.id}`}>
                      R$ {getCurrentBalance(account).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Saldo Inicial</span>
                      <span className="font-medium">
                        R$ {Number(account.initialBalance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
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
