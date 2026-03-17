import type { CategoryLimit, Transaction } from "@shared/schema";
import type { IStorage } from "../../storage";

export type SummaryPeriodKey =
  | "last_7_days"
  | "current_week"
  | "previous_week"
  | "current_month"
  | "previous_month";

export type FinancialSummaryPayload = {
  period: {
    key: SummaryPeriodKey;
    label: string;
    start: string;
    end: string;
  };
  totals: {
    income: number;
    expenses: number;
    balance: number;
  };
  comparison: {
    incomeDelta: number;
    expensesDelta: number;
    balanceDelta: number;
  };
  categories: Array<{
    category: string;
    amount: number;
    share: number;
  }>;
  topExpense: {
    category: string;
    amount: number;
  } | null;
  largestExpense: {
    description: string;
    category: string;
    amount: number;
    date: string;
  } | null;
  dailyExpenses: Array<{
    date: string;
    label: string;
    amount: number;
  }>;
  increaseExplanation: string | null;
  limits: Array<{
    category: string;
    spent: number;
    limit: number;
    remaining: number;
    utilization: number;
    status: "ok" | "warning" | "exceeded";
  }>;
};

type SummaryPeriodRange = {
  key: SummaryPeriodKey;
  label: string;
  start: Date;
  end: Date;
  comparisonStart: Date;
  comparisonEnd: Date;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function rangeForPeriod(key: SummaryPeriodKey, reference = new Date()): SummaryPeriodRange {
  const today = startOfDay(reference);
  const weekDay = today.getDay() || 7;
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - weekDay + 1);

  if (key === "last_7_days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const comparisonEnd = new Date(start);
    const comparisonStart = new Date(start);
    comparisonStart.setDate(comparisonStart.getDate() - 7);
    return { key, label: "ultimos 7 dias", start, end: endOfDay(today), comparisonStart, comparisonEnd };
  }

  if (key === "current_week") {
    const comparisonStart = new Date(currentWeekStart);
    comparisonStart.setDate(comparisonStart.getDate() - 7);
    return {
      key,
      label: "esta semana",
      start: currentWeekStart,
      end: endOfDay(today),
      comparisonStart,
      comparisonEnd: currentWeekStart,
    };
  }

  if (key === "previous_week") {
    const end = new Date(currentWeekStart);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    const comparisonStart = new Date(start);
    comparisonStart.setDate(comparisonStart.getDate() - 7);
    return { key, label: "semana passada", start, end, comparisonStart, comparisonEnd: start };
  }

  if (key === "previous_month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 1);
    const comparisonStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    return { key, label: "mes passado", start, end, comparisonStart, comparisonEnd: start };
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const comparisonStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return {
    key: "current_month",
    label: "este mes",
    start,
    end: endOfDay(today),
    comparisonStart,
    comparisonEnd: start,
  };
}

function filterTransactionsByRange(transactions: Transaction[], start: Date, end: Date) {
  return transactions.filter((transaction) => {
    const date = new Date(transaction.date);
    return date >= start && date < end;
  });
}

function summarizeTotals(transactions: Transaction[]) {
  const income = transactions
    .filter((item) => item.type === "entrada")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenses = transactions
    .filter((item) => item.type === "saida")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    income: Number(income.toFixed(2)),
    expenses: Number(expenses.toFixed(2)),
    balance: Number((income - expenses).toFixed(2)),
  };
}

function buildCategoryBreakdown(transactions: Transaction[]) {
  const totals = new Map<string, number>();
  const totalExpenses = transactions
    .filter((item) => item.type === "saida")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  for (const transaction of transactions) {
    if (transaction.type !== "saida") continue;
    const key = transaction.category || "Outros";
    totals.set(key, (totals.get(key) || 0) + Number(transaction.amount || 0));
  }

  return Array.from(totals.entries())
    .map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
      share: totalExpenses > 0 ? Number((amount / totalExpenses).toFixed(4)) : 0,
    }))
    .sort((left, right) => right.amount - left.amount);
}

function buildDailyExpenseSeries(transactions: Transaction[], start: Date, end: Date) {
  const totals = new Map<string, number>();
  const cursor = new Date(start);

  while (cursor < end) {
    const key = cursor.toISOString().slice(0, 10);
    totals.set(key, 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const transaction of transactions) {
    if (transaction.type !== "saida") continue;
    const key = new Date(transaction.date).toISOString().slice(0, 10);
    if (!totals.has(key)) continue;
    totals.set(key, (totals.get(key) || 0) + Number(transaction.amount || 0));
  }

  return Array.from(totals.entries()).map(([date, amount]) => ({
    date,
    label: new Date(date).toLocaleDateString("pt-BR", { weekday: "short" }),
    amount: Number(amount.toFixed(2)),
  }));
}

function explainExpenseIncrease(
  currentCategories: ReturnType<typeof buildCategoryBreakdown>,
  previousCategories: ReturnType<typeof buildCategoryBreakdown>,
) {
  if (!currentCategories.length) return null;

  const previousMap = new Map(previousCategories.map((item) => [item.category, item.amount]));
  const rankedIncreases = currentCategories
    .map((item) => ({
      category: item.category,
      delta: item.amount - (previousMap.get(item.category) || 0),
    }))
    .sort((left, right) => right.delta - left.delta);

  const winner = rankedIncreases[0];
  if (!winner || winner.delta <= 0) return null;
  return `${winner.category} puxou a alta com ${formatCurrency(winner.delta)} a mais no periodo.`;
}

function buildLimitStatuses(limits: CategoryLimit[], transactions: Transaction[]): FinancialSummaryPayload["limits"] {
  const expenses = transactions.filter((item) => item.type === "saida");
  return limits.map((limit) => {
    const spent = expenses
      .filter((item) => item.category === limit.category)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const budget = Number(limit.amount || 0);
    const utilization = budget > 0 ? spent / budget : 0;
    return {
      category: limit.category,
      spent: Number(spent.toFixed(2)),
      limit: Number(budget.toFixed(2)),
      remaining: Number((budget - spent).toFixed(2)),
      utilization: Number(utilization.toFixed(4)),
      status: utilization >= 1 ? "exceeded" : utilization >= 0.8 ? "warning" : "ok",
    };
  });
}

export async function buildFinancialSummaryPayload(params: {
  storage: IStorage;
  userId: string;
  scope?: "PF" | "PJ" | "ALL";
  periodKey: SummaryPeriodKey;
  limits?: CategoryLimit[];
  referenceDate?: Date;
}) {
  const range = rangeForPeriod(params.periodKey, params.referenceDate);
  const transactions = await params.storage.getTransactionsByUserId(params.userId, params.scope || "ALL");
  const currentTransactions = filterTransactionsByRange(transactions, range.start, range.end);
  const comparisonTransactions = filterTransactionsByRange(transactions, range.comparisonStart, range.comparisonEnd);
  const totals = summarizeTotals(currentTransactions);
  const comparisonTotals = summarizeTotals(comparisonTransactions);
  const categories = buildCategoryBreakdown(currentTransactions);
  const previousCategories = buildCategoryBreakdown(comparisonTransactions);
  const largestExpense = [...currentTransactions]
    .filter((item) => item.type === "saida")
    .sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0))[0];

  return {
    period: {
      key: range.key,
      label: range.label,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    totals,
    comparison: {
      incomeDelta: Number((totals.income - comparisonTotals.income).toFixed(2)),
      expensesDelta: Number((totals.expenses - comparisonTotals.expenses).toFixed(2)),
      balanceDelta: Number((totals.balance - comparisonTotals.balance).toFixed(2)),
    },
    categories,
    topExpense: categories[0] ? { category: categories[0].category, amount: categories[0].amount } : null,
    largestExpense: largestExpense
      ? {
          description: largestExpense.description,
          category: largestExpense.category || "Outros",
          amount: Number(largestExpense.amount || 0),
          date: new Date(largestExpense.date).toISOString(),
        }
      : null,
    dailyExpenses: buildDailyExpenseSeries(currentTransactions, range.start, range.end),
    increaseExplanation: explainExpenseIncrease(categories, previousCategories),
    limits: buildLimitStatuses(params.limits || [], currentTransactions),
  } satisfies FinancialSummaryPayload;
}

export function formatFinancialSummaryText(
  payload: FinancialSummaryPayload,
  channel: "whatsapp" | "internal_chat",
) {
  const lines = [
    `Resumo de ${payload.period.label}`,
    `Neste periodo, entraram ${formatCurrency(payload.totals.income)} e sairam ${formatCurrency(payload.totals.expenses)}.`,
    `Entradas: ${formatCurrency(payload.totals.income)}`,
    `Saidas: ${formatCurrency(payload.totals.expenses)}`,
    `Saldo: ${formatCurrency(payload.totals.balance)}`,
  ];

  if (payload.topExpense) {
    lines.push(`Categoria com maior peso: ${payload.topExpense.category} (${formatCurrency(payload.topExpense.amount)})`);
  }

  if (payload.largestExpense) {
    lines.push(`Maior gasto: ${payload.largestExpense.description} (${formatCurrency(payload.largestExpense.amount)})`);
  }

  if (payload.comparison.expensesDelta !== 0) {
    const direction = payload.comparison.expensesDelta > 0 ? "subiram" : "cairam";
    lines.push(`Em relacao ao periodo anterior, suas despesas ${direction} ${formatCurrency(Math.abs(payload.comparison.expensesDelta))}.`);
  }

  if (payload.increaseExplanation) lines.push(payload.increaseExplanation);

  if (payload.limits.length) {
    const critical = payload.limits
      .filter((item) => item.status !== "ok")
      .sort((left, right) => right.utilization - left.utilization)[0];
    if (critical) {
      lines.push(`Limite em destaque: ${critical.category} em ${Math.round(critical.utilization * 100)}% (${formatCurrency(critical.spent)} de ${formatCurrency(critical.limit)}).`);
    }
  }

  if (channel === "internal_chat" && payload.categories.length) {
    lines.push("");
    lines.push("Categorias:");
    for (const category of payload.categories.slice(0, 5)) {
      lines.push(`- ${category.category}: ${formatCurrency(category.amount)} (${Math.round(category.share * 100)}%)`);
    }
  }

  return lines.join("\n");
}
