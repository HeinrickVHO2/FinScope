import type { RecurringTransaction, Transaction } from "@shared/schema";
import type { IStorage } from "../../storage";

type AccountScope = "PF" | "PJ" | "ALL";
type AssistantChannel = "whatsapp" | "internal_chat";

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
    observations.push("Ainda nao encontrei movimentacoes suficientes neste periodo para montar um diagnostico mais profundo.");
  }

  if (totalEntries <= 0 && totalExits > 0) {
    observations.push("Neste periodo so encontrei saidas. Vale conferir se faltam entradas registradas antes de tirar conclusoes definitivas.");
  }

  if (totalEntries > 0 && totalExits > totalEntries) {
    alerts.push(`Suas saidas do periodo ja ultrapassaram as entradas em ${formatCurrency(totalExits - totalEntries)}.`);
  }

  if (dominantCategory && dominantCategory.share >= 0.45) {
    alerts.push(`A categoria ${dominantCategory.category} concentra ${Math.round(dominantCategory.share * 100)}% das suas saidas do periodo.`);
  }

  if (recurringExpenses.length) {
    observations.push(`Identifiquei recorrencias com mais peso em ${recurringExpenses[0].label} e outras despesas repetidas.`);
  }

  if (previousTransactions.length) {
    const expensesDelta = totalExits - previousExpenses;
    if (expensesDelta > 0) {
      observations.push(`Suas despesas subiram ${formatCurrency(expensesDelta)} em relacao ao mes anterior.`);
    } else if (expensesDelta < 0) {
      observations.push(`Suas despesas cairam ${formatCurrency(Math.abs(expensesDelta))} em relacao ao mes anterior.`);
    }
  }

  if (balance <= 0) {
    if (dominantCategory) {
      tips.push(`Comece revisando ${dominantCategory.category}, que ja soma ${formatCurrency(dominantCategory.amount)} no periodo.`);
    }
    tips.push("Reduza primeiro gastos variaveis e recorrencias pouco uteis antes de cortar itens essenciais.");
  } else {
    if (dominantCategory) {
      tips.push(`Seu maior ponto de atencao continua sendo ${dominantCategory.category}. Um teto simples nessa categoria pode proteger seu saldo.`);
    }
    if (savingsSuggestion > 0) {
      tips.push(`Se mantiver esse ritmo, voce pode separar perto de ${formatCurrency(savingsSuggestion)} neste mes sem forcar demais o caixa.`);
    }
  }

  if (!tips.length) {
    tips.push("Acompanhe as categorias mais pesadas ao longo da semana para evitar concentracao no fim do mes.");
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
  if (scope === "PJ") return " na sua conta empresarial";
  return "";
}

function describeDelta(value: number, positiveLabel: string, negativeLabel: string) {
  if (value > 0) return `${positiveLabel} ${formatCurrency(value)}`;
  if (value < 0) return `${negativeLabel} ${formatCurrency(Math.abs(value))}`;
  return "ficou praticamente estavel";
}

export function formatStructuredFinancialSummary(summary: StructuredFinancialSummary, channel: AssistantChannel) {
  const topCategory = summary.topCategories[0] || null;
  const mainTip = summary.tips[0] || "Continue acompanhando as categorias com maior peso.";
  const mainAlert = summary.alerts[0] || summary.observations[0] || null;

  if (channel === "whatsapp") {
    const lines = [
      `Resumo de ${summary.periodLabel}`,
      `Neste mes, entraram ${formatCurrency(summary.totalEntries)} e sairam ${formatCurrency(summary.totalExits)}.`,
      `Entradas: ${formatCurrency(summary.totalEntries)}`,
      `Saidas: ${formatCurrency(summary.totalExits)}`,
      `Saldo: ${formatCurrency(summary.balance)}`,
    ];

    if (topCategory) {
      lines.push(`Categoria com maior peso: ${topCategory.category} (${formatCurrency(topCategory.amount)})`);
    }
    if (summary.largestExpense) {
      lines.push(`Maior gasto: ${summary.largestExpense.description} (${formatCurrency(summary.largestExpense.amount)})`);
    }
    if (mainAlert) {
      lines.push(`Ponto de atencao: ${mainAlert}`);
    }
    lines.push(`Dica principal: ${mainTip}`);
    if (summary.savingsSuggestion > 0) {
      lines.push(`Reserva sugerida: ${formatCurrency(summary.savingsSuggestion)}`);
    }

    return lines.join("\n");
  }

  const categoryLines = summary.topCategories.length
    ? summary.topCategories.map((item, index) => `${index + 1}. ${item.category}: ${formatCurrency(item.amount)}`).join("\n")
    : "Ainda nao houve saidas suficientes para destacar categorias.";

  const recurringLines = summary.recurringExpenses.length
    ? summary.recurringExpenses.map((item) => `- ${item.label}: ${formatCurrency(item.amount)} (${item.frequencyLabel})`).join("\n")
    : "- Ainda nao identifiquei recorrencias relevantes neste periodo.";

  const detailLines = [
    `Resumo financeiro de ${summary.periodLabel}${scopeLabel(summary.scope)}`,
    "",
    `Entradas: ${formatCurrency(summary.totalEntries)}`,
    `Saidas: ${formatCurrency(summary.totalExits)}`,
    `Saldo: ${formatCurrency(summary.balance)}`,
    `Comparacao com o mes anterior: despesas ${describeDelta(summary.comparison.expensesDelta, "subiram", "cairam")}; saldo ${describeDelta(summary.comparison.netDelta, "melhorou", "piorou")}.`,
    "",
    "Categorias com maior peso:",
    categoryLines,
    "",
    "Recorrencias observadas:",
    recurringLines,
  ];

  if (summary.largestExpense) {
    detailLines.push("", `Maior gasto identificado: ${summary.largestExpense.description} (${formatCurrency(summary.largestExpense.amount)}).`);
  }

  if (summary.alerts.length) {
    detailLines.push("", "Alertas:", ...summary.alerts.map((item) => `- ${item}`));
  }

  if (summary.tips.length) {
    detailLines.push("", "Proximos passos:", ...summary.tips.map((item) => `- ${item}`));
  }

  return detailLines.join("\n");
}

export function looksLikeFinanceAssistantQuestion(text: string) {
  return Boolean(classifyAssistantIntent(text));
}

export async function buildFinancialAssistantReply(
  storage: IStorage,
  userId: string,
  text: string,
  channel: AssistantChannel = "whatsapp",
) {
  const intent = classifyAssistantIntent(text);
  if (!intent) {
    return channel === "whatsapp"
      ? "Posso ajudar com resumo do mes, gastos por categoria, controle de gastos, reserva sugerida e explicacoes simples sobre reserva de emergencia, CDB e poupanca."
      : "Posso ajudar com resumo financeiro, gastos por categoria, pontos de exagero, sugestao de reserva e explicacoes simples sobre organizacao financeira.";
  }

  if (intent.type === "education") {
    return intent.answer;
  }

  if (intent.type === "help") {
    return channel === "whatsapp"
      ? "Posso registrar gastos e recebimentos, resumir seu mes, mostrar categorias com mais peso e sugerir ajustes com base nos seus dados."
      : "Posso registrar movimentacoes e tambem analisar seu mes com base nas transacoes reais: resumo, categorias com maior peso, recorrencias, pontos de exagero e sugestao de reserva.";
  }

  const summary = await buildStructuredFinancialSummary(storage, userId, intent.scope);
  const topCategory = summary.topCategories[0] || null;
  const normalizedText = normalize(text);

  if (!summary.transactionCount) {
    return channel === "whatsapp"
      ? `Ainda nao encontrei movimentacoes suficientes${scopeLabel(intent.scope)} neste mes para responder com confianca.`
      : `Ainda nao encontrei movimentacoes suficientes${scopeLabel(intent.scope)} neste mes para montar uma analise confiavel.`;
  }

  if (intent.type === "monthly_summary") {
    return formatStructuredFinancialSummary(summary, channel);
  }

  if (intent.type === "cash_flow") {
    return channel === "whatsapp"
      ? `Neste mes${scopeLabel(intent.scope)}, entraram ${formatCurrency(summary.totalEntries)} e sairam ${formatCurrency(summary.totalExits)}. O saldo parcial esta em ${formatCurrency(summary.balance)}.`
      : `Neste mes${scopeLabel(intent.scope)}, seu fluxo esta em ${formatCurrency(summary.totalEntries)} de entradas contra ${formatCurrency(summary.totalExits)} de saidas. O saldo parcial esta em ${formatCurrency(summary.balance)}.`;
  }

  if (intent.type === "net_balance") {
    return channel === "whatsapp"
      ? `Neste mes${scopeLabel(intent.scope)}, seu saldo parcial esta em ${formatCurrency(summary.balance)}.`
      : `Neste mes${scopeLabel(intent.scope)}, seu saldo parcial esta em ${formatCurrency(summary.balance)}. Em relacao ao mes anterior, ele ${summary.comparison.netDelta >= 0 ? "melhorou" : "piorou"} ${formatCurrency(Math.abs(summary.comparison.netDelta))}.`;
  }

  if (intent.type === "category_total") {
    const current = monthRange();
    const matchedTransactions = (await storage.getTransactionsByUserId(userId, intent.scope))
      .filter((item) => {
        const date = toDate(item.date);
        return date >= current.start && date < current.end;
      })
      .filter((item) => item.type === "saida" && matchCategory(item, intent.aliases));
    const matchedTotal = matchedTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    if (matchedTotal <= 0) {
      return `Ainda nao encontrei gastos de ${intent.categoryLabel.toLowerCase()}${scopeLabel(intent.scope)} neste mes.`;
    }

    return channel === "whatsapp"
      ? `Neste mes${scopeLabel(intent.scope)}, seus gastos com ${intent.categoryLabel.toLowerCase()} somam ${formatCurrency(matchedTotal)}.`
      : `Neste mes${scopeLabel(intent.scope)}, seus gastos com ${intent.categoryLabel.toLowerCase()} somam ${formatCurrency(matchedTotal)}. Isso representa ${summary.totalExits > 0 ? Math.round((matchedTotal / summary.totalExits) * 100) : 0}% das suas saidas.`;
  }

  if (intent.type === "top_categories") {
    if (!summary.topCategories.length) {
      return `Ainda nao encontrei saidas suficientes${scopeLabel(intent.scope)} neste mes para destacar categorias.`;
    }
    const ranked = summary.topCategories
      .map((item, index) => `${index + 1}. ${item.category} (${formatCurrency(item.amount)})`)
      .join(channel === "whatsapp" ? " " : "\n");
    return channel === "whatsapp"
      ? `As categorias que mais pesaram${scopeLabel(intent.scope)} neste mes foram: ${ranked}`
      : `As categorias que mais pesaram${scopeLabel(intent.scope)} neste mes foram:\n${ranked}`;
  }

  if (intent.type === "recurring_spending") {
    if (!summary.recurringExpenses.length) {
      return `Ainda nao identifiquei gastos recorrentes relevantes${scopeLabel(intent.scope)} neste periodo.`;
    }
    const ranked = summary.recurringExpenses
      .map((item) => `${item.label} (${formatCurrency(item.amount)})`)
      .join(channel === "whatsapp" ? ", " : "\n");
    return channel === "whatsapp"
      ? `Os recorrentes com mais peso${scopeLabel(intent.scope)} sao: ${ranked}.`
      : `Os gastos recorrentes com mais peso${scopeLabel(intent.scope)} sao:\n${ranked}`;
  }

  if (intent.type === "spending_health") {
    if (summary.totalEntries <= 0 && summary.totalExits > 0) {
      return `Neste mes${scopeLabel(intent.scope)}, so encontrei saidas. Vale revisar se faltam entradas registradas antes de concluir se voce esta exagerando.`;
    }
    const ratio = summary.totalEntries > 0 ? summary.totalExits / summary.totalEntries : 1;
    if (ratio >= 0.9) {
      return topCategory
        ? `Voce esta perto do limite${scopeLabel(intent.scope)}: suas saidas ja consomem cerca de ${Math.round(ratio * 100)}% das entradas, com maior pressao em ${topCategory.category}.`
        : `Voce esta perto do limite${scopeLabel(intent.scope)}: suas saidas ja consomem cerca de ${Math.round(ratio * 100)}% das entradas.`;
    }
    if (ratio >= 0.7) {
      return topCategory
        ? `Seu mes esta relativamente equilibrado${scopeLabel(intent.scope)}, mas ${topCategory.category} ainda merece atencao para nao apertar o fechamento.`
        : `Seu mes esta relativamente equilibrado${scopeLabel(intent.scope)}, mas ainda vale observar as categorias variaveis.`;
    }
    return `Seu ritmo de gastos esta controlado${scopeLabel(intent.scope)} neste mes.`;
  }

  if (intent.type === "savings_capacity") {
    if (summary.savingsSuggestion <= 0) {
      return channel === "whatsapp"
        ? `Neste momento${scopeLabel(intent.scope)}, eu nao separaria reserva nova. Primeiro vale ajustar as categorias com maior peso e recuperar folga no caixa.`
        : `Neste momento${scopeLabel(intent.scope)}, eu nao recomendaria separar uma reserva nova. O melhor proximo passo e ajustar as categorias com maior peso e recuperar folga no caixa.`;
    }
    return channel === "whatsapp"
      ? `Mantendo o ritmo atual${scopeLabel(intent.scope)}, voce pode separar algo perto de ${formatCurrency(summary.savingsSuggestion)} neste mes.`
      : `Mantendo o ritmo atual${scopeLabel(intent.scope)}, voce pode separar algo perto de ${formatCurrency(summary.savingsSuggestion)} neste mes. Eu faria isso depois de proteger as despesas ja recorrentes e os compromissos pendentes.`;
  }

  if (intent.type === "guidance") {
    if (/durante a semana|na semana|dia a dia|cotidiano|rotina/.test(normalizedText)) {
      return topCategory
        ? `Para economizar mais no dia a dia${scopeLabel(intent.scope)}, vale criar um teto curto para ${topCategory.category}, revisar pequenas compras da rotina e fechar a semana conferindo os gastos repetidos.`
        : `Para economizar mais no dia a dia${scopeLabel(intent.scope)}, vale criar um teto semanal simples e revisar pequenas compras antes que elas se acumulem.`;
    }

    if (summary.balance <= 0) {
      return topCategory
        ? `Seu fluxo do mes esta apertado${scopeLabel(intent.scope)}. Eu comecaria revisando ${topCategory.category}, que ja soma ${formatCurrency(topCategory.amount)}, e tambem recorrencias pouco uteis.`
        : `Seu fluxo do mes esta apertado${scopeLabel(intent.scope)}. Vale revisar gastos variaveis e recorrencias antes de pensar em novas metas.`;
    }

    const recurringText = summary.recurringExpenses[0]
      ? ` e revisar ${summary.recurringExpenses[0].label}`
      : "";

    return topCategory
      ? `Para economizar mais${scopeLabel(intent.scope)}, eu atacaria primeiro ${topCategory.category}${recurringText}. Se mantiver esse ajuste, voce pode separar perto de ${formatCurrency(summary.savingsSuggestion)} neste mes.`
      : `Para economizar mais${scopeLabel(intent.scope)}, vale revisar gastos variaveis, criar um teto semanal simples e separar uma parte do saldo para reserva.`;
  }

  return channel === "whatsapp"
    ? "Posso ajudar com resumo do mes, categorias com mais peso e sugestoes de economia baseadas nos seus dados."
    : "Posso ajudar com resumo financeiro, categorias com maior peso e sugestoes praticas baseadas nas suas movimentacoes.";
}
