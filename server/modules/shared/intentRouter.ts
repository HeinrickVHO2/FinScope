import { parseMonetaryAmountFromNaturalLanguage } from "../whatsapp-agent/amountParser";
import type { SummaryPeriodKey } from "./financialSummaryService";

export type SummaryIntentFocus =
  | "general"
  | "top_category"
  | "category_breakdown"
  | "largest_expense"
  | "increase_reason";

export type AssistantRouteIntent =
  | { type: "summary"; periodKey: SummaryPeriodKey; focus: SummaryIntentFocus }
  | { type: "limits_status" }
  | { type: "upsert_limit"; category: string; amount: number; scope: "PF" | "PJ" | "ALL" }
  | { type: "investments_summary" }
  | { type: "switch_financial_view"; view: "goals" | "investments" }
  | { type: "create_goal"; title: string; targetValue: number; initialContribution?: number }
  | { type: "add_goal_contribution"; amount: number }
  | { type: "list_goals" }
  | { type: "goal_progress" }
  | { type: "create_reminder"; title: string; amount: number; dayOfMonth: number }
  | { type: "mark_reminder_paid" };

export function normalizeAssistantText(text: string) {
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
  if (/ultimos 7 dias|ultimos dias|nos ultimos dias/.test(normalized)) return "last_7_days";
  if (/semana passada|ultima semana/.test(normalized)) return "previous_week";
  if (/essa semana|esta semana/.test(normalized)) return "current_week";
  if (/mes passado/.test(normalized)) return "previous_month";
  return "current_month";
}

function stripLeadingArticle(value: string) {
  return value.replace(/^(um|uma|o|a|os|as)\s+/i, "").trim();
}

function parseGoalTitle(rawText: string) {
  const patterns = [
    /meta\s+para\s+(.+?)(?:,| no valor| valendo| preciso| quero| tenho| por\s+\d| de\s+\d|$)/i,
    /guardar\s+(?:dinheiro\s+)?para\s+(?:comprar\s+)?(.+?)(?:,| no valor| valendo| preciso| quero| tenho| por\s+\d| de\s+\d|$)/i,
    /juntar\s+(?:dinheiro\s+)?para\s+(?:comprar\s+)?(.+?)(?:,| no valor| valendo| preciso| quero| tenho| por\s+\d| de\s+\d|$)/i,
    /objetivo\s+para\s+(.+?)(?:,| no valor| valendo| preciso| quero| tenho| por\s+\d| de\s+\d|$)/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (match?.[1]) {
      const value = stripLeadingArticle(match[1].trim());
      if (value) return value;
    }
  }

  return "Meta financeira";
}

function parseFirstCurrencyLikeAmount(fragment: string) {
  const match = fragment.match(/(?:r\$\s*)?\d[\d.,]*(?:\s*(?:k|mil|milhao|milhoes))?/i);
  if (!match?.[0]) return null;

  const normalized = match[0]
    .replace(/r\$\s*/i, "")
    .trim()
    .toLowerCase();

  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(normalized)) {
    const value = Number(normalized.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(value) ? value : null;
  }

  return parseMonetaryAmountFromNaturalLanguage(match[0]);
}

function parseGoalTargetValue(rawText: string) {
  const patterns = [
    /no valor de\s+([^!?\n]+)/i,
    /valor de\s+([^!?\n]+)/i,
    /preciso de\s+([^!?\n]+)/i,
    /objetivo de\s+([^!?\n]+)/i,
    /meta de\s+([^!?\n]+)/i,
    /para comprar .*?\bde\s+([^!?\n]+)/i,
    /para .*?\bde\s+([^!?\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (!match?.[1]) continue;
    const amount = parseFirstCurrencyLikeAmount(match[1]);
    if (amount) return amount;
  }

  return parseMonetaryAmountFromNaturalLanguage(rawText);
}

function parseGoalInitialContribution(rawText: string) {
  const patterns = [
    /ja tenho\s+([^.!?\n]+?)\s+(?:guardado|guardada|guardados|guardadas|juntado|juntada|separado|separada)/i,
    /tenho\s+([^.!?\n]+?)\s+(?:guardado|guardada|guardados|guardadas|juntado|juntada|separado|separada)/i,
    /ja guardei\s+([^.!?\n]+)/i,
    /guardei\s+([^.!?\n]+)/i,
    /ja juntei\s+([^.!?\n]+)/i,
    /juntei\s+([^.!?\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (!match?.[1]) continue;
    const amount = parseMonetaryAmountFromNaturalLanguage(match[1]);
    if (amount) return amount;
  }

  return null;
}

function parseLimitCategory(rawText: string) {
  const match = rawText.match(/limite(?:\s+de\s+gastos?)?\s+(?:para\s+)?(.+?)(?:\s+de|\s+r\$|$)/i);
  return match?.[1]?.trim() || null;
}

function parseReminder(rawText: string, normalized: string) {
  if (!looksLikeReminderIntent(normalized)) return null;

  const amount = parseMonetaryAmountFromNaturalLanguage(rawText) ?? 0;
  const dayMatch = normalized.match(/dia\s+(\d{1,2})/);
  if (!dayMatch) return null;

  let title = rawText
    .replace(/todo dia \d{1,2}.*/i, "")
    .replace(/todo mes.*$/i, "")
    .replace(/mensal.*$/i, "")
    .replace(/me lembra (da|do|de)\s+/i, "")
    .replace(/me lembre (da|do|de)\s+/i, "")
    .replace(/r\$\s*[\d.,]+/i, "")
    .replace(/,\s*$/, "")
    .trim();

  if (!title) title = "Conta recorrente";
  return { title, amount, dayOfMonth: Number(dayMatch[1]) };
}

function isReminderPaidMessage(normalized: string) {
  return /^(paguei ja|ja paguei|marca como pago|marque como pago|pago ja)$/.test(normalized);
}

function detectSummaryFocus(normalized: string): SummaryIntentFocus {
  if (/divisao dos meus gastos|divisao por categoria|gastos por categoria|me mostra a divisao|pizza/.test(normalized)) {
    return "category_breakdown";
  }

  if (/qual foi meu maior gasto|maior gasto|gasto mais alto/.test(normalized)) {
    return "largest_expense";
  }

  if (/por que meus gastos aumentaram|o que subiu|o que mudou em relacao|o que mudou em relação|motivo do aumento/.test(normalized)) {
    return "increase_reason";
  }

  if (/onde eu gastei mais|categoria|mais gastei/.test(normalized)) {
    return "top_category";
  }

  return "general";
}

export function looksLikeGoalIntent(text: string) {
  const normalized = normalizeAssistantText(text);
  return /crie uma meta|criar meta|quero uma meta|meta para|guardar dinheiro para|juntar dinheiro para|guardar para|juntar para|objetivo para/.test(normalized);
}

export function looksLikeReminderIntent(text: string) {
  const normalized = normalizeAssistantText(text);
  return /todo dia|todo mes|mensal|me lembra|me lembre|lembrete/.test(normalized) && /dia\s+\d{1,2}/.test(normalized);
}

export function parseAssistantRouteIntent(text: string): AssistantRouteIntent | null {
  const normalized = normalizeAssistantText(text);
  if (!normalized) return null;

  if (/quanto eu gastei|resumo|ultimos 7 dias|ultimos dias|essa semana|este mes|mes passado|divisao dos meus gastos|gastos por categoria|maior gasto|o que subiu|o que mudou em relacao|por que meus gastos aumentaram|grafico/.test(normalized)) {
    return {
      type: "summary",
      periodKey: resolvePeriodKey(normalized),
      focus: detectSummaryFocus(normalized),
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

  if (looksLikeGoalIntent(normalized)) {
    const targetValue = parseGoalTargetValue(text);
    if (targetValue) {
      const initialContribution = parseGoalInitialContribution(text);
      return {
        type: "create_goal",
        title: parseGoalTitle(text),
        targetValue,
        ...(initialContribution ? { initialContribution } : {}),
      };
    }
  }

  if (/ja guardei|guardei|aportei|adicionei .* meta|separei .* meta/.test(normalized)) {
    const amount = parseMonetaryAmountFromNaturalLanguage(text);
    if (amount) return { type: "add_goal_contribution", amount };
  }

  if (/listar metas|minhas metas|quais metas|metas ativas|me mostra minhas metas/.test(normalized)) {
    return { type: "list_goals" };
  }

  if (/progresso da meta|minha meta|como esta minha meta|quanto falta para minha meta/.test(normalized)) {
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

  if (isReminderPaidMessage(normalized)) {
    return { type: "mark_reminder_paid" };
  }

  return null;
}

export function looksLikeAssistantOrchestratorMessage(text: string) {
  return Boolean(parseAssistantRouteIntent(text));
}
