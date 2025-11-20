import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, ArrowUpRight, ArrowDownRight, Download, Trash2, Lock } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTransactionSchema, type InsertTransaction, type Transaction, type Account } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import CaktoCheckoutModal from "@/components/CaktoCheckoutModal";
import { useDashboardView } from "@/context/dashboard-view";

type Scope = "PF" | "PJ" | "ALL";

const CATEGORY_OPTIONS: Record<"PF" | "PJ", { entrada: string[]; saida: string[] }> = {
  PF: {
    entrada: ["Salário", "Renda extra", "Transferências", "Reembolso", "Outros"],
    saida: [
      "Mercado",
      "Alimentação",
      "Transporte / Combustível",
      "Moradia",
      "Lazer",
      "Saúde",
      "Educação",
      "Streaming / Assinaturas",
      "Pets",
      "Compras gerais",
      "Cartão de crédito",
      "Outros",
    ],
  },
  PJ: {
    entrada: ["Faturamento / Receitas", "Serviços prestados", "Produtos vendidos", "Reembolsos empresariais", "Outros"],
    saida: [
      "Impostos",
      "Fornecedores",
      "Matéria-prima",
      "Equipamentos",
      "Serviços terceirizados",
      "Marketing / Anúncios",
      "Assinaturas empresariais",
      "Transporte / Logística",
      "Folha de pagamento",
      "Outros",
    ],
  },
};

export default function TransactionsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { selectedView, setSelectedView } = useDashboardView();
  const [scopeFilter, setScopeFilter] = useState<Scope>(selectedView);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const { toast } = useToast();
  const { user } = useAuth();
  const isPremiumUser = user?.plan === "premium";

  // Fetch transactions and accounts
  const transactionsEndpoint = `/api/transactions?type=${scopeFilter}`;
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: [transactionsEndpoint],
    enabled: !(scopeFilter === "PJ" && !isPremiumUser),
  });

  const {
    data: accounts = [],
    isLoading: accountsLoading,
    refetch: refetchAccounts,
  } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const form = useForm({
    resolver: zodResolver(insertTransactionSchema.omit({ userId: true })),
    defaultValues: {
      description: "",
      type: "saida" as const,
      amount: 0,
      category: "",
      date: new Date().toISOString().split('T')[0],
      accountId: accounts[0]?.id || "",
      accountType: "PF" as const,
    },
  });

  const personalAccount = useMemo(() => accounts.find((acc) => acc.type?.toLowerCase() === "pf"), [accounts]);
  const businessAccount = useMemo(() => accounts.find((acc) => acc.type?.toLowerCase() === "pj"), [accounts]);
  const accountType = form.watch("accountType");
  const transactionType = form.watch("type");
  const availableCategories = useMemo(() => {
    const scope = accountType === "PJ" ? "PJ" : "PF";
    const kind = transactionType === "entrada" ? "entrada" : "saida";
    return CATEGORY_OPTIONS[scope][kind];
  }, [accountType, transactionType]);

  useEffect(() => {
    if (!accountsLoading && accounts.length === 0) {
      apiRequest("POST", "/api/accounts/ensure-default").finally(() => {
        refetchAccounts();
      });
    }
  }, [accounts, accountsLoading, refetchAccounts]);

  useEffect(() => {
    if (personalAccount?.id) {
      form.setValue("accountId", personalAccount.id);
    }
  }, [personalAccount, form]);

  useEffect(() => {
    const nextAccount = accountType === "PJ" ? businessAccount : personalAccount;
    if (nextAccount?.id) {
      form.setValue("accountId", nextAccount.id);
    }
  }, [accountType, businessAccount, personalAccount, form]);

  const invalidateFinanceQueries = () => {
    const scopes: Scope[] = ["PF", "PJ", "ALL"];
    scopes.forEach((scope) => {
      queryClient.invalidateQueries({ queryKey: [`/api/dashboard/metrics?type=${scope}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/dashboard/categories?type=${scope}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/dashboard/income-expenses?type=${scope}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/transactions?type=${scope}`] });
    });
  };

  // Create transaction mutation
  const createMutation = useMutation({
    mutationFn: async (data: { description: string; type: string; amount: number; category: string; date: string; accountId: string; accountType: string }) => {
      const response = await apiRequest("POST", "/api/transactions", {
        ...data,
        date: new Date(data.date).toISOString(),
      });
      return response.json();
    },
    onSuccess: () => {
      invalidateFinanceQueries();
      toast({
        title: "Transação criada!",
        description: "A transação foi adicionada com sucesso.",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao criar transação",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  // Delete transaction mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      invalidateFinanceQueries();
      toast({
        title: "Transação deletada!",
        description: "A transação foi removida.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao deletar transação",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  const canSubmit = accountType === "PJ" ? isPremiumUser && !!businessAccount?.id : !!personalAccount?.id;

  async function onSubmit(data: InsertTransaction) {
    const targetAccount = data.accountType === "PJ" ? businessAccount : personalAccount;
    if (!targetAccount?.id) {
      toast({
        title: "Conta indisponível",
        description: "Configure seu perfil financeiro antes de registrar a transação.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      ...data,
      accountId: targetAccount.id,
      accountType: data.accountType || "PF",
    });
  }

  function handleDelete(id: string) {
    if (confirm("Tem certeza que deseja deletar esta transação?")) {
      deleteMutation.mutate(id);
    }
  }

  const handleScopeChange = (scope: Scope) => {
    if (scope === "PJ" && !isPremiumUser) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setScopeFilter(scope);
    setSelectedView(scope);
  };

  async function handleExport() {
    if (scopeFilter === "PJ" && !isPremiumUser) {
      setIsUpgradeModalOpen(true);
      return;
    }
    try {
      const response = await fetch(`/api/export/transactions?type=${scopeFilter}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Erro ao exportar transações');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transacoes_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Exportação concluída",
        description: "Suas transações foram exportadas com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível exportar as transações",
        variant: "destructive",
      });
    }
  }

  useEffect(() => {
    if (!isPremiumUser && selectedView === "PJ") {
      setSelectedView("PF");
      return;
    }
    setScopeFilter(selectedView);
  }, [selectedView, isPremiumUser, setSelectedView]);

  const filteredTransactions = (transactions || []).filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || t.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <>
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-poppins font-bold" data-testid="text-transactions-title">Transações</h1>
          <p className="text-muted-foreground" data-testid="text-transactions-subtitle">
            Gerencie todas as suas movimentações financeiras
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={scopeFilter === "PF" ? "default" : "outline"}
              onClick={() => handleScopeChange("PF")}
            >
              Conta Pessoal
            </Button>
            <Button
              variant={scopeFilter === "PJ" ? "default" : "outline"}
              onClick={() => handleScopeChange("PJ")}
              disabled={!isPremiumUser}
            >
              Conta Empresarial
              {!isPremiumUser && <Lock className="ml-2 h-4 w-4" />}
            </Button>
            <Button
              variant={scopeFilter === "ALL" ? "default" : "outline"}
              onClick={() => handleScopeChange("ALL")}
            >
              Todas
            </Button>
          </div>
          <Button variant="outline" data-testid="button-export" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-transaction">
                <Plus className="mr-2 h-4 w-4" />
                Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-add-transaction">
              <DialogHeader>
                <DialogTitle className="font-poppins">Adicionar Transação</DialogTitle>
                <DialogDescription>
                  Registre uma nova entrada ou saída
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="accountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de conta</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            if (value === "PJ" && !isPremiumUser) {
                              setIsUpgradeModalOpen(true);
                              return;
                            }
                            field.onChange(value);
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PF">Pessoal (PF)</SelectItem>
                            <SelectItem value="PJ" disabled={!isPremiumUser}>
                              Empresarial (PJ)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {!isPremiumUser && (
                          <p className="text-xs text-muted-foreground">
                            Ganhe acesso à conta empresarial no plano Premium.
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: Salário, Supermercado..." 
                            data-testid="input-description"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="entrada">Entrada</SelectItem>
                              <SelectItem value="saida">Saída</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                          {accountType === "PJ" && !isPremiumUser && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Disponível apenas para assinantes Premium.
                            </p>
                          )}
                          {accountType === "PJ" && isPremiumUser && !businessAccount && !accountsLoading && (
                            <p className="text-xs text-destructive mt-1">
                              Configure seu perfil empresarial para registrar lançamentos PJ.
                            </p>
                          )}
                          {accountType === "PF" && !personalAccount && !accountsLoading && (
                            <p className="text-xs text-destructive mt-1">
                              Nenhuma estrutura de conta pessoal encontrada.
                            </p>
                          )}
                      </FormItem>
                    )}
                  />
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00" 
                              data-testid="input-amount"
                              {...field} 
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableCategories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            data-testid="input-date"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending || !canSubmit}
                      data-testid="button-create-transaction"
                    >
                      {createMutation.isPending ? "Criando..." : "Criar Transação"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar transações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-[180px]" data-testid="select-filter-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      {transactionsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <Card className="text-center p-12">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">Nenhuma transação encontrada</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || filterType !== "all" 
              ? "Tente ajustar os filtros de busca"
              : "Comece adicionando sua primeira transação"
            }
          </p>
          {!searchTerm && filterType === "all" && accounts.length > 0 && (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Transação
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTransactions.map((transaction, index) => {
            const account = accounts.find(a => a.id === transaction.accountId);
            
            return (
              <Card key={transaction.id} data-testid={`card-transaction-${index}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        transaction.type === "entrada" ? "bg-secondary/10" : "bg-destructive/10"
                      }`}>
                        {transaction.type === "entrada" ? (
                          <ArrowUpRight className="h-6 w-6 text-secondary" />
                        ) : (
                          <ArrowDownRight className="h-6 w-6 text-destructive" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium" data-testid={`text-description-${index}`}>
                            {transaction.description}
                          </p>
                          {transaction.autoRuleApplied && (
                            <Badge variant="secondary" className="text-xs">
                              Auto
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <Badge variant="outline" className="text-xs" data-testid={`badge-category-${index}`}>
                            {transaction.category}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {transaction.accountType || "PF"}
                          </Badge>
                          {account && (
                            <span className="text-xs text-muted-foreground">
                              {account.name}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(transaction.date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`text-right font-semibold text-lg ${
                        transaction.type === "entrada" ? "text-secondary" : "text-foreground"
                      }`} data-testid={`text-amount-${index}`}>
                        {transaction.type === "entrada" ? "+" : "-"}R$ {Number(transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(transaction.id)}
                        data-testid={`button-delete-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
    <CaktoCheckoutModal open={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen} intent="upgrade" />
    </>
  );
}
