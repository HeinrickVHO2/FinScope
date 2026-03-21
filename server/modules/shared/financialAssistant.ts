import type { RecurringTransaction, Transaction } from "@shared/schema";
import type { IStorage } from "../../storage";

type AccountScope = "PF" | "PJ" | "ALL";
type AssistantChannel = "whatsapp" | "internal_chat";

type AssistantUiPayload = {
  type: string;
  title?: string;
  subtitle?: string;
  chart?: Record<string, unknown>;
  cards?: Array<Record<string, unknown>>;
  progress?: Record<string, unknown>;
  limits?: Array<Record<string, unknown>>;
  route?: string;
  view?: string;
};

type AssistantIntent =
  | { type: "education"; answer: string }
  | { type: "help" }
  | { type: "monthly_summary"; scope: AccountScope }
  | { type: "cash_flow"; scope: AccountScope }
  | { type: "net_balance"; scope: AccountScope }
  | { type: "category_total"; scope: AccountScope; categoryLabel: string; aliases: string[] }
  | { type: "top_categories"; scope: AccountScope }
  | { type: "recurring_spending"; scope: AccountScope }
  | { type: "spending_health"; scope: AccountScope }
  | { type: "guidance"; scope: AccountScope }
  | { type: "savings_capacity"; scope: AccountScope };

type FinancialSummaryOptions = {
  referenceDate?: Date;
};

type CategorySummary = {
  category: string;
  amount: number;
  share: number;
};

type RecurringSpendSummary = {
  label: string;
  amount: number;
  frequencyLabel: string;
  source: "explicit" | "observed";
};

type ComparisonSummary = {
  incomeDelta: number;
  expensesDelta: number;
  netDelta: number;
  previousIncome: number;
  previousExpenses: number;
  previousNet: number;
};

type SourceSummary = {
  source: string;
  count: number;
  amount: number;
};

export type StructuredFinancialSummary = {
  scope: AccountScope;
  periodLabel: string;
  periodStart: string;
  periodEndExclusive: string;
  transactionCount: number;
  totalEntries: number;
  totalExits: number;
  balance: number;
  savingsSuggestion: number;
  topCategories: CategorySummary[];
  recurringExpenses: RecurringSpendSummary[];
  largestExpense: { description: string; amount: number; category: string } | null;
  sourceBreakdown: SourceSummary[];
  observations: string[];
  tips: string[];
  alerts: string[];
  comparison: ComparisonSummary;
};

export type FinancialAssistantResponse = {
  message: string;
  payload?: {
    intent: string;
    action: string;
    confidence: number;
    message: string;
    data?: Record<string, unknown>;
    ui_payload?: AssistantUiPayload;
  };
};

const EDUCATIONAL_ANSWERS: Array<{ pattern: RegExp; answer: string }> = [
  {
    pattern: /reserva de emergencia/i,
    answer:
      "Reserva de emergencia e um valor guardado para imprevistos. Em geral, faz sentido priorizar liquidez e baixo risco antes de pensar em investimentos mais volateis.",
  },
  {
    pattern: /diferenca.*cdb.*poupanca|cdb.*poupanca/i,
    answer:
      "De forma geral, CDB pode render mais que a poupanca, mas depende da taxa, do prazo e da liquidez. Vale comparar rendimento, vencimento e facilidade de resgate.",
  },
  {
    pattern: /o que e cdb/i,
    answer:
      "CDB e um titulo emitido por banco. Voce empresta dinheiro para a instituicao e recebe uma remuneracao. Vale olhar liquidez, prazo, rentabilidade e cobertura do FGC.",
  },
  {
    pattern: /o que e poupanca/i,
    answer:
      "Poupanca e uma aplicacao simples e liquida. Ela ajuda pela praticidade, mas costuma render menos do que outras alternativas conservadoras em muitos cenarios.",
  },
];

const CATEGORY_ALIASES: Array<{ label: string; aliases: string[] }> = [
  { label: "Alimentacao", aliases: ["alimentacao", "mercado", "supermercado", "padaria", "restaurante", "lanche"] },
  { label: "Transporte", aliases: ["transporte", "gasolina", "combustivel", "uber", "onibus", "carro"] },
  { label: "Moradia", aliases: ["moradia", "aluguel", "condominio", "casa", "luz", "agua"] },
  { label: "Saude", aliases: ["saude", "farmacia", "medico", "remedio", "exame"] },
  { label: "Lazer", aliases: ["lazer", "cinema", "viagem", "bar", "show"] },
  { label: "Educacao", aliases: ["educacao", "curso", "faculdade", "livro", "escola"] },
  { label: "Investimentos", aliases: ["investimento", "investimentos", "aporte", "aplicacao"] },
  { label: "Outros", aliases: ["outros", "diversos"] },
];

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectScope(text: string): AccountScope {
  const normalized = normalize(text);
  if (/\bpj\b|empresa|empresarial|negocio|cnpj/.test(normalized)) return "PJ";
  if (/\bpf\b|pessoal|particular/.test(normalized)) return "PF";
  return "ALL";
}

function includesFinanceTopic(text: string) {
  return /gasto|despesa|entrada|receita|categoria|saldo|economizar|economia|guardar|resumo|finance|dinheiro|conta|orcamento|dicas|recorrente/.test(text);
}

function findEducationalAnswer(text: string) {
  return EDUCATIONAL_ANSWERS.find((item) => item.pattern.test(text))?.answer ?? null;
}

function detectCategory(text: string) {
  const normalized = normalize(text);
  return CATEGORY_ALIASES.find((item) => item.aliases.some((alias) => normalized.includes(alias))) ?? null;
}

function looksLikeTransactionStatement(text: string) {
  const normalized = normalize(text);
  if (!/^(gastei|paguei|recebi|ganhei|comprei|vendi|faturei|pix|entrou|saiu)\b/.test(normalized)) {
    return false;
  }
  return !/(como|quanto|onde|qual|resumo|dicas|economizar|guardar|categoria|controle|controlar|exagerando)/.test(normalized);
}

function classifyAssistantIntent(text: string): AssistantIntent | null {
  const normalized = normalize(text);
  if (!normalized || looksLikeTransactionStatement(normalized)) {
    return null;
  }

  const educationalAnswer = findEducationalAnswer(normalized);
  if (educationalAnswer) {
    return { type: "education", answer: educationalAnswer };
  }

  const scope = detectScope(normalized);
  const category = detectCategory(normalized);

  if (/o que voce faz|me ajuda|ajuda com meu financeiro|como voce pode ajudar/.test(normalized)) {
    return { type: "help" };
  }

  if (/resumo financeiro|resumo do mes|resumo do meu mes|como foi meu mes|fechamento do mes|resuma meu mes|me mostra meu resumo/.test(normalized)) {
    return { type: "monthly_summary", scope };
  }

  if (/quanto entrou.*quanto saiu|quanto entrou e quanto saiu|entradas? e saidas? do mes/.test(normalized)) {
    return { type: "cash_flow", scope };
  }

  if (/quanto sobrou|saldo do mes|saldo liquido|liquido do mes/.test(normalized)) {
    return { type: "net_balance", scope };
  }

  if (/quanto posso guardar|quanto consigo guardar|quanto devo guardar|quanto posso separar/.test(normalized)) {
    return { type: "savings_capacity", scope };
  }

  if (/gastos recorrentes|despesas recorrentes|recorrentes do mes/.test(normalized)) {
    return { type: "recurring_spending", scope };
  }

  if ((/quanto.*gastei|gastos? com|despesas? com/.test(normalized) && category) || (/categoria/.test(normalized) && category)) {
    return { type: "category_total", scope, categoryLabel: category.label, aliases: category.aliases };
  }

  if (/gastos por categoria|maiores categorias|categorias mais pesaram|onde estou gastando mais|principais categorias|maiores gastos/.test(normalized)) {
    return { type: "top_categories", scope };
  }

  if (/onde estou exagerando|estou gastando muito|meus gastos estao altos|to gastando muito/.test(normalized)) {
    return { type: "spending_health", scope };
  }

  if (/posso economizar mais|como posso melhorar minhas financas|como controlar meus gastos|como posso controlar meus gastos|como organizar meus gastos|como melhorar meu financeiro|me de dicas|me da dicas|quero dicas|economizar no dia a dia|economizar durante a semana/.test(normalized)) {
    return { type: "guidance", scope };
  }

  if ((normalized.includes("?") && includesFinanceTopic(normalized)) || /quanto|qual|como|resumo|mostra|me mostra/.test(normalized)) {
    return { type: "help" };
  }

  return null;
}

function monthRange(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  return { start, end };
}

function previousMonthRange(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const end = new Date(reference.getFullYear(), reference.getMonth(), 1);
  return { start, end };
}

function formatMonthLabel(date: Date) {
  return `${MONTH_NAMES[date.getMonth()]}/${date.getFullYear()}`;
}

function toDate(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function sumTransactions(transactions: Transaction[], type: "entrada" | "saida") {
  return transactions
    .filter((item) => item.type === type)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
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
    const key = toDate(transaction.date).toISOString().slice(0, 10);
    if (!totals.has(key)) continue;
    totals.set(key, (totals.get(key) || 0) + Number(transaction.amount || 0));
  }

  return Array.from(totals.entries()).map(([date, amount]) => ({
    date,
    label: new Date(date).toLocaleDateString("pt-BR", { weekday: "short" }),
    amount: Number(amount.toFixed(2)),
  }));
}

function buildSummaryCards(summary: StructuredFinancialSummary) {
  return [
    { label: "Entradas", value: summary.totalEntries },
    { label: "Saídas", value: summary.totalExits },
    { label: "Saldo", value: summary.balance },
    { label: "Reserva sugerida", value: summary.savingsSuggestion },
  ];
}

function buildBreakdownSeries(summary: StructuredFinancialSummary) {
  return summary.topCategories.map((item) => ({
    label: item.category,
    value: item.amount,
    share: item.share,
  }));
}

function buildMonthlySummaryUiPayload(summary: StructuredFinancialSummary, transactions: Transaction[]): AssistantUiPayload {
  return {
    type: "financial_summary",
    title: "Resumo financeiro",
    subtitle: summary.periodLabel,
    cards: buildSummaryCards(summary),
    chart: {
      type: "bar",
      series: buildDailyExpenseSeries(
        transactions,
        new Date(summary.periodStart),
        new Date(summary.periodEndExclusive),
      ),
      breakdownSeries: buildBreakdownSeries(summary),
      largestExpense: summary.largestExpense,
      increaseExplanation: summary.observations[0] || summary.alerts[0] || null,
      tips: summary.tips,
      alerts: summary.alerts,
    },
  };
}

function buildBreakdownUiPayload(summary: StructuredFinancialSummary, title = "Divisão de gastos"): AssistantUiPayload {
  return {
    type: "expense_breakdown",
    title,
    subtitle: summary.periodLabel,
    cards: buildSummaryCards(summary),
    chart: {
      type: "pie",
      series: buildBreakdownSeries(summary),
      tips: summary.tips,
      alerts: summary.alerts,
    },
  };
}

function buildGuidanceUiPayload(summary: StructuredFinancialSummary): AssistantUiPayload {
  return {
    type: "financial_guidance",
    title: "Dicas financeiras",
    subtitle: summary.periodLabel,
    cards: buildSummaryCards(summary),
    chart: {
      type: "guidance",
      breakdownSeries: buildBreakdownSeries(summary),
      tips: summary.tips,
      alerts: summary.alerts,
    },
  };
}

function buildRecurringUiPayload(summary: StructuredFinancialSummary): AssistantUiPayload {
  const totalRecurring = summary.recurringExpenses.reduce((sum, item) => sum + item.amount, 0);
  return {
    type: "financial_guidance",
    title: "Gastos recorrentes",
    subtitle: summary.periodLabel,
    cards: summary.recurringExpenses.slice(0, 4).map((item) => ({
      label: item.label,
      value: item.amount,
      subtitle: item.frequencyLabel,
    })),
    chart: {
      type: "guidance",
      breakdownSeries: summary.recurringExpenses.slice(0, 5).map((item) => ({
        label: item.label,
        value: item.amount,
        share: totalRecurring > 0 ? Number((item.amount / totalRecurring).toFixed(4)) : 0,
      })),
      tips: summary.tips,
      alerts: summary.alerts,
    },
  };
}

function buildAssistantPayload(params: {
  intent: string;
  action: string;
  message: string;
  summary?: StructuredFinancialSummary;
  uiPayload?: AssistantUiPayload;
  data?: Record<string, unknown>;
}): FinancialAssistantResponse {
  return {
    message: params.message,
    payload: {
      intent: params.intent,
      action: params.action,
      confidence: 0.92,
      message: params.message,
      data: {
        ...(params.data || {}),
        ...(params.summary ? { summary: params.summary } : {}),
      },
      ui_payload: params.uiPayload,
    },
  };
}

function getTopExpenseCategories(transactions: Transaction[]): CategorySummary[] {
  const totals = new Map<string, number>();
  const totalExpenses = sumTransactions(transactions, "saida");

  for (const transaction of transactions) {
    if (transaction.type !== "saida") continue;
    const key = transaction.category || "Sem categoria";
    totals.set(key, (totals.get(key) || 0) + Number(transaction.amount || 0));
  }

  return Array.from(totals.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([category, amount]) => ({
      category,
      amount,
      share: totalExpenses > 0 ? amount / totalExpenses : 0,
    }));
}

function matchCategory(transaction: Transaction, aliases: string[]) {
  const category = normalize(transaction.category || "");
  const description = normalize(transaction.description || "");
  return aliases.some((alias) => category.includes(alias) || alias.includes(category) || description.includes(alias));
}

function buildObservedRecurringExpenses(transactions: Transaction[]): RecurringSpendSummary[] {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const grouped = new Map<string, { label: string; total: number; count: number }>();

  for (const transaction of transactions) {
    if (transaction.type !== "saida") continue;
    const date = toDate(transaction.date);
    if (date < ninetyDaysAgo) continue;

    const key = `${normalize(transaction.description || "")}::${normalize(transaction.category || "")}`;
    const current = grouped.get(key) || {
      label: transaction.description || transaction.category || "Despesa recorrente",
      total: 0,
      count: 0,
    };

    current.total += Number(transaction.amount || 0);
    current.count += 1;
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .filter((item) => item.count >= 2)
    .sort((left, right) => right.total - left.total)
    .slice(0, 3)
    .map((item) => ({
      label: item.label,
      amount: Number((item.total / item.count).toFixed(2)),
      frequencyLabel: item.count >= 3 ? "repetiu varias vezes" : "repetiu no periodo",
      source: "observed" as const,
    }));
}

function buildExplicitRecurringExpenses(records: RecurringTransaction[]) {
  return records
    .filter((item) => String(item.type || "").toLowerCase() === "expense")
    .sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0))
    .slice(0, 3)
    .map((item) => ({
      label: item.description || "Despesa recorrente",
      amount: Number(item.amount || 0),
      frequencyLabel: item.frequency === "weekly" ? "semanal" : "mensal",
      source: "explicit" as const,
    }));
}

async function readOptionalArray<T>(candidate: (() => Promise<T[]>) | undefined) {
  if (!candidate) return [] as T[];
  try {
    return await candidate();
  } catch {
    return [] as T[];
  }
}

export async function buildStructuredFinancialSummary(
  storage: IStorage,
  userId: string,
  scope: AccountScope = "ALL",
  options: FinancialSummaryOptions = {},
): Promise<StructuredFinancialSummary> {
  const referenceDate = options.referenceDate ?? new Date();
  const currentPeriod = monthRange(referenceDate);
  const previousPeriod = previousMonthRange(referenceDate);

  const storageLike = storage as IStorage & Partial<IStorage>;
  const [transactions, futureTransactions, futureExpenses, recurringTransactions] = await Promise.all([
    storage.getTransactionsByUserId(userId, scope),
    readOptionalArray(
      typeof storageLike.getFutureTransactions === "function"
        ? () => storageLike.getFutureTransactions!(userId, scope, "pending")
        : undefined,
    ),
    readOptionalArray(
      typeof storageLike.getFutureExpenses === "function"
        ? () => storageLike.getFutureExpenses!(userId, scope, "pending")
        : undefined,
    ),
    readOptionalArray(
      typeof storageLike.getRecurringTransactions === "function"
        ? () => storageLike.getRecurringTransactions!(userId, scope)
        : undefined,
    ),
  ]);

  const orderedTransactions = [...transactions].sort((left, right) => toDate(right.date).getTime() - toDate(left.date).getTime());
  const currentTransactions = orderedTransactions.filter((item) => {
    const date = toDate(item.date);
    return date >= currentPeriod.start && date < currentPeriod.end;
  });
  const previousTransactions = orderedTransactions.filter((item) => {
    const date = toDate(item.date);
    return date >= previousPeriod.start && date < previousPeriod.end;
  });

  const totalEntries = sumTransactions(currentTransactions, "entrada");
  const totalExits = sumTransactions(currentTransactions, "saida");
  const balance = totalEntries - totalExits;
  const previousIncome = sumTransactions(previousTransactions, "entrada");
  const previousExpenses = sumTransactions(previousTransactions, "saida");
  const previousNet = previousIncome - previousExpenses;

  const topCategories = getTopExpenseCategories(currentTransactions);
  const dominantCategory = topCategories[0] || null;
  const largestExpenseTransaction = currentTransactions
    .filter((item) => item.type === "saida")
    .sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0))[0];

  const pendingIncome = futureTransactions
    .filter((item) => String(item.type || "").toLowerCase() === "income")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pendingExpenses = futureTransactions
    .filter((item) => String(item.type || "").toLowerCase() === "expense")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
    + futureExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    + recurringTransactions
      .filter((item) => String(item.type || "").toLowerCase() === "expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const availableForSaving = balance + pendingIncome - pendingExpenses;
  const savingsSuggestion = balance > 0
    ? Number(Math.max(0, Math.min(balance * 0.2, availableForSaving > 0 ? availableForSaving * 0.35 : balance * 0.1)).toFixed(2))
    : 0;

  const recurringExpenses = (() => {
    const explicit = buildExplicitRecurringExpenses(recurringTransactions);
    if (explicit.length) return explicit;
    return buildObservedRecurringExpenses(orderedTransactions);
  })();

  const observations: string[] = [];
  const alerts: string[] = [];
  const tips: string[] = [];

  if (!currentTransactions.length) {
    observations.push("Ainda não encontrei movimentações suficientes neste período para montar um diagnóstico mais profundo.");
  }

  if (totalEntries <= 0 && totalExits > 0) {
    observations.push("Neste período só encontrei saídas. Vale conferir se faltam entradas registradas antes de tirar conclusões definitivas.");
  }

  if (totalEntries > 0 && totalExits > totalEntries) {
    alerts.push(`Suas saídas do período já ultrapassaram as entradas em ${formatCurrency(totalExits - totalEntries)}.`);
  }

  if (dominantCategory && dominantCategory.share >= 0.45) {
    alerts.push(`A categoria ${dominantCategory.category} concentra ${Math.round(dominantCategory.share * 100)}% das suas saídas do período.`);
  }

  if (recurringExpenses.length) {
    observations.push(`Identifiquei recorrências com mais peso em ${recurringExpenses[0].label} e outras despesas repetidas.`);
  }

  if (previousTransactions.length) {
    const expensesDelta = totalExits - previousExpenses;
    if (expensesDelta > 0) {
      observations.push(`Suas despesas subiram ${formatCurrency(expensesDelta)} em relação ao mês anterior.`);
    } else if (expensesDelta < 0) {
      observations.push(`Suas despesas caíram ${formatCurrency(Math.abs(expensesDelta))} em relação ao mês anterior.`);
    }
  }

  if (balance <= 0) {
    if (dominantCategory) {
      tips.push(`Comece revisando ${dominantCategory.category}, que já soma ${formatCurrency(dominantCategory.amount)} no período.`);
    }
    tips.push("Reduza primeiro gastos variáveis e recorrências pouco úteis antes de cortar itens essenciais.");
  } else {
    if (dominantCategory) {
      tips.push(`Seu maior ponto de atenção continua sendo ${dominantCategory.category}. Um teto simples nessa categoria pode proteger seu saldo.`);
    }
    if (savingsSuggestion > 0) {
      tips.push(`Se mantiver esse ritmo, você pode separar perto de ${formatCurrency(savingsSuggestion)} neste mês sem forçar demais o caixa.`);
    }
  }

  if (!tips.length) {
    tips.push("Acompanhe as categorias mais pesadas ao longo da semana para evitar concentração no fim do mês.");
  }

  const sourceTotals = new Map<string, { count: number; amount: number }>();
  for (const transaction of currentTransactions) {
    const key = transaction.source || "manual";
    const current = sourceTotals.get(key) || { count: 0, amount: 0 };
    current.count += 1;
    current.amount += Number(transaction.amount || 0);
    sourceTotals.set(key, current);
  }

  return {
    scope,
    periodLabel: formatMonthLabel(referenceDate),
    periodStart: currentPeriod.start.toISOString(),
    periodEndExclusive: currentPeriod.end.toISOString(),
    transactionCount: currentTransactions.length,
    totalEntries: Number(totalEntries.toFixed(2)),
    totalExits: Number(totalExits.toFixed(2)),
    balance: Number(balance.toFixed(2)),
    savingsSuggestion,
    topCategories,
    recurringExpenses,
    largestExpense: largestExpenseTransaction
      ? {
          description: largestExpenseTransaction.description,
          amount: Number(largestExpenseTransaction.amount || 0),
          category: largestExpenseTransaction.category || "Sem categoria",
        }
      : null,
    sourceBreakdown: Array.from(sourceTotals.entries())
      .map(([source, value]) => ({
        source,
        count: value.count,
        amount: Number(value.amount.toFixed(2)),
      }))
      .sort((left, right) => right.amount - left.amount),
    observations,
    tips,
    alerts,
    comparison: {
      incomeDelta: Number((totalEntries - previousIncome).toFixed(2)),
      expensesDelta: Number((totalExits - previousExpenses).toFixed(2)),
      netDelta: Number((balance - previousNet).toFixed(2)),
      previousIncome: Number(previousIncome.toFixed(2)),
      previousExpenses: Number(previousExpenses.toFixed(2)),
      previousNet: Number(previousNet.toFixed(2)),
    },
  };
}

function scopeLabel(scope: AccountScope) {
  if (scope === "PF") return " na sua conta pessoal";
  if (scope === "PJ") return " na sua empresa";
  return "";
}

function describeDelta(value: number, positiveLabel: string, negativeLabel: string) {
  if (value > 0) return `${positiveLabel} ${formatCurrency(value)}`;
  if (value < 0) return `${negativeLabel} ${formatCurrency(Math.abs(value))}`;
  return "ficou praticamente estavel";
}

function formatBulletList(items: string[]) {
  return items.map((item) => `• ${item}`).join("\n");
}

function formatSection(title: string, items: string[]) {
  return [title, ...items.map((item) => `• ${item}`)].join("\n");
}

export function formatStructuredFinancialSummary(summary: StructuredFinancialSummary, channel: AssistantChannel) {
  const topCategory = summary.topCategories[0] || null;
  const mainTip = summary.tips[0] || "Continue acompanhando as categorias com maior peso.";
  const mainAlert = summary.alerts[0] || summary.observations[0] || null;
  const categoryItems = summary.topCategories.length
    ? summary.topCategories.map((item) => `${item.category}: ${formatCurrency(item.amount)}`)
    : ["Ainda não houve saídas suficientes para destacar categorias."];
  const recurringItems = summary.recurringExpenses.length
    ? summary.recurringExpenses.map((item) => `${item.label}: ${formatCurrency(item.amount)} (${item.frequencyLabel})`)
    : ["Ainda não identifiquei recorrências relevantes neste período."];

  const lines = [
    `${channel === "whatsapp" ? "📊" : "✨"} Resumo financeiro de ${summary.periodLabel}${scopeLabel(summary.scope)}`,
    "",
    formatSection("💰 Visão geral", [
      `Entradas: ${formatCurrency(summary.totalEntries)}`,
      `Saídas: ${formatCurrency(summary.totalExits)}`,
      `Saldo: ${formatCurrency(summary.balance)}`,
    ]),
  ];

  if (topCategory || summary.largestExpense) {
    lines.push("", "🔎 Destaques");
    if (topCategory) {
      lines.push(`• Categoria com maior peso: ${topCategory.category} (${formatCurrency(topCategory.amount)})`);
    }
    if (summary.largestExpense) {
      lines.push(`• Maior gasto: ${summary.largestExpense.description} (${formatCurrency(summary.largestExpense.amount)})`);
    }
  }

  lines.push("");
  lines.push("📈 Comparação");
  lines.push(`• Despesas ${describeDelta(summary.comparison.expensesDelta, "subiram", "caíram")}`);
  lines.push(`• Saldo ${describeDelta(summary.comparison.netDelta, "melhorou", "piorou")}`);

  lines.push("");
  lines.push(channel === "whatsapp" ? "🧾 Categorias" : "🧾 Categorias com maior peso");
  lines.push(...formatBulletList(categoryItems.slice(0, channel === "whatsapp" ? 3 : 4)).split("\n"));

  if (channel !== "whatsapp") {
    lines.push("");
    lines.push("🔁 Recorrências");
    lines.push(...formatBulletList(recurringItems.slice(0, 3)).split("\n"));
  }

  if (mainAlert) {
    lines.push("");
    lines.push(`⚠️ ${mainAlert}`);
  }

  lines.push("");
  lines.push("💡 Próximo passo");
  lines.push(`• ${mainTip}`);

  if (summary.savingsSuggestion > 0) {
    lines.push(`• Reserva sugerida: ${formatCurrency(summary.savingsSuggestion)}`);
  }

  return lines.join("\n");
}

export function looksLikeFinanceAssistantQuestion(text: string) {
  return Boolean(classifyAssistantIntent(text));
}

export async function buildFinancialAssistantResponse(
  storage: IStorage,
  userId: string,
  text: string,
  channel: AssistantChannel = "whatsapp",
): Promise<FinancialAssistantResponse> {
  const intent = classifyAssistantIntent(text);
  if (!intent) {
    const message = channel === "whatsapp"
      ? "👋 Posso te ajudar com:\n• resumo do mês\n• gastos por categoria\n• controle de gastos\n• reserva sugerida\n• dúvidas simples sobre reserva, CDB e poupança"
      : "👋 Posso te ajudar com:\n• resumo financeiro\n• gastos por categoria\n• pontos de exagero\n• sugestão de reserva\n• orientações práticas para organizar melhor o caixa";
    return { message };
  }

  if (intent.type === "education") {
    return { message: intent.answer };
  }

  if (intent.type === "help") {
    return {
      message: channel === "whatsapp"
        ? "🤖 Posso fazer isso por você:\n• registrar gastos e recebimentos\n• resumir seu mês\n• mostrar categorias com mais peso\n• sugerir ajustes com base nos seus dados"
        : "🤖 Posso te ajudar com:\n• registrar movimentações\n• resumir o mês com dados reais\n• mostrar recorrências e categorias pesadas\n• sugerir ajustes e reserva de forma prática",
    };
  }

  const summary = await buildStructuredFinancialSummary(storage, userId, intent.scope);
  const topCategory = summary.topCategories[0] || null;
  const normalizedText = normalize(text);
  const transactions = await storage.getTransactionsByUserId(userId, intent.scope);

  if (!summary.transactionCount) {
    const message = channel === "whatsapp"
      ? `📭 Ainda não encontrei movimentações suficientes${scopeLabel(intent.scope)} neste mês.\n\nMe mande alguns gastos ou entradas e eu monto um resumo mais útil.`
      : `📭 Ainda não encontrei movimentações suficientes${scopeLabel(intent.scope)} neste mês.\n\nAssim que você registrar mais lançamentos, eu consigo montar uma análise mais confiável.`;
    return buildAssistantPayload({
      intent: "assistant.no_data",
      action: "show_empty_financial_state",
      message,
      summary,
      uiPayload: buildGuidanceUiPayload(summary),
    });
  }

  if (intent.type === "monthly_summary") {
    return buildAssistantPayload({
      intent: "assistant.monthly_summary",
      action: "show_monthly_summary",
      message: formatStructuredFinancialSummary(summary, channel),
      summary,
      uiPayload: buildMonthlySummaryUiPayload(summary, transactions),
    });
  }

  if (intent.type === "cash_flow") {
    const message = channel === "whatsapp"
      ? `💸 Fluxo do período${scopeLabel(intent.scope)}\n\n• Entradas: ${formatCurrency(summary.totalEntries)}\n• Saídas: ${formatCurrency(summary.totalExits)}\n• Saldo parcial: ${formatCurrency(summary.balance)}`
      : `💸 Fluxo do período${scopeLabel(intent.scope)}\n\n• Entradas: ${formatCurrency(summary.totalEntries)}\n• Saídas: ${formatCurrency(summary.totalExits)}\n• Saldo parcial: ${formatCurrency(summary.balance)}`;
    return buildAssistantPayload({
      intent: "assistant.cash_flow",
      action: "show_cash_flow",
      message,
      summary,
      uiPayload: buildMonthlySummaryUiPayload(summary, transactions),
    });
  }

  if (intent.type === "net_balance") {
    const message = channel === "whatsapp"
      ? `💰 Saldo atual${scopeLabel(intent.scope)}\n\n• Saldo parcial: ${formatCurrency(summary.balance)}`
      : `💰 Saldo atual${scopeLabel(intent.scope)}\n\n• Saldo parcial: ${formatCurrency(summary.balance)}\n• Vs. mês anterior: ${summary.comparison.netDelta >= 0 ? "melhorou" : "piorou"} ${formatCurrency(Math.abs(summary.comparison.netDelta))}`;
    return buildAssistantPayload({
      intent: "assistant.net_balance",
      action: "show_net_balance",
      message,
      summary,
      uiPayload: buildMonthlySummaryUiPayload(summary, transactions),
    });
  }

  if (intent.type === "category_total") {
    const current = monthRange();
    const matchedTransactions = transactions
      .filter((item) => {
        const date = toDate(item.date);
        return date >= current.start && date < current.end;
      })
      .filter((item) => item.type === "saida" && matchCategory(item, intent.aliases));
    const matchedTotal = matchedTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const message = matchedTotal <= 0
      ? `📂 Ainda não encontrei gastos de ${intent.categoryLabel.toLowerCase()}${scopeLabel(intent.scope)} neste mês.`
      : channel === "whatsapp"
        ? `📂 Gastos com ${intent.categoryLabel.toLowerCase()}${scopeLabel(intent.scope)}\n\n• Total no mês: ${formatCurrency(matchedTotal)}`
        : `📂 Gastos com ${intent.categoryLabel.toLowerCase()}${scopeLabel(intent.scope)}\n\n• Total no mês: ${formatCurrency(matchedTotal)}\n• Participação nas saídas: ${summary.totalExits > 0 ? Math.round((matchedTotal / summary.totalExits) * 100) : 0}%`;

    return buildAssistantPayload({
      intent: "assistant.category_total",
      action: "show_category_total",
      message,
      summary,
      data: { categoryLabel: intent.categoryLabel, matchedTotal },
      uiPayload: buildBreakdownUiPayload(summary, `Divisao de gastos`),
    });
  }

  if (intent.type === "top_categories") {
    const rankedItems = summary.topCategories.length
      ? summary.topCategories.map((item, index) => `${index + 1}. ${item.category} (${formatCurrency(item.amount)})`)
      : [];
    const ranked = rankedItems.length ? rankedItems.join("\n") : "Ainda nao houve saidas suficientes para destacar categorias.";
    const message = summary.topCategories.length
      ? channel === "whatsapp"
        ? `🧾 Categorias com maior peso${scopeLabel(intent.scope)}\n\n${rankedItems.map((item) => `• ${item}`).join("\n")}`
        : `🧾 Categorias com maior peso${scopeLabel(intent.scope)}\n\n${ranked}`
      : `📭 Ainda não encontrei saídas suficientes${scopeLabel(intent.scope)} neste mês para destacar categorias.`;

    return buildAssistantPayload({
      intent: "assistant.top_categories",
      action: "show_top_categories",
      message,
      summary,
      uiPayload: buildBreakdownUiPayload(summary, "Divisao por categoria"),
    });
  }

  if (intent.type === "recurring_spending") {
    const message = summary.recurringExpenses.length
      ? channel === "whatsapp"
        ? `🔁 Recorrencias com mais peso${scopeLabel(intent.scope)}\n\n${summary.recurringExpenses.map((item) => `• ${item.label} (${formatCurrency(item.amount)})`).join("\n")}`
        : `🔁 Gastos recorrentes com mais peso${scopeLabel(intent.scope)}\n\n${summary.recurringExpenses.map((item) => `• ${item.label} (${formatCurrency(item.amount)})`).join("\n")}`
      : `📭 Ainda não identifiquei gastos recorrentes relevantes${scopeLabel(intent.scope)} neste período.`;

    return buildAssistantPayload({
      intent: "assistant.recurring_spending",
      action: "show_recurring_spending",
      message,
      summary,
      uiPayload: buildRecurringUiPayload(summary),
    });
  }

  if (intent.type === "spending_health") {
    const message = summary.totalEntries <= 0 && summary.totalExits > 0
      ? `⚠️ Só encontrei saídas${scopeLabel(intent.scope)} neste mês.\n\nVale revisar se faltam entradas registradas antes de concluir que você está exagerando.`
      : summary.totalEntries > 0 && (summary.totalExits / summary.totalEntries) >= 0.9
        ? topCategory
          ? `⚠️ Você está perto do limite${scopeLabel(intent.scope)}.\n\n• As saídas já consomem ${Math.round((summary.totalExits / summary.totalEntries) * 100)}% das entradas\n• Maior pressão: ${topCategory.category}`
          : `⚠️ Você está perto do limite${scopeLabel(intent.scope)}.\n\n• As saídas já consomem cerca de ${Math.round((summary.totalExits / summary.totalEntries) * 100)}% das entradas`
        : summary.totalEntries > 0 && (summary.totalExits / summary.totalEntries) >= 0.7
          ? topCategory
            ? `✅ Seu mês está relativamente equilibrado${scopeLabel(intent.scope)}.\n\n• Ponto de atenção: ${topCategory.category}`
            : `✅ Seu mês está relativamente equilibrado${scopeLabel(intent.scope)}.\n\nVale observar as categorias variáveis para não apertar o fechamento.`
          : `✅ Seu ritmo de gastos está controlado${scopeLabel(intent.scope)} neste mês.`;

    return buildAssistantPayload({
      intent: "assistant.spending_health",
      action: "show_spending_health",
      message,
      summary,
      uiPayload: buildGuidanceUiPayload(summary),
    });
  }

  if (intent.type === "savings_capacity") {
    const message = summary.savingsSuggestion <= 0
      ? channel === "whatsapp"
        ? `🛟 Reserva sugerida${scopeLabel(intent.scope)}\n\n• Agora eu não separaria uma reserva nova\n• Primeiro vale recuperar folga no caixa`
        : `🛟 Reserva sugerida${scopeLabel(intent.scope)}\n\n• Agora eu não recomendaria separar uma reserva nova\n• Primeiro vale ajustar as categorias mais pesadas e recuperar folga no caixa`
      : channel === "whatsapp"
        ? `🛟 Reserva sugerida${scopeLabel(intent.scope)}\n\n• Você pode separar perto de ${formatCurrency(summary.savingsSuggestion)} neste mês`
        : `🛟 Reserva sugerida${scopeLabel(intent.scope)}\n\n• Você pode separar perto de ${formatCurrency(summary.savingsSuggestion)} neste mês\n• Eu faria isso depois de proteger recorrências e compromissos pendentes`;

    return buildAssistantPayload({
      intent: "assistant.savings_capacity",
      action: "show_savings_capacity",
      message,
      summary,
      uiPayload: buildGuidanceUiPayload(summary),
    });
  }

  if (intent.type === "guidance") {
    const recurringText = summary.recurringExpenses[0]
      ? ` e revisar ${summary.recurringExpenses[0].label}`
      : "";
    const message = /durante a semana|na semana|dia a dia|cotidiano|rotina/.test(normalizedText)
      ? topCategory
        ? `💡 Para economizar mais no dia a dia${scopeLabel(intent.scope)}\n\n*Foco da semana*\nCrie um teto curto para ${topCategory.category}.\n\n*Ação prática*\nRevise pequenas compras da rotina e feche a semana conferindo gastos repetidos.`
        : `💡 Para economizar mais no dia a dia${scopeLabel(intent.scope)}\n\n*Foco da semana*\nCrie um teto semanal simples.\n\n*Ação prática*\nRevise pequenas compras antes que elas se acumulem.`
      : summary.balance <= 0
        ? topCategory
          ? `💡 Seu fluxo do mês está apertado${scopeLabel(intent.scope)}.\n\n*Principal foco*\nComece revisando ${topCategory.category} (${formatCurrency(topCategory.amount)}).\n\n*Próximo ajuste*\nCorte recorrências pouco úteis antes de criar novas metas.`
          : `💡 Seu fluxo do mês está apertado${scopeLabel(intent.scope)}.\n\n*Principal foco*\nRevise gastos variáveis.\n\n*Próximo ajuste*\nReavalie recorrências antes de pensar em novas metas.`
        : topCategory
          ? `💡 Ajustes recomendados agora${scopeLabel(intent.scope)}\n\n*Principal foco*\nAtaque primeiro ${topCategory.category}${recurringText}.\n\n*Economia possível*\nMantendo esse ajuste, você pode separar perto de ${formatCurrency(summary.savingsSuggestion)} neste mês.`
          : `💡 Ajustes recomendados agora${scopeLabel(intent.scope)}\n\n*Principal foco*\nRevise gastos variáveis.\n\n*Próximo passo*\nCrie um teto semanal simples e separe uma parte do saldo para reserva.`;

    return buildAssistantPayload({
      intent: "assistant.guidance",
      action: "show_financial_guidance",
      message,
      summary,
      uiPayload: buildGuidanceUiPayload(summary),
    });
  }

  return {
    message: channel === "whatsapp"
      ? "👋 Posso te ajudar com resumo do mês, categorias com mais peso e sugestões de economia baseadas nos seus dados."
      : "👋 Posso te ajudar com resumo financeiro, categorias com maior peso e sugestões práticas baseadas nas suas movimentações.",
  };
}

export async function buildFinancialAssistantReply(
  storage: IStorage,
  userId: string,
  text: string,
  channel: AssistantChannel = "whatsapp",
) {
  const response = await buildFinancialAssistantResponse(storage, userId, text, channel);
  return response.message;
}
