import { parseMonetaryAmountFromNaturalLanguage } from "../whatsapp-agent/amountParser";
import type { SummaryPeriodKey } from "./financialSummaryService";

export type AssistantRouteIntent =
  | { type: "summary"; periodKey: SummaryPeriodKey; focus: "general" | "top_category" }
  | { type: "limits_status" }
  | { type: "upsert_limit"; category: string; amount: number; scope: "PF" | "PJ" | "ALL" }
  | { type: "investments_summary" }
  | { type: "switch_financial_view"; view: "goals" | "investments" }
  | { type: "create_goal"; title: string; targetValue: number }
  | { type: "add_goal_contribution"; amount: number }
  | { type: "list_goals" }
  | { type: "goal_progress" }
  | { type: "create_reminder"; title: string; amount: number; dayOfMonth: number }
  | { type: "mark_reminder_paid" };

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function detectScope(normalized: string): "PF" | "PJ" | "ALL" {
  if (/\bpj\b|empresa|empresarial|cnpj/.test(normalized)) return "PJ";
  if (/\bpf\b|pessoal|particular/.test(normalized)) return "PF";
  return "ALL";
}

function resolvePeriodKey(normalized: string): SummaryPeriodKey {
  if (/ultimos 7 dias|ultimos dias|nos ultimos dias|ultima semana/.test(normalized)) return "last_7_days";
  if (/semana passada|ultima semana/.test(normalized)) return "previous_week";
  if (/essa semana|esta semana/.test(normalized)) return "current_week";
  if (/mes passado/.test(normalized)) return "previous_month";
  return "current_month";
}

function parseGoalTitle(rawText: string) {
  const match = rawText.match(/meta\s+para\s+(.+?)(?:,| preciso| quero| tenho|$)/i);
  if (match?.[1]) return match[1].trim();
  const fallback = rawText.match(/juntar\s+.+?\s+para\s+(.+)$/i);
  if (fallback?.[1]) return fallback[1].trim();
  return "Meta financeira";
}

function parseLimitCategory(rawText: string) {
  const match = rawText.match(/limite(?:\s+de\s+gastos?)?\s+(?:para\s+)?(.+?)(?:\s+de|\s+r\$|$)/i);
  return match?.[1]?.trim() || null;
}

function parseReminder(rawText: string, normalized: string) {
  if (!/todo dia|todo mes|mensal/.test(normalized)) return null;
  const amount = parseMonetaryAmountFromNaturalLanguage(rawText);
  const dayMatch = normalized.match(/dia\s+(\d{1,2})/);
  if (!amount || !dayMatch) return null;

  let title = rawText
    .replace(/todo dia \d{1,2}.*/i, "")
    .replace(/todo mes.*$/i, "")
    .replace(/mensal.*$/i, "")
    .replace(/r\$\s*[\d.,]+/i, "")
    .replace(/,\s*$/, "")
    .trim();

  if (!title) title = "Conta recorrente";
  return { title, amount, dayOfMonth: Number(dayMatch[1]) };
}

export function parseAssistantRouteIntent(text: string): AssistantRouteIntent | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  if (/quanto eu gastei|resumo|ultimos dias|essa semana|este mes|mes passado/.test(normalized)) {
    return {
      type: "summary",
      periodKey: resolvePeriodKey(normalized),
      focus: /onde eu gastei mais|categoria|mais gastei/.test(normalized) ? "top_category" : "general",
    };
  }

  if (/como estao meus limites|meus limites|mostrar limites|consultar limites/.test(normalized)) {
    return { type: "limits_status" };
  }

  if (/meus investimentos|meus aportes|como estao meus investimentos|resumo dos investimentos|quanto tenho investido|quanto tenho aplicado/.test(normalized)) {
    return { type: "investments_summary" };
  }

  if (/crie? (um )?limite|defina? (um )?limite/.test(normalized)) {
    const amount = parseMonetaryAmountFromNaturalLanguage(text);
    const category = parseLimitCategory(text);
    if (amount && category) {
      return { type: "upsert_limit", category, amount, scope: detectScope(normalized) };
    }
  }

  if (/crie uma meta|criar meta|quero uma meta|meta para/.test(normalized)) {
    const targetValue = parseMonetaryAmountFromNaturalLanguage(text);
    if (targetValue) {
      return { type: "create_goal", title: parseGoalTitle(text), targetValue };
    }
  }

  if (/ja guardei|guardei|aportei|adicionei .* meta|separei .* meta/.test(normalized)) {
    const amount = parseMonetaryAmountFromNaturalLanguage(text);
    if (amount) return { type: "add_goal_contribution", amount };
  }

  if (/listar metas|minhas metas|quais metas|metas ativas/.test(normalized)) {
    return { type: "list_goals" };
  }

  if (/progresso da meta|minha meta|como esta minha meta/.test(normalized)) {
    return { type: "goal_progress" };
  }

  if (/abrir metas|ir para metas|trocar para metas|alternar para metas|mostrar metas/.test(normalized)) {
    return { type: "switch_financial_view", view: "goals" };
  }

  if (/abrir investimentos|ir para investimentos|trocar para investimentos|alternar para investimentos|mostrar investimentos/.test(normalized)) {
    return { type: "switch_financial_view", view: "investments" };
  }

  const reminder = parseReminder(text, normalized);
  if (reminder) {
    return {
      type: "create_reminder",
      title: reminder.title,
      amount: reminder.amount,
      dayOfMonth: reminder.dayOfMonth,
    };
  }

  if (/paguei ja|ja paguei|pago|marca como pago/.test(normalized)) {
    return { type: "mark_reminder_paid" };
  }

  return null;
}

export function looksLikeAssistantOrchestratorMessage(text: string) {
  return Boolean(parseAssistantRouteIntent(text));
}
