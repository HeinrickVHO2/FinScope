import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import type { Account, Transaction } from "@shared/schema";
import { useLocation } from "wouter";
import { ArrowDownRight, ArrowUpRight, BarChart3, Building2, Lock, TrendingUp, TrendingDown } from "lucide-react";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Bar, Tooltip, Legend } from "recharts";
import CaktoCheckoutModal from "@/components/CaktoCheckoutModal";

type ViewMode = "pj" | "mei";

export default function MEIPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("pj");
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const loading = authLoading || accountsLoading || transactionsLoading;
  const isPremium = user?.plan === "premium";

  const businessAccounts = useMemo(
    () => accounts.filter((acc) => acc.type === "pj"),
    [accounts]
  );
  const meiAccounts = useMemo(
    () => businessAccounts.filter((acc) => acc.businessCategory === "mei"),
    [businessAccounts]
  );

  const selectedAccounts = viewMode === "pj" ? businessAccounts : meiAccounts;
  const selectedAccountIds = new Set(selectedAccounts.map((acc) => acc.id));
  const businessTransactions = transactions.filter((tx) => selectedAccountIds.has(tx.accountId));

  const metrics = useMemo(() => {
    const revenue = businessTransactions
      .filter((tx) => tx.type === "entrada")
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
    const expenses = businessTransactions
      .filter((tx) => tx.type === "saida")
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    return {
      revenue,
      expenses,
      net: revenue - expenses,
    };
  }, [businessTransactions]);

  const monthlyBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; receitas: number; despesas: number; order: number }>();
    businessTransactions.forEach((tx) => {
      const date = new Date(tx.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) {
        map.set(key, {
          label: date.toLocaleDateString("pt-BR", { month: "short" }),
          receitas: 0,
          despesas: 0,
          order: date.getTime(),
        });
      }
      const entry = map.get(key)!;
      if (tx.type === "entrada") {
        entry.receitas += Number(tx.amount);
      } else {
        entry.despesas += Number(tx.amount);
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.order - b.order)
      .slice(-6);
  }, [businessTransactions]);

  const recentTransactions = businessTransactions
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!user) return null;

  if (!isPremium) {
    return (
      <>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-poppins font-bold">Gestão Empresarial</h1>
            <p className="text-muted-foreground">
              Consolide suas contas PJ/MEI, acompanhe fluxo de caixa e gere relatórios dedicados.
            </p>
          </div>
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold font-poppins">Recurso exclusivo do Premium</h3>
              <p className="max-w-xl text-muted-foreground">
                Faça upgrade para acessar dashboards empresariais, insights por CNPJ e relatórios executivos.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setLocation("/settings")} data-testid="button-learn-more">
                  Conhecer planos
                </Button>
                <Button onClick={() => setIsUpgradeModalOpen(true)} data-testid="button-upgrade">
                  Fazer upgrade
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <CaktoCheckoutModal
          open={isUpgradeModalOpen}
          onOpenChange={setIsUpgradeModalOpen}
          intent="upgrade"
        />
      </>
    );
  }

  return (
    <>
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-poppins font-bold">Gestão PJ & MEI</h1>
          <p className="text-muted-foreground">
            Acompanhe fluxo de caixa empresarial e destaque contas marcadas como MEI.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={viewMode === "pj" ? "default" : "outline"} onClick={() => setViewMode("pj")}>
            Todas as contas PJ
          </Button>
          <Button
            variant={viewMode === "mei" ? "default" : "outline"}
            onClick={() => setViewMode("mei")}
            disabled={meiAccounts.length === 0}
          >
            Somente MEI
          </Button>
        </div>
      </div>

      {selectedAccounts.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto" />
          <h3 className="font-semibold">Nenhuma conta {viewMode === "mei" ? "MEI" : "PJ"} encontrada</h3>
          <p className="text-sm text-muted-foreground">
            Adicione contas PJ e marque-as como MEI dentro do cadastro para vê-las aqui.
          </p>
          <Button onClick={() => setLocation("/accounts")}>Adicionar conta PJ</Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Receitas</CardTitle>
                  <CardDescription>Entradas por contas {viewMode.toUpperCase()}</CardDescription>
                </div>
                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  R$ {metrics.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Despesas</CardTitle>
                  <CardDescription>Saídas registradas</CardDescription>
                </div>
                <ArrowDownRight className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  R$ {metrics.expenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
                  <CardDescription>Receitas - Despesas</CardDescription>
                </div>
                <TrendingUp className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${metrics.net >= 0 ? "text-primary" : "text-destructive"}`}>
                  R$ {metrics.net.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fluxo de Caixa (6 meses)</CardTitle>
                <CardDescription>Tendência de receitas e despesas das contas selecionadas</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    Cadastre movimentações para visualizar o histórico.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthlyBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="receitas" fill="#10b981" name="Receitas" />
                      <Bar dataKey="despesas" fill="#ef4444" name="Despesas" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Contas empresariais</CardTitle>
                <CardDescription>Resumo das contas PJ cadastradas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between border rounded-xl p-3">
                    <div>
                      <p className="font-semibold">{account.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="secondary">
                          {account.businessCategory === "mei" ? "PJ · MEI" : "PJ"}
                        </Badge>
                        <span>Saldo inicial: R$ {Number(account.initialBalance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Últimas movimentações</CardTitle>
              <CardDescription>Operações relacionadas às contas selecionadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma movimentação recente nas contas selecionadas.
                </p>
              ) : (
                recentTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between border rounded-xl p-3">
                    <div>
                      <p className="font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString("pt-BR")} · {tx.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.type === "entrada" ? "text-emerald-600" : "text-rose-600"}`}>
                        {tx.type === "entrada" ? "+" : "-"}R$ {Number(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
    <CaktoCheckoutModal
      open={isUpgradeModalOpen}
      onOpenChange={setIsUpgradeModalOpen}
      intent="upgrade"
    />
    </>
  );
}
