import { zodResolver } from "@hookform/resolvers/zod";
import type { Goal } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, CheckCircle2, PiggyBank, Plus, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "wouter";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const goalFormSchema = z.object({
  title: z.string().min(1, "Nome da meta e obrigatorio"),
  targetValue: z.string().refine((value) => Number(value) > 0, "Informe um valor maior que zero"),
  targetDate: z.string().optional(),
});

const contributionFormSchema = z.object({
  amount: z.string().refine((value) => Number(value) > 0, "Informe um valor maior que zero"),
  note: z.string().optional(),
});

type GoalFormData = z.infer<typeof goalFormSchema>;
type ContributionFormData = z.infer<typeof contributionFormSchema>;

function formatCurrency(value: string | number | null | undefined) {
  const numeric = Number(value || 0);
  return `R$ ${numeric.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function goalProgress(goal: Goal) {
  const current = Number(goal.currentValue || 0);
  const target = Math.max(1, Number(goal.targetValue || 0));
  return Math.min(100, (current / target) * 100);
}

export default function GoalsPage() {
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [isContributionDialogOpen, setIsContributionDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const { toast } = useToast();

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });

  const activeGoals = useMemo(() => goals.filter((goal) => goal.status !== "archived"), [goals]);
  const archivedGoals = useMemo(() => goals.filter((goal) => goal.status === "archived"), [goals]);

  const goalForm = useForm<GoalFormData>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: { title: "", targetValue: "", targetDate: "" },
  });

  const contributionForm = useForm<ContributionFormData>({
    resolver: zodResolver(contributionFormSchema),
    defaultValues: { amount: "", note: "" },
  });

  const refreshGoals = () => queryClient.invalidateQueries({ queryKey: ["/api/goals"] });

  const createGoalMutation = useMutation({
    mutationFn: async (data: GoalFormData) =>
      apiRequest("POST", "/api/goals", {
        title: data.title,
        targetValue: Number(data.targetValue),
        targetDate: data.targetDate ? new Date(data.targetDate).toISOString() : null,
        currentValue: 0,
        status: "active",
      }),
    onSuccess: () => {
      refreshGoals();
      goalForm.reset();
      setIsGoalDialogOpen(false);
      toast({ title: "Meta criada", description: "Sua meta ja esta disponivel para acompanhamento." });
    },
    onError: (error: Error) => toast({ title: "Erro ao criar meta", description: error.message, variant: "destructive" }),
  });

  const updateGoalMutation = useMutation({
    mutationFn: async (data: GoalFormData) => {
      if (!selectedGoal) throw new Error("Meta nao selecionada.");
      return apiRequest("PATCH", `/api/goals/${selectedGoal.id}`, {
        title: data.title,
        targetValue: Number(data.targetValue),
        targetDate: data.targetDate ? new Date(data.targetDate).toISOString() : null,
      });
    },
    onSuccess: () => {
      refreshGoals();
      goalForm.reset();
      setSelectedGoal(null);
      setIsGoalDialogOpen(false);
      toast({ title: "Meta atualizada", description: "As alteracoes foram salvas." });
    },
    onError: (error: Error) => toast({ title: "Erro ao atualizar meta", description: error.message, variant: "destructive" }),
  });

  const contributionMutation = useMutation({
    mutationFn: async (data: ContributionFormData) => {
      if (!selectedGoal) throw new Error("Meta nao selecionada.");
      return apiRequest("POST", `/api/goals/${selectedGoal.id}/contributions`, {
        amount: Number(data.amount),
        note: data.note,
      });
    },
    onSuccess: () => {
      refreshGoals();
      contributionForm.reset();
      setSelectedGoal(null);
      setIsContributionDialogOpen(false);
      toast({ title: "Aporte registrado", description: "O progresso da meta foi atualizado." });
    },
    onError: (error: Error) => toast({ title: "Erro ao registrar aporte", description: error.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: async (goalId: string) => apiRequest("POST", `/api/goals/${goalId}/complete`),
    onSuccess: () => {
      refreshGoals();
      toast({ title: "Meta concluida", description: "A meta foi marcada como concluida." });
    },
    onError: (error: Error) => toast({ title: "Erro ao concluir meta", description: error.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: async (goalId: string) => apiRequest("POST", `/api/goals/${goalId}/archive`),
    onSuccess: () => {
      refreshGoals();
      toast({ title: "Meta arquivada", description: "A meta saiu da visao principal." });
    },
    onError: (error: Error) => toast({ title: "Erro ao arquivar meta", description: error.message, variant: "destructive" }),
  });

  const openCreateDialog = () => {
    setSelectedGoal(null);
    goalForm.reset({ title: "", targetValue: "", targetDate: "" });
    setIsGoalDialogOpen(true);
  };

  const openEditDialog = (goal: Goal) => {
    setSelectedGoal(goal);
    goalForm.reset({
      title: goal.title,
      targetValue: String(Number(goal.targetValue || 0)),
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().split("T")[0] : "",
    });
    setIsGoalDialogOpen(true);
  };

  const openContributionDialog = (goal: Goal) => {
    setSelectedGoal(goal);
    contributionForm.reset({ amount: "", note: "" });
    setIsContributionDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Link href="/investments">
              <Button variant="outline">
                <PiggyBank className="mr-2 h-4 w-4" />
                Investimentos
              </Button>
            </Link>
            <Button>
              <Target className="mr-2 h-4 w-4" />
              Metas
            </Button>
          </div>
          <div>
            <h1 className="text-3xl font-poppins font-bold">Metas</h1>
            <p className="text-muted-foreground">
              Crie objetivos, acompanhe o progresso e registre novos aportes sem sair da plataforma.
            </p>
          </div>
        </div>
        <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nova meta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedGoal ? "Editar meta" : "Nova meta"}</DialogTitle>
              <DialogDescription>
                Defina o objetivo, o valor alvo e, se quiser, um prazo para acompanhar.
              </DialogDescription>
            </DialogHeader>
            <Form {...goalForm}>
              <form
                className="space-y-4"
                onSubmit={goalForm.handleSubmit((data) => {
                  if (selectedGoal) {
                    updateGoalMutation.mutate(data);
                    return;
                  }
                  createGoalMutation.mutate(data);
                })}
              >
                <FormField
                  control={goalForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meta</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex.: iPhone 16" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={goalForm.control}
                  name="targetValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor alvo</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="5399" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={goalForm.control}
                  name="targetDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prazo</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsGoalDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createGoalMutation.isPending || updateGoalMutation.isPending}>
                    {selectedGoal ? "Salvar alteracoes" : "Criar meta"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-dashed border-sky-200 bg-sky-50/40">
        <CardContent className="flex flex-col gap-2 pt-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-sky-700">Use o assistente para alimentar suas metas</p>
            <p className="text-sm text-slate-600">
              Exemplos: "crie uma meta para iPhone 16, preciso de 5399" ou "ja guardei 500 hoje".
            </p>
          </div>
          <Link href="/ai">
            <Button variant="outline">Abrir assistente</Button>
          </Link>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-64 w-full" />
          ))}
        </div>
      ) : activeGoals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Voce ainda nao criou metas</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Use este espaco para transformar objetivos financeiros em um plano acompanhado de perto.
            </p>
            <Button className="mt-4" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeira meta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeGoals.map((goal) => {
            const progress = goalProgress(goal);
            return (
              <Card key={goal.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{goal.title}</CardTitle>
                      <CardDescription>
                        {goal.targetDate ? `Prazo: ${new Date(goal.targetDate).toLocaleDateString("pt-BR")}` : "Sem prazo definido"}
                      </CardDescription>
                    </div>
                    <Badge variant={goal.status === "completed" ? "default" : "secondary"}>
                      {goal.status === "completed" ? "Concluida" : "Ativa"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span>{formatCurrency(goal.currentValue)}</span>
                      <span>{formatCurrency(goal.targetValue)}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <p className="mt-2 text-xs text-muted-foreground">{Math.round(progress)}% alcancado</p>
                  </div>
                  <div className="grid gap-2">
                    <Button onClick={() => openContributionDialog(goal)}>Registrar aporte</Button>
                    <Button variant="outline" onClick={() => openEditDialog(goal)}>Editar alvo e prazo</Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => completeMutation.mutate(goal.id)}
                      disabled={completeMutation.isPending}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Concluir
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => archiveMutation.mutate(goal.id)}
                      disabled={archiveMutation.isPending}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Arquivar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {archivedGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Arquivadas</CardTitle>
            <CardDescription>Metas concluidas ou pausadas fora da visao principal.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {archivedGoals.map((goal) => (
              <div key={goal.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{goal.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(goal.currentValue)} de {formatCurrency(goal.targetValue)}
                  </p>
                </div>
                <Badge variant="outline">Arquivada</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={isContributionDialogOpen} onOpenChange={setIsContributionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar aporte</DialogTitle>
            <DialogDescription>
              {selectedGoal ? `Adicionar valor em ${selectedGoal.title}.` : "Adicione um novo aporte."}
            </DialogDescription>
          </DialogHeader>
          <Form {...contributionForm}>
            <form
              className="space-y-4"
              onSubmit={contributionForm.handleSubmit((data) => contributionMutation.mutate(data))}
            >
              <FormField
                control={contributionForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="500" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contributionForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observacao</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex.: aporte do salario" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsContributionDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={contributionMutation.isPending}>
                  Salvar aporte
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
