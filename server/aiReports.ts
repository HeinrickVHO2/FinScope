import { storage } from "./storage";
import fetch from "node-fetch";

type ReportPeriod = {
  start: Date;
  end: Date;
  label?: string;
};

export type AiFinancialReport = {
  insights: string[];
  savingsTips: string[];
  alerts: string[];
  rawSummary: string;
};

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

type ReportPreferences = {
  focusEconomy?: boolean;
  focusDebt?: boolean;
  focusInvestments?: boolean;
};

export async function generateAiFinancialReport(
  userId: string,
  period: ReportPeriod,
  preferences?: ReportPreferences
): Promise<AiFinancialReport> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  const transactions = await storage.getTransactionsByUserId(userId, "ALL");
  const futureTransactions = await storage.getFutureTransactions(userId, "ALL", "pending");
  const recurringTransactions = await storage.getRecurringTransactions(userId, "ALL");
  const goals = await storage.getInvestmentsSummary(userId);

  const periodTransactions = transactions.filter((tx) => {
    const date = new Date(tx.date);
    return date >= period.start && date <= period.end;
  });

  const totalIncome = periodTransactions
    .filter((tx) => tx.type === "entrada")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const totalExpenses = periodTransactions
    .filter((tx) => tx.type === "saida")
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const payload = {
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      label: period.label ?? "Período selecionado",
    },
    totals: {
      income: Number(totalIncome.toFixed(2)),
      expenses: Number(totalExpenses.toFixed(2)),
      net: Number((totalIncome - totalExpenses).toFixed(2)),
    },
    transactions: periodTransactions.slice(-50), // últimos 50 para contexto
    upcoming: futureTransactions.slice(0, 20),
    recurring: recurringTransactions.slice(0, 20),
    goals,
  };

  const preferenceSummary = [
    preferences?.focusEconomy ? "Priorizar dicas de economia." : null,
    preferences?.focusDebt ? "Identificar dívidas e alertar sobre riscos." : null,
    preferences?.focusInvestments ? "Avaliar oportunidades de investimento." : null,
  ]
    .filter(Boolean)
    .join(" ");

  const messages = [
    {
      role: "system",
      content:
        "Você é um analista financeiro da FinScope. Analise os dados fornecidos e responda em JSON com chaves: insights (array de frases), savingsTips (array), alerts (array).",
    },
    {
      role: "user",
      content: `Gere um resumo financeiro amigável com base no seguinte JSON: ${JSON.stringify(
        payload
      )}. Preferências do usuário: ${preferenceSummary || "sem preferência especial."}`,
    },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao gerar relatório AI: ${errorText}`);
  }

  const completion = await response.json();
  const content = completion?.choices?.[0]?.message?.content || "";
  const sanitized = sanitizeJson(content);

  let parsed: any = {};
  try {
    parsed = JSON.parse(sanitized);
  } catch {
    parsed = { insights: [sanitized], savingsTips: [], alerts: [] };
  }

  return {
    insights: Array.isArray(parsed.insights) ? parsed.insights : [parsed.insights ?? ""].filter(Boolean),
    savingsTips: Array.isArray(parsed.savingsTips)
      ? parsed.savingsTips
      : [parsed.savingsTips ?? ""].filter(Boolean),
    alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [parsed.alerts ?? ""].filter(Boolean),
    rawSummary: sanitized,
  };
}
