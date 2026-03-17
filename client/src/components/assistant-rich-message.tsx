import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

type GenericPayload = Record<string, any> | null | undefined;

const PIE_COLORS = ["#0f766e", "#3b82f6", "#7c3aed", "#f59e0b", "#ef4444", "#14b8a6"];

function formatCurrency(value: number | string | null | undefined) {
  const numeric = Number(value || 0);
  return `R$ ${numeric.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function percentage(value: number | string | null | undefined) {
  return `${Math.round(Number(value || 0))}%`;
}

function renderCards(cards: Array<Record<string, any>> | undefined) {
  if (!cards?.length) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {cards.map((card, index) => (
        <div key={`${card.label || card.title || "card"}-${index}`} className="rounded-xl border bg-background/80 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label || card.title || "Dado"}</p>
          <p className="mt-1 text-lg font-semibold">
            {typeof card.value === "number" ? formatCurrency(card.value) : String(card.value ?? card.amount ?? "-")}
          </p>
          {card.goal != null && <p className="mt-1 text-xs text-muted-foreground">Meta: {formatCurrency(card.goal)}</p>}
          {card.scope && <p className="mt-1 text-xs text-muted-foreground">Escopo: {card.scope}</p>}
          {card.dayOfMonth && <p className="mt-1 text-xs text-muted-foreground">Dia {card.dayOfMonth} · mensal</p>}
          {card.status && <p className="mt-1 text-xs text-muted-foreground">Status: {String(card.status)}</p>}
        </div>
      ))}
    </div>
  );
}

export function AssistantRichMessage({ payload }: { payload?: GenericPayload }) {
  const uiPayload = payload?.ui_payload;
  if (!uiPayload?.type) return null;

  if (uiPayload.type === "financial_summary") {
    const series = uiPayload.chart?.series || [];
    const breakdownSeries = uiPayload.chart?.breakdownSeries || [];
    const largestExpense = uiPayload.chart?.largestExpense;
    const increaseExplanation = uiPayload.chart?.increaseExplanation;
    return (
      <Card className="mt-3 overflow-hidden border-primary/20 bg-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">{uiPayload.title || "Resumo financeiro"}</CardTitle>
          <p className="text-sm text-muted-foreground">{uiPayload.subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderCards(uiPayload.cards)}
          <div className="h-56 rounded-xl border bg-muted/30 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={42} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="amount" fill="#22c55e" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {!!breakdownSeries.length && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,240px),1fr]">
              <div className="h-56 rounded-xl border bg-muted/30 p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={breakdownSeries} dataKey="value" nameKey="label" innerRadius={44} outerRadius={76} paddingAngle={2}>
                      {breakdownSeries.map((_: unknown, index: number) => (
                        <Cell key={`summary-cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {breakdownSeries.slice(0, 5).map((item: Record<string, any>, index: number) => (
                  <div key={`${item.label}-${index}`} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(item.value)} · {percentage(Number(item.share || 0) * 100)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(largestExpense || increaseExplanation) && (
            <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
              {largestExpense && (
                <p className="text-sm">
                  <span className="font-semibold">Maior gasto:</span> {String(largestExpense.description)} em {String(largestExpense.category)} ({formatCurrency(largestExpense.amount)}).
                </p>
              )}
              {increaseExplanation && <p className="text-sm text-muted-foreground">{String(increaseExplanation)}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (uiPayload.type === "expense_breakdown") {
    const series = uiPayload.chart?.series || [];
    return (
      <Card className="mt-3 overflow-hidden border-primary/20 bg-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">{uiPayload.title || "Divisão de gastos"}</CardTitle>
          <p className="text-sm text-muted-foreground">{uiPayload.subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-64 rounded-xl border bg-muted/30 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={series} dataKey="value" nameKey="label" innerRadius={50} outerRadius={82} paddingAngle={2}>
                  {series.map((_: unknown, index: number) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {series.map((item: Record<string, any>, index: number) => (
              <div key={`${item.label}-${index}`} className="flex items-center gap-3 rounded-lg border p-3">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(item.value)} · {percentage(Number(item.share || 0) * 100)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (uiPayload.type === "goal_progress") {
    const progress = uiPayload.progress || {};
    return (
      <Card className="mt-3 overflow-hidden border-primary/20 bg-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">{uiPayload.title || "Meta"}</CardTitle>
          <p className="text-sm text-muted-foreground">Acompanhe a evolução do objetivo</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-4xl font-bold">{percentage(progress.percentage)}</p>
            <p className="text-sm text-muted-foreground">da meta</p>
          </div>
          <Progress value={Number(progress.percentage || 0)} className="h-3" />
          <div className="flex items-center justify-between text-sm font-medium">
            <span>{formatCurrency(progress.current)}</span>
            <span>{formatCurrency(progress.target)}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (uiPayload.type === "largest_expense") {
    const item = uiPayload.chart?.item;
    return (
      <Card className="mt-3 overflow-hidden border-primary/20 bg-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">{uiPayload.title || "Maior gasto"}</CardTitle>
          <p className="text-sm text-muted-foreground">{uiPayload.subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderCards(uiPayload.cards)}
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">Descricao</p>
            <p className="text-lg font-semibold">{String(item?.description || "-")}</p>
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span>{String(item?.category || "-")}</span>
              <span className="font-semibold">{formatCurrency(item?.amount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (uiPayload.type === "goals_list") {
    return (
      <Card className="mt-3 overflow-hidden border-primary/20 bg-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">{uiPayload.title || "Metas"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(uiPayload.cards || []).map((goal: Record<string, any>, index: number) => (
            <div key={`${goal.title}-${index}`} className="rounded-xl border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{goal.title}</p>
                <span className="text-sm text-muted-foreground">{percentage(goal.percentage)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatCurrency(goal.current)} de {formatCurrency(goal.target)}
              </p>
              <Progress value={Number(goal.percentage || 0)} className="mt-3 h-2" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (uiPayload.type === "limits_overview") {
    return (
      <Card className="mt-3 overflow-hidden border-primary/20 bg-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">{uiPayload.title || "Limites de gastos"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(uiPayload.limits || []).map((limit: Record<string, any>, index: number) => (
            <div key={`${limit.category}-${index}`} className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{limit.category}</span>
                <span className="text-sm text-emerald-700">{percentage(Number(limit.utilization || 0) * 100)}</span>
              </div>
              <Progress value={Number(limit.utilization || 0) * 100} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {formatCurrency(limit.spent)} de {formatCurrency(limit.limit)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (uiPayload.type === "reminder_created" || uiPayload.type === "reminder_paid" || uiPayload.type === "limit_saved" || uiPayload.type === "investment_summary" || uiPayload.type === "navigation") {
    return (
      <Card className="mt-3 overflow-hidden border-primary/20 bg-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">{uiPayload.title || "Resumo"}</CardTitle>
          {uiPayload.subtitle && <p className="text-sm text-muted-foreground">{uiPayload.subtitle}</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          {renderCards(uiPayload.cards)}
          {uiPayload.route && <p className="text-sm text-muted-foreground">Abrir em: {uiPayload.route}</p>}
        </CardContent>
      </Card>
    );
  }

  return null;
}
