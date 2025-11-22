import fetch from "node-fetch";
import { storage } from "./storage";

type AccountScope = "PF" | "PJ" | "ALL";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export interface AiInsightResult {
  summaryText: string;
  tips: string[];
  alerts: string[];
  predictions: {
    nextMonthExpenses: number;
    nextMonthSavings: number;
  };
}

type PreparedContext = {
  scope: AccountScope;
  metrics: Awaited<ReturnType<typeof storage.getDashboardMetrics>>;
  recentTransactions: {
    description: string;
    amount: number;
    category: string;
    type: string;
    date: string;
  }[];
  monthlyAverages: {
    income: number;
    expenses: number;
  };
  futureSummary: {
    pendingIncome: number;
    pendingExpenses: number;
    overdueExpenses: number;
  };
  recurringSummary: {
    income: number;
    expenses: number;
  };
  predictions: {
    nextMonthExpenses: number;
    nextMonthSavings: number;
  };
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const sanitizeJson = (payload: string) => {
  if (!payload) return "";
  const trimmed = payload.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return trimmed;
  }
  return trimmed.slice(start, end + 1);
};

const sumByType = (items: { type?: string; amount?: string | number }[], type: string) =>
  items
    .filter((item) => (item.type || "").toLowerCase() === type.toLowerCase())
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

const buildHeuristicInsights = (context: PreparedContext): AiInsightResult => {
  const { metrics, futureSummary, predictions } = context;
  const summary = [
    `Saldo atual de ${currency.format(metrics.totalBalance)} com receitas no mês de ${currency.format(
      metrics.monthlyIncome
    )} e despesas de ${currency.format(metrics.monthlyExpenses)}.`,
    `Considerando compromissos futuros, estimamos gastos de ${currency.format(
      predictions.nextMonthExpenses
    )} e potencial de economia de ${currency.format(predictions.nextMonthSavings)}.`,
  ].join(" ");

  const alerts: string[] = [];
  if (metrics.netCashFlow < 0) {
    alerts.push(
      "Fluxo de caixa negativo no mês atual. Ajuste despesas ou antecipe receitas para equilibrar."
    );
  }
  if (futureSummary.overdueExpenses > 0) {
    alerts.push(
      `Existem ${futureSummary.overdueExpenses} compromissos atrasados que podem gerar juros. Regularize o quanto antes.`
    );
  }
  if (predictions.nextMonthSavings <= 0) {
    alerts.push("Sem margem de economia prevista para o próximo mês. Reavalie gastos essenciais.");
  }

  const tips: string[] = [];
  if (futureSummary.pendingExpenses > futureSummary.pendingIncome) {
    tips.push("Renegocie ou escalone pagamentos futuros para que não excedam suas entradas previstas.");
  }
  if (metrics.monthlyExpenses > metrics.monthlyIncome * 0.8) {
    tips.push(
      "Considere definir tetos por categoria para impedir que as despesas consumam mais de 80% das receitas."
    );
  }
  if (!tips.length) {
    tips.push("Continue monitorando os valores previstos para garantir folga no caixa.");
  }

  return {
    summaryText: summary,
    alerts,
    tips,
    predictions,
  };
};

const buildContext = async (userId: string, scope: AccountScope): Promise<PreparedContext> => {
  const [metrics, transactions, futureTransactions, futureExpenses, recurring] = await Promise.all([
    storage.getDashboardMetrics(userId, scope),
    storage.getTransactionsByUserId(userId, scope),
    storage.getFutureTransactions(userId, scope),
    storage.getFutureExpenses(userId, scope),
    storage.getRecurringTransactions(userId, scope),
  ]);

  const orderedTransactions = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const recentTransactions = orderedTransactions.slice(0, 40).map((tx) => ({
    description: tx.description,
    amount: Number(tx.amount || 0),
    category: tx.category,
    type: tx.type,
    date: tx.date,
  }));

  const monthlyMap = new Map<string, { income: number; expenses: number }>();
  transactions.forEach((tx) => {
    const date = new Date(tx.date);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { income: 0, expenses: 0 });
    }
    const bucket = monthlyMap.get(key)!;
    const amount = Number(tx.amount || 0);
    if (tx.type === "entrada") bucket.income += amount;
    if (tx.type === "saida") bucket.expenses += amount;
  });

  const monthlyEntries = Array.from(monthlyMap.values());
  const avgIncome =
    monthlyEntries.length > 0
      ? monthlyEntries.reduce((sum, current) => sum + current.income, 0) / monthlyEntries.length
      : metrics.monthlyIncome;
  const avgExpenses =
    monthlyEntries.length > 0
      ? monthlyEntries.reduce((sum, current) => sum + current.expenses, 0) / monthlyEntries.length
      : metrics.monthlyExpenses;

  const futureSummary = {
    pendingIncome: sumByType(futureTransactions, "income"),
    pendingExpenses:
      sumByType(futureTransactions, "expense") +
      futureExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    overdueExpenses: futureExpenses.filter((expense) => expense.status === "overdue").length,
  };

  const recurringSummary = {
    income: sumByType(recurring, "income"),
    expenses: sumByType(recurring, "expense"),
  };

  const projectedIncome = metrics.monthlyIncome + futureSummary.pendingIncome + recurringSummary.income;
  const projectedExpenses =
    metrics.monthlyExpenses + futureSummary.pendingExpenses + recurringSummary.expenses;

  const predictions = {
    nextMonthExpenses: Number(projectedExpenses.toFixed(2)),
    nextMonthSavings: Number(Math.max(0, projectedIncome - projectedExpenses).toFixed(2)),
  };

  return {
    scope,
    metrics,
    recentTransactions,
    monthlyAverages: {
      income: Number(avgIncome.toFixed(2)),
      expenses: Number(avgExpenses.toFixed(2)),
    },
    futureSummary,
    recurringSummary,
    predictions,
  };
};

export async function generateAiInsights(
  userId: string,
  scope: AccountScope = "ALL"
): Promise<AiInsightResult> {
  const context = await buildContext(userId, scope);
  const fallback = buildHeuristicInsights(context);

  if (!OPENAI_API_KEY) {
    console.warn("[AI INSIGHTS] OPENAI_API_KEY ausente. Retornando heurísticas.");
    return fallback;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Você é um consultor financeiro da FinScope. Analise os dados enviados e responda em JSON com 'summaryText' (string), 'tips' (array de strings), 'alerts' (array de strings) e 'predictions' com 'nextMonthExpenses' e 'nextMonthSavings'. Seja direto e contextualizado para finanças pessoais/empresariais.",
          },
          {
            role: "user",
            content: `Dados atuais do usuário: ${JSON.stringify(context)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text);
    }

    const completion = await response.json();
    const rawContent = completion?.choices?.[0]?.message?.content || "";
    const sanitized = sanitizeJson(rawContent);
    const parsed = JSON.parse(sanitized);

    const predictions = parsed?.predictions || {};

    return {
      summaryText:
        typeof parsed.summaryText === "string" && parsed.summaryText.trim().length
          ? parsed.summaryText.trim()
          : fallback.summaryText,
      tips:
        Array.isArray(parsed.tips) && parsed.tips.length
          ? parsed.tips.map((tip: string) => String(tip))
          : fallback.tips,
      alerts:
        Array.isArray(parsed.alerts) && parsed.alerts.length
          ? parsed.alerts.map((alert: string) => String(alert))
          : fallback.alerts,
      predictions: {
        nextMonthExpenses: Number(predictions.nextMonthExpenses ?? fallback.predictions.nextMonthExpenses) || fallback.predictions.nextMonthExpenses,
        nextMonthSavings: Number(predictions.nextMonthSavings ?? fallback.predictions.nextMonthSavings) || fallback.predictions.nextMonthSavings,
      },
    };
  } catch (error) {
    console.error("[AI INSIGHTS] Falha ao gerar insights com OpenAI:", error);
    return fallback;
  }
}
