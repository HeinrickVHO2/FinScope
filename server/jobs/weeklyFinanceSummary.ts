import { supabase } from "../supabase";
import { storage } from "../storage";
import { createTransporter } from "../emails/transporter";
import { generateAiInsights } from "../aiInsights";
import type { Transaction } from "@shared/schema";

const transporter = createTransporter();
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

type BasicUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  plan: string | null;
};

type WeeklyStats = {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  transactionsCount: number;
  topCategories: { category: string; amount: number }[];
  periodLabel: string;
};

const formatCurrency = (value: number) => currencyFormatter.format(value || 0);

const formatDate = (date: Date) =>
  date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

async function fetchActiveUsers(): Promise<BasicUserRow[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, plan, billing_status")
    .eq("billing_status", "active")
    .neq("email", null);

  if (error) {
    console.error("[WEEKLY JOB] Erro ao buscar usuários:", error);
    return [];
  }

  return (data || []).filter((row) => row.email);
}

async function buildWeeklyStats(userId: string): Promise<WeeklyStats> {
  const now = new Date();
  const startDate = new Date(now.getTime() - WEEK_IN_MS);
  const transactions = await storage.getTransactionsByUserId(userId, "ALL");
  const weeklyTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    if (Number.isNaN(txDate.getTime())) {
      return false;
    }
    return txDate >= startDate && txDate <= now;
  });

  const totalIncome = sumByType(weeklyTransactions, "entrada");
  const totalExpenses = sumByType(weeklyTransactions, "saida");
  const categoryMap = new Map<string, number>();

  weeklyTransactions
    .filter((tx) => tx.type === "saida")
    .forEach((tx) => {
      const amount = Number(tx.amount || 0);
      const key = tx.category || "Outros";
      categoryMap.set(key, (categoryMap.get(key) || 0) + amount);
    });

  const topCategories = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return {
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    net: Number((totalIncome - totalExpenses).toFixed(2)),
    transactionsCount: weeklyTransactions.length,
    topCategories,
    periodLabel: `${formatDate(startDate)} — ${formatDate(now)}`,
  };
}

function sumByType(transactions: Transaction[], type: "entrada" | "saida") {
  return transactions
    .filter((tx) => tx.type === type)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

type EmailContentParams = {
  userName: string;
  stats: WeeklyStats;
  summary: string;
  alerts: string[];
  tips: string[];
  predictions: { nextMonthExpenses?: number; nextMonthSavings?: number };
};

function buildEmailTemplate({
  userName,
  stats,
  summary,
  alerts,
  tips,
  predictions,
}: EmailContentParams) {
  const predictionHtml = `
    <div>
      <p style="margin:4px 0 2px;font-weight:600;color:#0f172a;">Previsões do mês</p>
      <ul style="margin:0;padding-left:18px;color:#475569;font-size:14px;">
        <li>Gastos previstos: ${formatCurrency(predictions.nextMonthExpenses || 0)}</li>
        <li>Economia estimada: ${formatCurrency(predictions.nextMonthSavings || 0)}</li>
      </ul>
    </div>
  `;

  const alertsHtml =
    alerts.length > 0
      ? `<ul style="margin:6px 0 0;padding-left:18px;color:#b91c1c;font-size:14px;">${alerts
          .map((item) => `<li>${item}</li>`)
          .join("")}</ul>`
      : `<p style="color:#16a34a;font-size:14px;margin:6px 0 0;">Nenhum alerta crítico nesta semana.</p>`;

  const tipsHtml =
    tips.length > 0
      ? `<ul style="margin:6px 0 0;padding-left:18px;color:#0f172a;font-size:14px;">${tips
          .map((tip) => `<li>${tip}</li>`)
          .join("")}</ul>`
      : `<p style="color:#475569;font-size:14px;margin:6px 0 0;">Continue acompanhando para receber recomendações.</p>`;

  const categoriesHtml =
    stats.topCategories.length > 0
      ? `<ul style="margin:6px 0 0;padding-left:18px;color:#0f172a;font-size:14px;">${stats.topCategories
          .map((cat) => `<li>${cat.category}: ${formatCurrency(cat.amount)}</li>`)
          .join("")}</ul>`
      : `<p style="color:#475569;font-size:14px;margin:6px 0 0;">Sem gastos relevantes por categoria.</p>`;

  return `
    <div style="font-family:'Inter',Arial,sans-serif;background:#f8fafc;padding:24px;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:20px;box-shadow:0 10px 40px rgba(15,23,42,0.08);overflow:hidden;">
        <div style="background:linear-gradient(135deg,#312e81,#4f46e5);color:#fff;padding:24px;">
          <p style="margin:0;font-size:14px;opacity:0.8;">Resumo semanal — ${stats.periodLabel}</p>
          <h1 style="margin:6px 0 0;font-size:24px;">Olá, ${userName} 👋</h1>
          <p style="margin:12px 0 0;font-size:16px;line-height:1.5;">${summary}</p>
        </div>
        <div style="padding:24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;background:#fff;">
          <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px;">
            <p style="margin:0 0 4px;font-size:13px;color:#475569;">Receitas (7 dias)</p>
            <p style="margin:0;font-size:22px;font-weight:600;color:#0f172a;">${formatCurrency(stats.totalIncome)}</p>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px;">
            <p style="margin:0 0 4px;font-size:13px;color:#475569;">Despesas (7 dias)</p>
            <p style="margin:0;font-size:22px;font-weight:600;color:#b91c1c;">${formatCurrency(stats.totalExpenses)}</p>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px;">
            <p style="margin:0 0 4px;font-size:13px;color:#475569;">Saldo semanal</p>
            <p style="margin:0;font-size:22px;font-weight:600;color:${stats.net >= 0 ? "#16a34a" : "#b91c1c"};">
              ${formatCurrency(stats.net)}
            </p>
          </div>
        </div>
        <div style="padding:24px;background:#fff;">
          <p style="margin:0 0 4px;font-size:13px;color:#475569;">Gastos por categoria</p>
          ${categoriesHtml}
        </div>
        <div style="padding:0 24px 24px;background:#fff;display:grid;gap:16px;">
          <div style="border:1px solid #fee2e2;border-radius:16px;padding:16px;background:#fef2f2;">
            <p style="margin:0;font-size:14px;font-weight:600;color:#b91c1c;">Alertas de risco</p>
            ${alertsHtml}
          </div>
          <div style="border:1px solid #e0f2fe;border-radius:16px;padding:16px;background:#f0f9ff;">
            ${predictionHtml}
          </div>
          <div style="border:1px solid #dcfce7;border-radius:16px;padding:16px;background:#f0fdf4;">
            <p style="margin:0;font-size:14px;font-weight:600;color:#166534;">Dicas de economia</p>
            ${tipsHtml}
          </div>
        </div>
        <div style="padding:20px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:12px;">
          Relatório enviado automaticamente pelo FinScope AI. Ajuste suas notificações no app se desejar.
        </div>
      </div>
    </div>
  `;
}

export async function runWeeklyFinanceSummaryJob() {
  try {
    const sender =
      process.env.WEEKLY_FINANCE_EMAIL_FROM ||
      process.env.MAIL_FROM ||
      process.env.MAIL_USER;
    if (!sender) {
      console.warn("[WEEKLY JOB] Remetente não configurado. Configure WEEKLY_FINANCE_EMAIL_FROM ou MAIL_USER.");
      return;
    }

    const users = await fetchActiveUsers();
    if (!users.length) {
      console.log("[WEEKLY JOB] Nenhum usuário ativo para notificar.");
      return;
    }

    console.log(`[WEEKLY JOB] Enviando resumo para ${users.length} usuários.`);
    for (const user of users) {
      try {
        const stats = await buildWeeklyStats(user.id);
        const aiInsights = await generateAiInsights(user.id, "ALL");
        const summary =
          aiInsights.summaryText ||
          `Você recebeu ${formatCurrency(stats.totalIncome)} e gastou ${formatCurrency(
            stats.totalExpenses
          )} nos últimos 7 dias.`;

        const html = buildEmailTemplate({
          userName: user.full_name || user.email,
          stats,
          summary,
          alerts: aiInsights.alerts || [],
          tips: aiInsights.tips || [],
          predictions: aiInsights.predictions || {},
        });

        await transporter.sendMail({
          from: sender,
          to: user.email,
          subject: `Seu resumo financeiro semanal (${stats.periodLabel})`,
          html,
        });
        console.log("[WEEKLY JOB] Email enviado para", user.email);
      } catch (error) {
        console.error(`[WEEKLY JOB] Falha ao enviar email para ${user.email}:`, error);
      }
    }
  } catch (error) {
    console.error("[WEEKLY JOB] Erro inesperado:", error);
  }
}

export function scheduleWeeklyFinanceSummaryJob() {
  if (process.env.ENABLE_WEEKLY_FINANCE_JOB !== "true") {
    console.log("[WEEKLY JOB] Desativado (DEFINE ENABLE_WEEKLY_FINANCE_JOB=true para habilitar).");
    return;
  }

  const intervalMs =
    Number(process.env.WEEKLY_FINANCE_JOB_INTERVAL_MS) || WEEK_IN_MS;
  const initialDelay =
    Number(process.env.WEEKLY_FINANCE_JOB_DELAY_MS) || 10_000;

  setTimeout(() => {
    runWeeklyFinanceSummaryJob().catch((error) =>
      console.error("[WEEKLY JOB] Erro na primeira execução:", error)
    );
  }, initialDelay);

  setInterval(() => {
    runWeeklyFinanceSummaryJob().catch((error) =>
      console.error("[WEEKLY JOB] Erro ao executar job semanal:", error)
    );
  }, intervalMs);

  console.log(
    `[WEEKLY JOB] Agendado a cada ${Math.round(intervalMs / (1000 * 60 * 60))}h (delay inicial ${initialDelay}ms).`
  );
}
