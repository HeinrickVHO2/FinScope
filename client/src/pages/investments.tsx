import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, TrendingUp, Target, ArrowUpRight, ArrowDownRight, Edit, Trash2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertInvestmentSchema, INVESTMENT_TYPES, type Investment, type InvestmentGoal, type Account } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type InsertInvestment = z.infer<typeof insertInvestmentSchema>;

// Simplified transaction form schema for frontend
const transactionFormSchema = z.object({
  investmentId: z.string().min(1, "Investimento é obrigatório"),
  sourceAccountId: z.string().min(1, "Conta é obrigatória"),
  type: z.enum(["deposit", "withdrawal"]),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Valor deve ser maior que zero",
  }),
  date: z.string().min(1, "Data é obrigatória"),
  note: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionFormSchema>;

// Goal form schema
const goalFormSchema = z.object({
  targetAmount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Meta deve ser maior que zero",
  }),
});

type GoalFormData = z.infer<typeof goalFormSchema>;

export default function InvestmentsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const { toast } = useToast();

  // Fetch investments
  const { data: investments, isLoading: investmentsLoading } = useQuery<Investment[]>({
    queryKey: ["/api/investments"],
  });

  // Fetch investment goals
  const { data: goals, isLoading: goalsLoading } = useQuery<InvestmentGoal[]>({
    queryKey: ["/api/investments/goals"],
  });

  // Fetch accounts for transactions
  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  // Create investment form
  const createForm = useForm<InsertInvestment>({
    resolver: zodResolver(insertInvestmentSchema),
    defaultValues: {
      name: "",
      type: "reserva_emergencia",
    },
  });

  // Transaction form
  const transactionForm = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      investmentId: "",
      sourceAccountId: "",
      type: "deposit",
      amount: "",
      date: new Date().toISOString().split('T')[0],
    },
  });

  // Goal form
  const goalForm = useForm<GoalFormData>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      targetAmount: "",
    },
  });

  // Create investment mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertInvestment) => {
      console.log("🚀 [Investment Create] Sending to API:", data);
      return apiRequest("POST", "/api/investments", data);
    },
    onSuccess: () => {
      console.log("✅ [Investment Create] Success!");

      queryClient.invalidateQueries({ queryKey: ["/api/investments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/investments"] });
      createForm.reset();
      setIsCreateDialogOpen(false);
      toast({
        title: "Investimento criado",
        description: "Seu investimento foi criado com sucesso",
      });
    },
    onError: (error: Error) => {
      console.error("❌ [Investment Create] Error:", error);
      toast({
        title: "Erro ao criar investimento",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  // Create transaction mutation
  const transactionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/investments/${data.investmentId}/transactions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/investments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      transactionForm.reset();
      setIsTransactionDialogOpen(false);
      setSelectedInvestment(null);
      toast({
        title: "Transação registrada",
        description: "Sua transação de investimento foi registrada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao registrar transação",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  // Update goal mutation
  const updateGoalMutation = useMutation({
    mutationFn: async (data: { investmentId: string; targetAmount: string }) => {
      return apiRequest("POST", "/api/investments/goals", data);
    },
    onSuccess: async () => {
      // Force refetch instead of just invalidating (due to staleTime: Infinity)
      queryClient.invalidateQueries({ queryKey: ["/api/investments/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/investments"] });

      await queryClient.refetchQueries({ queryKey: ["/api/investments/goals"], type: "active" });
      await queryClient.refetchQueries({ queryKey: ["/api/dashboard/investments"] });
      goalForm.reset();
      setIsGoalDialogOpen(false);
      setSelectedInvestment(null);
      toast({
        title: "Meta atualizada",
        description: "Meta de investimento atualizada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar meta",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  // Delete investment mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/investments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/investments"] });
      toast({
        title: "Investimento deletado",
        description: "Seu investimento foi removido com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao deletar investimento",
        description: error.message || "Tente novamente mais tarde",
        variant: "destructive",
      });
    },
  });

  async function onCreateSubmit(data: InsertInvestment) {
    createMutation.mutate(data);
  }

  async function onTransactionSubmit(data: TransactionFormData) {
    // Convert to API format with proper types
    const apiData = {
      investmentId: data.investmentId,
      sourceAccountId: data.sourceAccountId,
      type: data.type,
      amount: parseFloat(data.amount).toFixed(2),
      date: new Date(data.date).toISOString(),
      note: data.note,
    };
    transactionMutation.mutate(apiData);
  }

  // Map goals by investment ID - MUST be before functions that use it
  const goalsMap = new Map(goals?.map(g => [g.investmentId, g]) || []);

  function handleDelete(id: string) {
    if (confirm("Tem certeza que deseja deletar este investimento?")) {
      deleteMutation.mutate(id);
    }
  }

  function openTransactionDialog(investment: Investment) {
    setSelectedInvestment(investment);
    transactionForm.setValue("investmentId", investment.id);
    setIsTransactionDialogOpen(true);
  }

  function openGoalDialog(investment: Investment) {
    setSelectedInvestment(investment);
    const existingGoal = goalsMap.get(investment.id);
    if (existingGoal) {
      goalForm.setValue(
        "targetAmount",
      String(parseFloat(existingGoal.targetAmount))
);
    } else {
      goalForm.reset();
    }
    setIsGoalDialogOpen(true);
  }

  async function onGoalSubmit(data: GoalFormData) {
    if (!selectedInvestment) return;
    updateGoalMutation.mutate({
      investmentId: selectedInvestment.id,
      targetAmount: parseFloat(data.targetAmount).toFixed(2),
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-poppins font-bold" data-testid="text-investments-title">Investimentos</h1>
          <p className="text-muted-foreground" data-testid="text-investments-subtitle">
            Gerencie seus investimentos e acompanhe suas metas
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            createForm.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-investment">
              <Plus className="mr-2 h-4 w-4" />
              Novo Investimento
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-investment">
            <DialogHeader>
              <DialogTitle className="font-poppins">Criar Investimento</DialogTitle>
              <DialogDescription>
                Adicione um novo investimento ao seu portfólio
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Investimento</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Reserva de Emergência" 
                          data-testid="input-investment-name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Investimento</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-investment-type">
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {INVESTMENT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-investment">
                    {createMutation.isPending ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Investments Grid */}
      {investmentsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : investments?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum investimento cadastrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece criando seu primeiro investimento para acompanhar seu patrimônio
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeiro Investimento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {investments?.map((investment) => {
            const goal = goalsMap.get(investment.id);
            const goalValue = goal ? parseFloat(goal.targetAmount) : 0;
            const currentValue = parseFloat(investment.currentAmount);

            const progress =
              goalValue > 0 ? Math.min((currentValue / goalValue) * 100, 100) : 0;
            const investmentType = INVESTMENT_TYPES.find(t => t.value === investment.type);

            return (
              <Card key={investment.id} className="hover-elevate" data-testid={`card-investment-${investment.id}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-poppins" data-testid={`text-investment-name-${investment.id}`}>
                      {investment.name}
                    </CardTitle>
                    <CardDescription>
                      {investmentType?.label || investment.type} · {goal ? "Com meta definida" : "Sem meta"}
                    </CardDescription>
                  </div>
                  {goal && <Target className="h-5 w-5 text-primary" />}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Saldo Atual</p>
                    <p className="text-3xl font-bold font-poppins text-primary">
                      R$ {(parseFloat(investment.currentAmount) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {goal && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Meta: R$ {parseFloat(goal.targetAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="font-medium">{Math.min(progress, 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={Math.min(progress, 100)} className="h-2" />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => openTransactionDialog(investment)}
                      data-testid={`button-add-transaction-${investment.id}`}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Transação
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openGoalDialog(investment)}
                          data-testid={`button-edit-goal-${investment.id}`}
                        >
                          <Target className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{goal ? "Editar meta" : "Definir meta"}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleDelete(investment.id)}
                          data-testid={`button-delete-${investment.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Deletar investimento</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Transaction Dialog */}
      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent data-testid="dialog-investment-transaction">
          <DialogHeader>
            <DialogTitle className="font-poppins">Nova Transação de Investimento</DialogTitle>
            <DialogDescription>
              Registre um aporte ou resgate do investimento
            </DialogDescription>
          </DialogHeader>
          <Form {...transactionForm}>
            <form onSubmit={transactionForm.handleSubmit(onTransactionSubmit)} className="space-y-4">
              <FormField
                control={transactionForm.control}
                name="sourceAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta de Origem/Destino</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-account">
                          <SelectValue placeholder="Selecione a conta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts?.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transactionForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Transação</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-transaction-type">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="deposit">
                          Depósito (Adicionar dinheiro)
                        </SelectItem>
                        <SelectItem value="withdrawal">
                          Saque (Retirar dinheiro)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transactionForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        data-testid="input-transaction-amount"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transactionForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        data-testid="input-transaction-date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsTransactionDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={transactionMutation.isPending} data-testid="button-submit-transaction">
                  {transactionMutation.isPending ? "Registrando..." : "Registrar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Goal Dialog */}
      <Dialog open={isGoalDialogOpen} onOpenChange={(open) => {
        setIsGoalDialogOpen(open);
        if (!open) {
          setSelectedInvestment(null);
          goalForm.reset();
        }
      }}>
        <DialogContent data-testid="dialog-investment-goal">
          <DialogHeader>
            <DialogTitle className="font-poppins">
              {selectedInvestment && goalsMap.get(selectedInvestment.id) ? "Editar Meta de Investimento" : "Definir Meta de Investimento"}
            </DialogTitle>
            <DialogDescription>
              {selectedInvestment && (
                <>Estabeleça uma meta financeira para <strong>{selectedInvestment.name}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <Form {...goalForm}>
            <form onSubmit={goalForm.handleSubmit(onGoalSubmit)} className="space-y-4">
              <FormField
                control={goalForm.control}
                name="targetAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Meta (R$)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="10000.00" 
                        data-testid="input-goal-amount"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsGoalDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateGoalMutation.isPending} data-testid="button-submit-goal">
                  {updateGoalMutation.isPending ? "Salvando..." : "Salvar Meta"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
