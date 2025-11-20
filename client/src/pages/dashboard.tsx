import { useMemo, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { type Transaction } from "@shared/schema";
import { ArrowDownRight, ArrowRight, ArrowUpRight, FileDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import ExportPdfPremiumModal from "@/components/ExportPdfPremiumModal";
import UpgradeModal from "@/components/UpgradeModal";
import { useDashboardView, type DashboardScope } from "@/context/dashboard-view";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";

interface DashboardMetrics {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  netCashFlow: number;
}

interface CategoryData {
  category: string;
  amount: number;
}

interface IncomeExpensesData {
  income: number;
  expenses: number;
}

const formatCurrency = (value = 0) =>
  `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type Scope = DashboardScope;

const scopeLabels: Record<Scope, { title: string; description: string; accent: string; badge?: string }> = {
  PF: {
    title: "Finanças Pessoais",
    description: "Tudo que envolve sua vida financeira pessoal.",
    accent: "from-indigo-500/15 via-indigo-500/5 to-transparent",
    badge: "PF",
  },
  PJ: {
    title: "Finanças Empresariais",
    description: "Fluxo de caixa do seu negócio.",
    accent: "from-purple-500/15 via-purple-500/5 to-transparent",
    badge: "Premium",
  },
  ALL: {
    title: "Visão Consolidada",
    description: "Pessoal + Empresarial combinados.",
    accent: "from-slate-500/10 via-slate-500/5 to-transparent",
    badge: "Total",
  },
};

function useDashboardScope(scope: Scope, enabled: boolean) {
  const metrics = useQuery<DashboardMetrics>({
    queryKey: [`/api/dashboard/metrics?type=${scope}`],
    enabled,
  });

  const categories = useQuery<CategoryData[]>({
    queryKey: [`/api/dashboard/categories?type=${scope}`],
    enabled,
  });

  const incomeExpenses = useQuery<IncomeExpensesData>({
    queryKey: [`/api/dashboard/income-expenses?type=${scope}`],
    enabled,
  });

  const transactions = useQuery<Transaction[]>({
    queryKey: [`/api/transactions?type=${scope}`],
    enabled,
  });

  return {
    metrics: metrics.data,
    categories: categories.data,
    incomeExpenses: incomeExpenses.data,
    transactions: transactions.data,
    loading: metrics.isLoading || categories.isLoading || incomeExpenses.isLoading || transactions.isLoading,
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isPremium = user?.plan === "premium";
  const { selectedView, setSelectedView } = useDashboardView();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const pfData = useDashboardScope("PF", true);
  const totalData = useDashboardScope("ALL", true);
  const pjData = useDashboardScope("PJ", isPremium);

  useEffect(() => {
    if (!isPremium && selectedView === "PJ") {
      setSelectedView("PF");
    }
  }, [isPremium, selectedView, setSelectedView]);

  const summaryData = useMemo(() => {
    if (selectedView === "PJ" && !isPremium) {
      return pfData;
    }
    return selectedView === "PF" ? pfData : selectedView === "PJ" ? pjData : totalData;
  }, [selectedView, pfData, pjData, totalData, isPremium]);

  const handleScopeClick = (scope: Scope) => {
    if (scope === "PJ" && !isPremium) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setSelectedView(scope);
  };

  const summaryStats = summaryData.metrics
    ? [
        { label: "Saldo", value: summaryData.metrics.totalBalance },
        { label: "Receitas", value: summaryData.metrics.monthlyIncome },
        { label: "Despesas", value: summaryData.metrics.monthlyExpenses },
        { label: "Fluxo", value: summaryData.metrics.netCashFlow },
      ]
    : [];

  return (
    <div className="p-6 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Finanças integradas</p>
          <h1 className="text-3xl font-poppins font-bold">Dashboard Unificado</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => handleScopeClick("PF")}
            className={cn(selectedView === "PF" && "border-indigo-500 text-indigo-600")}
          >
            Conta Pessoal
          </Button>
          <Button
            variant="outline"
            onClick={() => handleScopeClick("PJ")}
            className={cn(selectedView === "PJ" && "border-purple-500 text-purple-600")}
            aria-disabled={!isPremium}
          >
            Conta Empresarial
            {!isPremium && <Lock className="ml-2 h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedView("ALL")}
            className={cn(selectedView === "ALL" && "border-slate-500 text-slate-600")}
          >
            Visão Total
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (!isPremium) {
                setIsUpgradeModalOpen(true);
                return;
              }
              setIsExportModalOpen(true);
            }}
            className={cn(!isPremium && "opacity-60")}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar PDF Premium
            {!isPremium && <Lock className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Resumo do contexto selecionado</p>
            <h2 className="text-2xl font-semibold text-slate-900">
              {scopeLabels[selectedView].title}
            </h2>
          </div>
          <Badge variant="secondary">{selectedView === "ALL" ? "PF + PJ" : scopeLabels[selectedView].badge || "PF"}</Badge>
        </div>
        {summaryData.loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {summaryStats.map((stat) => (
              <Card key={stat.label} className="border-none bg-slate-50">
                <CardHeader className="pb-2">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{formatCurrency(stat.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {selectedView === "PF" && <DashboardBlock scope="PF" data={pfData} />}
      {selectedView === "PJ" &&
        (isPremium ? <DashboardBlock scope="PJ" data={pjData} premium /> : <LockedCard onUpgrade={() => setIsUpgradeModalOpen(true)} />)}
      {selectedView === "ALL" && <DashboardBlock scope="ALL" data={totalData} />}

      <ExportPdfPremiumModal open={isExportModalOpen} onOpenChange={setIsExportModalOpen} />
      <UpgradeModal open={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen} featureName="Relatórios Premium" />
    </div>
  );
}

interface DashboardBlockProps {
  scope: Scope;
  data: ReturnType<typeof useDashboardScope>;
  premium?: boolean;
}

function DashboardBlock({ scope, data, premium }: DashboardBlockProps) {
  const { title, description, accent, badge } = scopeLabels[scope];
  const transactions = data.transactions?.slice(0, 5) || [];
  const categories = data.categories || [];
  const pieData = useMemo(
    () => categories.map((item) => ({ name: item.category, value: item.amount })),
    [categories]
  );
  const chartPalette =
    scope === "PF"
      ? ["#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"]
      : scope === "PJ"
      ? ["#7c3aed", "#8b5cf6", "#a855f7", "#c084fc", "#ddd6fe"]
      : ["#334155", "#475569", "#64748b", "#94a3b8", "#cbd5f5"];

  const monthlySeries = useMemo(() => {
    const map = new Map<string, { label: string; entradas: number; saidas: number; order: number }>();
    (data.transactions || []).forEach((tx) => {
      const date = new Date(tx.date);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      if (!map.has(key)) {
        map.set(key, {
          label: date.toLocaleDateString("pt-BR", { month: "short" }),
          entradas: 0,
          saidas: 0,
          order: date.getTime(),
        });
      }
      const entry = map.get(key)!;
      const amount = Number(tx.amount) || 0;
      if (tx.type === "entrada") entry.entradas += amount;
      else entry.saidas += amount;
    });
    return Array.from(map.values())
      .sort((a, b) => a.order - b.order)
      .slice(-6);
  }, [data.transactions]);

  return (
    <section className="rounded-3xl border bg-white shadow-sm overflow-hidden">
      <div className={cn("p-6 border-b", `bg-gradient-to-br ${accent}`)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{scope === "PF" ? "Conta pessoal" : scope === "PJ" ? "Conta empresarial" : "Consolidado"}</p>
            <h3 className="text-2xl font-semibold text-slate-900 mt-1">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          <Badge variant="secondary">{badge}</Badge>
        </div>
      </div>
      <div className="p-6 space-y-6">
        {data.loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SmallStat label="Saldo" value={data.metrics?.totalBalance} />
            <SmallStat label="Receitas" value={data.metrics?.monthlyIncome} trend="up" />
            <SmallStat label="Despesas" value={data.metrics?.monthlyExpenses} trend="down" />
            <SmallStat label="Fluxo" value={data.metrics?.netCashFlow} />
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top categorias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.loading ? (
                <Skeleton className="h-48 w-full" />
              ) : pieData.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {pieData.map((_entry, index) => (
                        <Cell key={_entry.name} fill={chartPalette[index % chartPalette.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Sem categorias registradas.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fluxo mensal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.loading ? (
                <Skeleton className="h-48 w-full" />
              ) : monthlySeries.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={monthlySeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="entradas" fill="#10b981" name="Receitas" />
                    <Bar dataKey="saidas" fill="#ef4444" name="Despesas" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Sem histórico suficiente.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimas movimentações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.loading ? (
                <Skeleton className="h-32 w-full" />
              ) : transactions.length ? (
                transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("font-semibold", tx.type === "entrada" ? "text-emerald-600" : "text-rose-600")}>{tx.type === "entrada" ? "+" : "-"}{formatCurrency(Number(tx.amount))}</p>
                      <p className="text-xs text-muted-foreground">{tx.category}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sem movimentos recentes.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {premium ? (
        <div className="border-t bg-slate-50 px-6 py-4 text-sm text-slate-500 flex items-center gap-2">
          <ArrowRight className="h-4 w-4" />
          Exclusivo para clientes Premium
        </div>
      ) : null}
    </section>
  );
}

function SmallStat({ label, value, trend }: { label: string; value?: number; trend?: "up" | "down" }) {
  return (
    <Card className="border-none bg-slate-50">
      <CardHeader className="pb-2">
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <p className="text-2xl font-semibold">{formatCurrency(value)}</p>
        {trend === "up" && <ArrowUpRight className="h-4 w-4 text-emerald-500" />}
        {trend === "down" && <ArrowDownRight className="h-4 w-4 text-rose-500" />}
      </CardContent>
    </Card>
  );
}

function LockedCard({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <section className="rounded-3xl border bg-white shadow-sm p-10 text-center space-y-4">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50">
        <Lock className="h-8 w-8 text-purple-500" />
      </div>
      <h3 className="text-2xl font-semibold">Finanças empresariais bloqueadas</h3>
      <p className="text-muted-foreground max-w-2xl mx-auto">
        Atualize para o plano Premium e acompanhe faturamento, despesas PJ e relatórios exclusivos para MEI e empresas.
      </p>
      <Button onClick={onUpgrade} className="mt-2">Desbloquear com Premium</Button>
    </section>
  );
}
