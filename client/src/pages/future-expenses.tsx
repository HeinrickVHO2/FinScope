import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { FutureExpense } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { CalendarClock, CheckCircle2, Clock, AlertCircle } from "lucide-react";

type Scope = "PF" | "PJ";
type StatusFilter = "pending" | "paid" | "overdue";

const CATEGORY_OPTIONS = [
  "Aluguel",
  "Boletos",
  "Impostos",
  "Assinaturas",
  "Educação",
  "Transporte",
  "Serviços",
  "Outros",
];

const expenseFormSchema = z.object({
  title: z.string().min(2, "Informe o título"),
  category: z.string().min(1, "Selecione uma categoria"),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  dueDate: z.coerce.date(),
  accountType: z.enum(["PF", "PJ"]).default("PF"),
  isRecurring: z.boolean().default(false),
  recurrenceType: z.enum(["monthly", "yearly"]).optional().nullable(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

const STATUS_META: Record<StatusFilter, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: "Em aberto",
    color: "text-amber-600",
    icon: <Clock className="h-4 w-4" />,
  },
  paid: {
    label: "Pago",
    color: "text-emerald-600",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  overdue: {
    label: "Atrasado",
    color: "text-rose-600",
    icon: <AlertCircle className="h-4 w-4" />,
  },
};

export default function FutureExpensesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scopeFilter, setScopeFilter] = useState<Scope>("PF");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const isPremium = user?.plan === "premium";

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      title: "",
      category: "Outros",
      amount: 0,
      dueDate: new Date(),
      accountType: "PF",
      isRecurring: false,
      recurrenceType: null,
    },
  });

  const expensesQuery = useQuery<FutureExpense[]>({
    queryKey: ["future-expenses", scopeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        accountType: scopeFilter,
        status: statusFilter,
      });
      const response = await apiRequest("GET", `/api/future-expenses?${params.toString()}`);
      return response.json();
    },
  });

  const invalidateExpenses = () => {
    queryClient.invalidateQueries({ queryKey: ["future-expenses", scopeFilter, statusFilter] });
  };

  const createExpenseMutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      const response = await apiRequest("POST", "/api/future-expenses", {
        ...values,
        dueDate: values.dueDate,
        recurrenceType: values.isRecurring ? values.recurrenceType : null,
      });
      return response.json();
    },
    onSuccess: () => {
      invalidateExpenses();
      toast({ title: "Conta a pagar criada!", description: "Ela aparecerá na lista automaticamente." });
      form.reset({
        title: "",
        category: "Outros",
        amount: 0,
        dueDate: new Date(),
        accountType: "PF",
        isRecurring: false,
        recurrenceType: null,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao cadastrar",
        description: error.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusFilter }) => {
      const endpoint =
        status === "paid"
          ? `/api/future-expenses/${id}/mark-paid`
          : `/api/future-expenses/${id}/mark-overdue`;
      const response = await apiRequest("PUT", endpoint);
      return response.json();
    },
    onSuccess: (_, variables) => {
      invalidateExpenses();
      toast({
        title: variables.status === "paid" ? "Conta marcada como paga" : "Conta marcada como atrasada",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar conta",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const expenses = useMemo(() => expensesQuery.data || [], [expensesQuery.data]);

  const handleScopeChange = (scope: Scope) => {
    if (scope === "PJ" && !isPremium) {
      toast({
        title: "Disponível no Premium",
        description: "Faça upgrade para controlar contas PJ.",
      });
      return;
    }
    setScopeFilter(scope);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Planejamento
          </p>
          <h1 className="text-3xl font-poppins font-bold">Contas a Pagar</h1>
          <p className="text-muted-foreground">
            Antecipe gastos futuros e mantenha seus boletos sob controle.
          </p>
        </div>
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
            disabled={!isPremium}
          >
            Conta Empresarial
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Contas previstas</CardTitle>
                <CardDescription>
                  Visualize e atualize pagamentos pendentes, pagos e atrasados.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {(["pending", "paid", "overdue"] as StatusFilter[]).map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    onClick={() => setStatusFilter(status)}
                  >
                    {STATUS_META[status].label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {expensesQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">Carregando contas...</p>
            ) : expenses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma conta {STATUS_META[statusFilter].label.toLowerCase()} para o filtro atual.
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex flex-col md:flex-row md:items-center justify-between rounded-xl border p-4 gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{expense.title}</p>
                        <Badge variant="outline">{expense.category}</Badge>
                        <Badge variant="secondary">{expense.accountType}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Vencimento:{" "}
                        {expense.dueDate ? new Date(expense.dueDate).toLocaleDateString("pt-BR") : "-"}
                      </p>
                      {expense.isRecurring && (
                        <p className="text-xs text-muted-foreground">
                          Recorrência: {expense.recurrenceType === "monthly" ? "Mensal" : "Anual"}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col md:items-end gap-2">
                      <p className="text-2xl font-bold text-primary">
                        R$ {Number(expense.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <div className="flex gap-2">
                        <Badge className={cn("text-xs font-medium", STATUS_META[statusFilter].color)}>
                          <span className="flex items-center gap-1">{STATUS_META[statusFilter].icon}{STATUS_META[statusFilter].label}</span>
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        {expense.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ id: expense.id, status: "paid" })}
                          >
                            Aqui já foi pago
                          </Button>
                        )}
                        {expense.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateStatusMutation.mutate({ id: expense.id, status: "overdue" })}
                          >
                            Marcar como atrasada
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nova conta a pagar</CardTitle>
            <CardDescription>Registre boletos, assinaturas ou impostos futuros.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit((values) => createExpenseMutation.mutate(values))}
              >
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Aluguel escritório" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
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
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0,00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de vencimento</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ? new Date(field.value).toISOString().split("T")[0] : ""}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de conta</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            if (value === "PJ" && !isPremium) {
                              toast({
                                title: "Exclusivo do Premium",
                                description: "Faça upgrade para registrar contas PJ.",
                              });
                              return;
                            }
                            field.onChange(value);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PF">Conta pessoal</SelectItem>
                            <SelectItem value="PJ" disabled={!isPremium}>
                              Conta empresarial
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="rounded-xl border p-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="isRecurring"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                        <div>
                          <FormLabel>Conta recorrente</FormLabel>
                          <CardDescription>Repete automaticamente todo mês ou ano.</CardDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {form.watch("isRecurring") && (
                    <FormField
                      control={form.control}
                      name="recurrenceType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recorrência</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="monthly">Mensal</SelectItem>
                              <SelectItem value="yearly">Anual</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={createExpenseMutation.isPending}>
                  {createExpenseMutation.isPending ? "Salvando..." : "Adicionar conta a pagar"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
