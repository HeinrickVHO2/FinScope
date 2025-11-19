import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, TrendingDown, FileText, Lock, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import type { Account, Transaction } from "@shared/schema";
import { useLocation } from "wouter";

export default function MEIPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Fetch accounts and transactions
  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  if (authLoading || accountsLoading || transactionsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  
  if (!user) {
    return null;
  }

  const currentPlan = user.plan;
  const isPremium = currentPlan === "premium";

  const BUSINESS_ACCOUNT_TYPES = new Set(["pj", "empresa", "mei"]);
  const businessAccounts = accounts.filter(acc => BUSINESS_ACCOUNT_TYPES.has(String(acc.type).toLowerCase()));

  const businessAccountIds = new Set(businessAccounts.map(acc => acc.id));
  const businessTransactions = transactions.filter(t => businessAccountIds.has(t.accountId));

  // Calculate business metrics
  const revenue = businessTransactions
    .filter(t => t.type === "entrada")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const expenses = businessTransactions
    .filter(t => t.type === "saida")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const businessMetrics = {
    revenue,
    expenses,
    netProfit: revenue - expenses,
  };

  // Group transactions by month for chart (sorted chronologically)
  const monthlyDataMap = new Map<string, { month: string; receitas: number; despesas: number; timestamp: number }>();
  
  businessTransactions.forEach(t => {
    const date = new Date(t.date);
    const month = date.toLocaleDateString('pt-BR', { month: 'short' });
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = monthlyDataMap.get(yearMonth) || { month, receitas: 0, despesas: 0, timestamp: date.getTime() };
    
    if (t.type === "entrada") {
      current.receitas += Number(t.amount);
    } else {
      current.despesas += Number(t.amount);
    }
    
    monthlyDataMap.set(yearMonth, current);
  });

  const monthlyData = Array.from(monthlyDataMap.values())
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-6) // Last 6 months
    .map(({ month, receitas, despesas }) => ({ month, receitas, despesas }));

  // Get recent business transactions
  const recentBusinessTransactions = businessTransactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  if (!isPremium) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-poppins font-bold" data-testid="text-mei-title">Gestão MEI</h1>
          <p className="text-muted-foreground" data-testid="text-mei-subtitle">
            Controle financeiro para seu microempreendimento
          </p>
        </div>

        <Card className="border-primary/50 bg-primary/5" data-testid="card-premium-required">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-poppins font-semibold mb-2">Recurso Premium</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              A gestão MEI está disponível apenas no plano Premium. 
              Faça upgrade para ter acesso completo ao controle financeiro do seu negócio.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" data-testid="button-learn-more">
                Saiba Mais
              </Button>
              <Button
                data-testid="button-upgrade"
                onClick={() => setLocation("/settings?checkout=upgrade")}
              >
                Fazer Upgrade
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Receitas Totais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-poppins blur-sm">R$ XX.XXX,XX</div>
            </CardContent>
          </Card>
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Despesas Totais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-poppins blur-sm">R$ XX.XXX,XX</div>
            </CardContent>
          </Card>
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-poppins blur-sm">R$ XX.XXX,XX</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-poppins font-bold" data-testid="text-mei-title">Gestão MEI</h1>
          <p className="text-muted-foreground" data-testid="text-mei-subtitle">
            Controle financeiro do seu microempreendimento
          </p>
        </div>
        <Badge variant="default" data-testid="badge-premium">
          Premium
        </Badge>
      </div>

      {/* Business Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-revenue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas Totais</CardTitle>
            <DollarSign className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-poppins text-secondary" data-testid="text-revenue">
              R$ {businessMetrics.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Este mês
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-expenses">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas Totais</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-poppins" data-testid="text-expenses">
              R$ {businessMetrics.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Este mês
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-profit">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-poppins text-primary" data-testid="text-profit">
              R$ {businessMetrics.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receitas - Despesas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Chart */}
      <Card data-testid="card-cashflow-chart">
        <CardHeader>
          <CardTitle className="font-poppins">Fluxo de Caixa Empresarial</CardTitle>
          <CardDescription>Comparativo de receitas e despesas dos últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Bar dataKey="receitas" fill="hsl(var(--secondary))" name="Receitas" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" fill="hsl(var(--destructive))" name="Despesas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Business Transactions */}
      <Card data-testid="card-business-transactions">
        <CardHeader>
          <CardTitle className="font-poppins">Movimentações Recentes</CardTitle>
          <CardDescription>Últimas transações empresariais</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentBusinessTransactions.map((transaction, index) => {
              const isIncome = transaction.type === "entrada";
              return (
                <div 
                  key={transaction.id} 
                  className="flex items-center justify-between p-3 rounded-lg hover-elevate"
                  data-testid={`business-transaction-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      isIncome ? "bg-secondary/10" : "bg-destructive/10"
                    }`}>
                      {isIncome ? (
                        <ArrowUpRight className="h-5 w-5 text-secondary" />
                      ) : (
                        <ArrowDownRight className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium" data-testid={`text-business-description-${index}`}>
                        {transaction.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-business-category-${index}`}>
                          {transaction.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(transaction.date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`text-right font-semibold ${
                    isIncome ? "text-secondary" : "text-foreground"
                  }`} data-testid={`text-business-amount-${index}`}>
                    {isIncome ? "+" : "-"}R$ {Number(transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
