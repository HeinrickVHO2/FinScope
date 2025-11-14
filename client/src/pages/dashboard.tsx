import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Plus, PiggyBank, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { type Transaction, INVESTMENT_TYPES } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

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

interface InvestmentsSummary {
  totalInvested: number;
  byType: { type: string; amount: number; goal?: number }[];
}

interface IncomeExpensesData {
  income: number;
  expenses: number;
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();

  // Fetch dashboard metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
  });

  // Fetch category breakdown
  const { data: categories, isLoading: categoriesLoading } = useQuery<CategoryData[]>({
    queryKey: ["/api/dashboard/categories"],
  });

  // Fetch investments summary
  const { data: investments, isLoading: investmentsLoading } = useQuery<InvestmentsSummary>({
    queryKey: ["/api/dashboard/investments"],
  });

  // Fetch income vs expenses data
  const { data: incomeExpenses, isLoading: incomeExpensesLoading } = useQuery<IncomeExpensesData>({
    queryKey: ["/api/dashboard/income-expenses"],
  });

  // Fetch recent transactions
  const { data: allTransactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  // Get only the 5 most recent transactions
  const recentTransactions = allTransactions?.slice(0, 5) || [];

  // Transform category data for the chart
  const chartColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  const categoryData = categories?.map((cat, index) => ({
    name: cat.category,
    value: cat.amount,
    color: chartColors[index % chartColors.length],
  })) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-poppins font-bold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground" data-testid="text-dashboard-subtitle">
            Visão geral das suas finanças
          </p>
        </div>
        <Button onClick={() => setLocation("/transactions")} data-testid="button-add-transaction">
          <Plus className="mr-2 h-4 w-4" />
          Nova Transação
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-metric-balance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold font-poppins text-secondary" data-testid="text-total-balance">
                R$ {(metrics?.totalBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Todas as contas
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-metric-income">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas do Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold font-poppins" data-testid="text-monthly-income">
                R$ {(metrics?.monthlyIncome || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            )}
            <div className="flex items-center text-xs text-secondary mt-1">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              +12% vs mês anterior
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-metric-expenses">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas do Mês</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold font-poppins" data-testid="text-monthly-expenses">
                R$ {(metrics?.monthlyExpenses || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            )}
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <ArrowDownRight className="h-3 w-3 mr-1" />
              -5% vs mês anterior
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-metric-cashflow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fluxo de Caixa</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold font-poppins text-primary" data-testid="text-net-cashflow">
                R$ {(metrics?.netCashFlow || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Receitas - Despesas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expenses Chart */}
      <Card data-testid="card-income-expenses-chart">
        <CardHeader>
          <CardTitle className="font-poppins">Receitas x Despesas</CardTitle>
          <CardDescription>Comparativo de entradas e saídas</CardDescription>
        </CardHeader>
        <CardContent>
          {incomeExpensesLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : incomeExpenses ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={[
                  {
                    name: "Receitas",
                    valor: incomeExpenses.income,
                    fill: "hsl(var(--chart-1))",
                  },
                  {
                    name: "Despesas",
                    valor: incomeExpenses.expenses,
                    fill: "hsl(var(--chart-2))",
                  },
                ]}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) =>
                    `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  }
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Bar dataKey="valor" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhum dado encontrado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Investments Section */}
      {investments && investments.byType.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-poppins font-bold" data-testid="text-investments-section-title">Investimentos</h2>
            <Button variant="outline" size="sm" onClick={() => setLocation("/investments")} data-testid="button-new-investment">
              <Plus className="mr-2 h-4 w-4" />
              Novo Investimento
            </Button>
          </div>
          
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Investment Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Total Invested Card */}
              <Card data-testid="card-total-invested">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Investido</CardTitle>
                  <PiggyBank className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  {investmentsLoading ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    <div className="text-2xl font-bold font-poppins text-primary" data-testid="text-total-invested">
                      R$ {(investments?.totalInvested || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Patrimônio em investimentos
                  </p>
                </CardContent>
              </Card>

              {/* Investment by Type Cards */}
              {investments?.byType.slice(0, 3).map((inv, idx) => {
                const investmentType = INVESTMENT_TYPES.find(t => t.value === inv.type);
                const progress = inv.goal ? (inv.amount / inv.goal) * 100 : 0;
                
                return (
                  <Card key={inv.type} data-testid={`card-investment-type-${idx}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{investmentType?.label || inv.type}</CardTitle>
                      {inv.goal && <Target className="h-4 w-4 text-muted-foreground" />}
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold font-poppins" data-testid={`text-investment-amount-${idx}`}>
                        R$ {inv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      {inv.goal ? (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Meta: R$ {inv.goal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <span className="font-medium">{Math.min(progress, 100).toFixed(0)}%</span>
                          </div>
                          <Progress value={Math.min(progress, 100)} className="h-2" />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          Sem meta definida
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Investments Allocation Chart */}
            <Card data-testid="card-investments-chart">
              <CardHeader>
                <CardTitle className="font-poppins">Alocação de Investimentos</CardTitle>
                <CardDescription>Distribuição do seu portfólio</CardDescription>
              </CardHeader>
              <CardContent>
                {investmentsLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : investments && investments.byType.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={investments.byType.map((inv, idx) => {
                          const investmentType = INVESTMENT_TYPES.find(t => t.value === inv.type);
                          return {
                            name: investmentType?.label || inv.type,
                            value: inv.amount,
                            color: chartColors[idx % chartColors.length],
                          };
                        })}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {investments.byType.map((inv, index) => (
                          <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum investimento encontrado
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2" data-testid="card-recent-transactions">
          <CardHeader>
            <CardTitle className="font-poppins">Transações Recentes</CardTitle>
            <CardDescription>Suas últimas movimentações financeiras</CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma transação encontrada
              </p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((transaction, index) => (
                  <div 
                    key={transaction.id} 
                    className="flex items-center justify-between p-3 rounded-lg hover-elevate"
                    data-testid={`transaction-item-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        transaction.type === "entrada" ? "bg-secondary/10" : "bg-destructive/10"
                      }`}>
                        {transaction.type === "entrada" ? (
                          <ArrowUpRight className="h-5 w-5 text-secondary" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium" data-testid={`text-transaction-description-${index}`}>
                          {transaction.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-category-${index}`}>
                            {transaction.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(transaction.date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={`text-right font-semibold ${
                      transaction.type === "entrada" ? "text-secondary" : "text-foreground"
                    }`} data-testid={`text-transaction-amount-${index}`}>
                      {transaction.type === "entrada" ? "+" : "-"}R$ {Number(transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Categories Chart */}
        <Card data-testid="card-top-categories">
          <CardHeader>
            <CardTitle className="font-poppins">Top Categorias</CardTitle>
            <CardDescription>Gastos por categoria este mês</CardDescription>
          </CardHeader>
          <CardContent>
            {categoriesLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : categoryData.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">
                Nenhum gasto registrado
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
