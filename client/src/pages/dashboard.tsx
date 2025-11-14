import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export default function DashboardPage() {
  // Mock data - will be replaced with real data in Task 3
  const metrics = {
    totalBalance: 12450.00,
    monthlyIncome: 8500.00,
    monthlyExpenses: 4320.00,
    netCashFlow: 4180.00,
  };

  const recentTransactions = [
    { id: "1", description: "Salário", category: "Salário", type: "entrada", amount: 5000.00, date: "2025-01-10" },
    { id: "2", description: "Supermercado", category: "Alimentação", type: "saida", amount: 320.50, date: "2025-01-09" },
    { id: "3", description: "Freelance Web", category: "Freelance", type: "entrada", amount: 1500.00, date: "2025-01-08" },
    { id: "4", description: "Academia", category: "Saúde", type: "saida", amount: 89.90, date: "2025-01-07" },
    { id: "5", description: "Uber", category: "Transporte", type: "saida", amount: 45.00, date: "2025-01-07" },
  ];

  const categoryData = [
    { name: "Alimentação", value: 1250, color: "hsl(var(--chart-1))" },
    { name: "Transporte", value: 680, color: "hsl(var(--chart-2))" },
    { name: "Saúde", value: 450, color: "hsl(var(--chart-3))" },
    { name: "Lazer", value: 380, color: "hsl(var(--chart-4))" },
    { name: "Outros", value: 560, color: "hsl(var(--chart-5))" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-poppins font-bold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground" data-testid="text-dashboard-subtitle">
            Visão geral das suas finanças
          </p>
        </div>
        <Button data-testid="button-add-transaction">
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
            <div className="text-2xl font-bold font-poppins text-secondary" data-testid="text-total-balance">
              R$ {metrics.totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
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
            <div className="text-2xl font-bold font-poppins" data-testid="text-monthly-income">
              R$ {metrics.monthlyIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
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
            <div className="text-2xl font-bold font-poppins" data-testid="text-monthly-expenses">
              R$ {metrics.monthlyExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
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
            <div className="text-2xl font-bold font-poppins text-primary" data-testid="text-net-cashflow">
              R$ {metrics.netCashFlow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Receitas - Despesas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2" data-testid="card-recent-transactions">
          <CardHeader>
            <CardTitle className="font-poppins">Transações Recentes</CardTitle>
            <CardDescription>Suas últimas movimentações financeiras</CardDescription>
          </CardHeader>
          <CardContent>
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
                    {transaction.type === "entrada" ? "+" : "-"}R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Categories Chart */}
        <Card data-testid="card-top-categories">
          <CardHeader>
            <CardTitle className="font-poppins">Top Categorias</CardTitle>
            <CardDescription>Gastos por categoria este mês</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
