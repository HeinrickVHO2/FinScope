import { parseMonetaryAmountFromNaturalLanguage } from "../whatsapp-agent/amountParser";
import type { SummaryPeriodKey } from "./financialSummaryService";

export type SummaryIntentFocus =
  | "general"
  | "top_category"
  | "category_breakdown"
  | "largest_expense"
  | "increase_reason";

export type AssistantInvestmentType =
  | "reserva_emergencia"
  | "cdb"
  | "renda_fixa"
  | "renda_variavel";

export type AssistantRouteIntent =
  | { type: "summary"; periodKey: SummaryPeriodKey; focus: SummaryIntentFocus }
  | { type: "financial_guidance" }
  | { type: "limits_status" }
  | { type: "upsert_limit"; category: string; amount: number; scope: "PF" | "PJ" | "ALL" }
  | { type: "investments_summary" }
  | {
      type: "upsert_investment";
      title: string;
      investmentType: AssistantInvestmentType;
      depositAmount?: number;
      targetValue?: number;
      explicitNew?: boolean;
    }
  | { type: "switch_financial_view"; view: "goals" | "investments" }
  | { type: "create_goal"; title: string; targetValue: number; initialContribution?: number }
  | { type: "add_goal_contribution"; amount: number }
  | { type: "list_goals" }
  | { type: "goal_progress" }
  | { type: "create_payable"; title: string; amount: number; dueDate: Date; accountType: "PF" | "PJ" }
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

function cleanExtractedTitle(value: string) {
  return stripLeadingArticle(
    value
      .replace(/\b(?:no valor|valor|preciso|quero|tenho|ja tenho|j[aá] tenho|ja juntei|j[aá] juntei|ja guardei|j[aá] guardei)\b.*$/i, "")
      .replace(/\bde\s+(?:r\$\s*)?\d[\d.,]*(?:\s*(?:reais?|rs|k|mil|milhao|milhoes))?/i, "")
      .replace(/[,.!?;:]+$/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function parseGoalTitle(rawText: string) {
  const patterns = [
    /meta\s+para\s+(.+?)(?:,| no valor| valendo| preciso| quero| tenho| por\s+\d| de\s+\d|$)/i,
    /guardar\s+(?:dinheiro\s+)?para\s+(?:comprar\s+)?(.+?)(?:,| no valor| valendo| preciso| quero| tenho| por\s+\d| de\s+\d|$)/i,
    /juntar\s+(?:dinheiro\s+)?para\s+(?:comprar\s+)?(.+?)(?:,| no valor| valendo| preciso| quero| tenho| por\s+\d| de\s+\d|$)/i,
    /quero\s+comprar\s+(.+?)(?:,| no valor| valendo| preciso| quero| tenho| ja tenho| já tenho| por\s+\d| de\s+\d|$)/i,
    /objetivo\s+para\s+(.+?)(?:,| no valor| valendo| preciso| quero| tenho| por\s+\d| de\s+\d|$)/i,
    /(?:pagar|quitar)\s+(?:uma\s+|a\s+)?(.+?)(?:,| no valor| valendo| preciso| quero| tenho| por\s+\d| de\s+\d|$)/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (match?.[1]) {
      const value = stripLeadingArticle(match[1].trim());
      const cleaned = cleanExtractedTitle(value);
      if (cleaned) return cleaned;
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
    /(?:pagar|quitar)\s+(?:uma\s+|a\s+)?[^!?\n,]*?\bde\s+([^!?\n]+)/i,
    /quero comprar .*?\bde\s+([^!?\n]+)/i,
    /para comprar .*?\bde\s+([^!?\n]+)/i,
    /para .*?\bde\s+([^!?\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (!match?.[1]) continue;
    const amount = parseFirstCurrencyLikeAmount(match[1]);
    if (amount) return amount;
  }

  return parseFirstCurrencyLikeAmount(rawText) ?? parseMonetaryAmountFromNaturalLanguage(rawText);
}

function parseGoalInitialContribution(rawText: string) {
  const patterns = [
    /ja tenho\s+(.+?)\s+(?:guardado|guardada|guardados|guardadas|juntado|juntada|separado|separada)\b/i,
    /tenho\s+(.+?)\s+(?:guardado|guardada|guardados|guardadas|juntado|juntada|separado|separada)\b/i,
    /ja guardei\s+(.+)/i,
    /guardei\s+(.+)/i,
    /ja juntei\s+(.+)/i,
    /juntei\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (!match?.[1]) continue;
    const amount = parseFirstCurrencyLikeAmount(match[1]) ?? parseMonetaryAmountFromNaturalLanguage(match[1]);
    if (amount) return amount;
  }

  return null;
}

function detectInvestmentType(normalized: string): AssistantInvestmentType | null {
  if (/\b(cdb|certificado de deposito bancario)\b/.test(normalized)) return "cdb";
  if (/\b(renda fixa|lci|lca|tesouro direto|tesouro selic)\b/.test(normalized)) return "renda_fixa";
  if (/\b(renda variavel|acoes|acao|etf|fii|fundo imobiliario|bolsa)\b/.test(normalized)) return "renda_variavel";
  if (/\b(reserva de emergencia|fundo de emergencia|emergencia)\b/.test(normalized)) return "reserva_emergencia";
  return null;
}

function defaultInvestmentTitle(type: AssistantInvestmentType) {
  if (type === "cdb") return "CDB";
  if (type === "renda_fixa") return "Renda fixa";
  if (type === "renda_variavel") return "Renda variavel";
  return "Reserva de emergencia";
}

function looksLikeInvestmentIntent(normalized: string) {
  const investmentType = detectInvestmentType(normalized);
  if (!investmentType) return false;

  return /\b(guardei|guardar|investi|investir|aportei|aporte|apliquei|aplicar|depositei|depositar|coloquei|colocar|pus|separei|meta|objetivo|pretendo|quero ter|quero chegar|tenho investido|tenho aplicado)\b/.test(normalized);
}

function parseInvestmentTargetValue(rawText: string) {
  const patterns = [
    /minha meta\s+(?:e|é)\s+ter\s+([^!?\n]+)/i,
    /meta\s+(?:e|é)\s+ter\s+([^!?\n]+)/i,
    /objetivo\s+(?:e|é)\s+ter\s+([^!?\n]+)/i,
    /pretendo\s+(?:juntar|ter|chegar(?:\s+em)?)\s+([^!?\n]+)/i,
    /quero\s+ter\s+([^!?\n]+)/i,
    /quero\s+chegar(?:\s+em)?\s+([^!?\n]+)/i,
    /meta\s+de\s+([^!?\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (!match?.[1]) continue;
    const amount = parseFirstCurrencyLikeAmount(match[1]) ?? parseMonetaryAmountFromNaturalLanguage(match[1]);
    if (amount) return amount;
  }

  return null;
}

function parseInvestmentDepositAmount(rawText: string, normalized: string) {
  const depositPatterns = [
    /(?:ja tenho|j[aá] tenho)\s+(.+?)(?:\s+(?:em|no|na|num|numa)\s+[^!?\n]+)?$/i,
    /(?:guardei|investi|aportei|apliquei|depositei|coloquei|pus|separei)\s+(.+?)(?:\s+(?:em|no|na|num|numa)\s+[^!?\n]+)?$/i,
  ];

  const targetCue = rawText.search(/(?:minha meta\s+(?:e|é)|meta\s+(?:e|é)|objetivo\s+(?:e|é)|pretendo|quero\s+ter|quero\s+chegar)/i);
  const leadingText = targetCue > 0 ? rawText.slice(0, targetCue) : rawText;

  for (const pattern of depositPatterns) {
    const match = leadingText.match(pattern);
    if (!match?.[1]) continue;
    const amount = parseFirstCurrencyLikeAmount(match[1]) ?? parseMonetaryAmountFromNaturalLanguage(match[1]);
    if (amount) return amount;
  }

  if (/\b(guardei|investi|aportei|apliquei|depositei|coloquei|pus|separei)\b/.test(normalized)) {
    return parseFirstCurrencyLikeAmount(leadingText) ?? parseMonetaryAmountFromNaturalLanguage(leadingText);
  }

  return null;
}

function parseInvestmentTitle(rawText: string, type: AssistantInvestmentType) {
  const patterns = [
    /\b(cdb(?:\s+(?:do|da|de)\s+[^,.;!\n]+)?)/i,
    /\b(renda fixa(?:\s+(?:do|da|de)\s+[^,.;!\n]+)?)/i,
    /\b(renda variavel(?:\s+(?:do|da|de)\s+[^,.;!\n]+)?)/i,
    /\b(reserva de emergencia(?:\s+(?:do|da|de)\s+[^,.;!\n]+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (!match?.[1]) continue;
    const cleaned = cleanExtractedTitle(match[1]);
    if (cleaned) return cleaned;
  }

  return defaultInvestmentTitle(type);
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

function resolveFutureDateByDay(dayOfMonth: number, reference = new Date()) {
  const candidate = new Date(reference.getFullYear(), reference.getMonth(), dayOfMonth);
  candidate.setHours(12, 0, 0, 0);
  if (candidate.getTime() < reference.getTime()) {
    return new Date(reference.getFullYear(), reference.getMonth() + 1, dayOfMonth, 12, 0, 0, 0);
  }
  return candidate;
}

function parseDueDate(rawText: string, normalized: string) {
  const now = new Date();
  now.setHours(12, 0, 0, 0);

  const explicitDate = rawText.match(/(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/);
  if (explicitDate) {
    const day = Number(explicitDate[1]);
    const month = Number(explicitDate[2]) - 1;
    const yearRaw = explicitDate[3] ? Number(explicitDate[3]) : now.getFullYear();
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const candidate = new Date(year, month, day, 12, 0, 0, 0);
    if (!Number.isNaN(candidate.getTime())) return candidate;
  }

  const dayMatch = normalized.match(/(?:dia|vence(?:\s+em)?|vencimento(?:\s+em)?|para)\s+(\d{1,2})(?!\d)/);
  if (dayMatch) {
    const day = Number(dayMatch[1]);
    if (Number.isFinite(day) && day >= 1 && day <= 31) {
      return resolveFutureDateByDay(day, now);
    }
  }

  if (/\bamanha\b/.test(normalized)) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0, 0);
  }

  return null;
}

function cleanPayableTitle(value: string) {
  return value
    .replace(/^(tenho que|tenho de|preciso|vou)\s+pagar\s+/i, "")
    .replace(/^pagar\s+/i, "")
    .replace(/^(minha|minhas|meu|meus|uma|um|a|o)\s+/i, "")
    .replace(/\s+no valor.*$/i, "")
    .replace(/\s+r\$\s*[\d.,]+.*$/i, "")
    .replace(/\s+de\s+[\d.,]+\s*(?:reais?|k|mil|milhao|milhoes)?.*$/i, "")
    .replace(/\s+(?:no|na|para|ate|até)\s+dia\s+\d{1,2}.*$/i, "")
    .replace(/\s+(?:em|no dia)\s+\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?.*$/i, "")
    .replace(/\s+vence.*$/i, "")
    .replace(/[,.!?;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePayableTitle(rawText: string, normalized: string) {
  const patterns = [
    /(?:tenho que|tenho de|preciso|vou)\s+pagar\s+(.+?)(?:\s+no valor|\s+r\$|\s+de\s+\d|\s+(?:no|na|para|ate|até)\s+dia\s+\d|\s+(?:em|no dia)\s+\d{1,2}[\/.-]\d{1,2}|$)/i,
    /pagar\s+(.+?)(?:\s+no valor|\s+r\$|\s+de\s+\d|\s+(?:no|na|para|ate|até)\s+dia\s+\d|\s+(?:em|no dia)\s+\d{1,2}[\/.-]\d{1,2}|$)/i,
    /((?:fatura|boleto|conta|parcela|iptu|ipva|aluguel)[^,.]*?)(?:\s+no valor|\s+r\$|\s+de\s+\d|\s+(?:no|na|para|ate|até)\s+dia\s+\d|\s+(?:em|no dia)\s+\d{1,2}[\/.-]\d{1,2}|$)/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (match?.[1]) {
      const title = cleanPayableTitle(match[1]);
      if (title) return title;
    }
  }

  if (/conta de luz/.test(normalized)) return "Conta de luz";
  if (/conta de agua|conta d'agua/.test(normalized)) return "Conta de agua";
  if (/fatura.*cartao/.test(normalized)) return "Fatura do cartao";
  if (/boleto/.test(normalized)) return "Boleto";
  return "Conta a pagar";
}

function looksLikePayableIntent(text: string) {
  const normalized = normalizeAssistantText(text);
  const hasFutureBillVerb = /\b(tenho que pagar|tenho de pagar|preciso pagar|vou pagar|venc(e|imento)|fatura|boleto|conta de|aluguel|iptu|ipva)\b/.test(normalized);
  const hasDateCue = /\b(todo dia|todo mes|mensal|dia\s+\d{1,2}|\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|amanha)\b/.test(normalized);
  return hasFutureBillVerb && hasDateCue;
}

function parsePayable(rawText: string, normalized: string) {
  if (looksLikeReminderIntent(normalized) || !looksLikePayableIntent(normalized)) return null;

  const amount = parseMonetaryAmountFromNaturalLanguage(rawText);
  const dueDate = parseDueDate(rawText, normalized);
  if (!amount || !dueDate) return null;

  return {
    title: parsePayableTitle(rawText, normalized),
    amount,
    dueDate,
    accountType: (detectScope(normalized) === "PJ" ? "PJ" : "PF") as "PF" | "PJ",
  };
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
  const explicitGoalIntent = /crie uma meta|criar meta|quero uma meta|meta para|guardar dinheiro para|juntar dinheiro para|guardar para|juntar para|objetivo para|quero pagar uma divida|quero quitar uma divida|pagar uma divida|quitar uma divida|pagar a divida|quitar a divida/.test(normalized);
  const purchaseWithSavedAmountIntent =
    /quero comprar/.test(normalized)
    && /(?:no valor de|de)\s+\d/.test(normalized)
    && /ja tenho|guardado|guardada|ja juntei|juntei|ja guardei|guardei/.test(normalized);

  return explicitGoalIntent || purchaseWithSavedAmountIntent;
}

export function looksLikeReminderIntent(text: string) {
  const normalized = normalizeAssistantText(text);
  return /todo dia|todo mes|mensal|me lembra|me lembre|lembrete/.test(normalized) && /dia\s+\d{1,2}/.test(normalized);
}

export { looksLikePayableIntent };

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

  if (/me de dicas|me da dicas|dicas para economizar|como economizar|como posso economizar|como controlar meus gastos|como melhorar meu financeiro|quero dicas financeiras/.test(normalized)) {
    return { type: "financial_guidance" };
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

  if (looksLikeInvestmentIntent(normalized)) {
    const investmentType = detectInvestmentType(normalized);
    if (investmentType) {
      const targetValue = parseInvestmentTargetValue(text);
      const depositAmount = parseInvestmentDepositAmount(text, normalized);
      if (targetValue || depositAmount) {
        return {
          type: "upsert_investment",
          title: parseInvestmentTitle(text, investmentType),
          investmentType,
          ...(depositAmount ? { depositAmount } : {}),
          ...(targetValue ? { targetValue } : {}),
          explicitNew: /\b(novo|nova)\b/.test(normalized),
        };
      }
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

  if (!looksLikeInvestmentIntent(normalized) && /ja guardei|guardei|aportei|adicionei .* meta|separei .* meta/.test(normalized)) {
    const amount = parseMonetaryAmountFromNaturalLanguage(text);
    if (amount) return { type: "add_goal_contribution", amount };
  }

  if (/listar metas|minhas metas|quais metas|metas ativas|me mostra minhas metas|resuma minhas metas|resumo das metas/.test(normalized)) {
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

  const payable = parsePayable(text, normalized);
  if (payable) {
    return {
      type: "create_payable",
      title: payable.title,
      amount: payable.amount,
      dueDate: payable.dueDate,
      accountType: payable.accountType,
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
