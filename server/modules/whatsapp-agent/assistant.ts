import type { Transaction } from "@shared/schema";
import type { IStorage } from "../../storage";

type AssistantIntent =
  | { type: "education"; answer: string }
  | { type: "monthly_summary"; scope: "PF" | "PJ" | "ALL" }
  | { type: "cash_flow"; scope: "PF" | "PJ" | "ALL" }
  | { type: "net_balance"; scope: "PF" | "PJ" | "ALL" }
  | { type: "category_total"; scope: "PF" | "PJ" | "ALL"; categoryLabel: string; aliases: string[] }
  | { type: "top_categories"; scope: "PF" | "PJ" | "ALL" }
  | { type: "spending_health"; scope: "PF" | "PJ" | "ALL" }
  | { type: "guidance"; scope: "PF" | "PJ" | "ALL" }
  | { type: "help" };

const EDUCATIONAL_ANSWERS: Array<{ pattern: RegExp; answer: string }> = [
  {
    pattern: /reserva de emergencia/i,
    answer:
      "Reserva de emergencia e um valor guardado para imprevistos. Em geral, faz sentido priorizar liquidez e baixo risco antes de pensar em investimentos mais volateis.",
  },
  {
    pattern: /diferenca.*cdb.*poupanca|cdb.*poupanca/i,
    answer:
      "De forma geral, CDB pode render mais que a poupanca, mas depende da taxa, do prazo e da liquidez. A poupanca e mais simples; no CDB vale comparar rendimento, vencimento e resgate.",
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
  {
    pattern: /vale mais a pena guardar ou investir/i,
    answer:
      "Como orientacao geral, primeiro vale garantir caixa para despesas proximas e uma reserva de emergencia. Depois disso, investir costuma fazer mais sentido do que apenas deixar parado, mas a escolha depende de prazo e risco.",
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

function currentMonthRange(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  return { start, end };
}

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

function detectScope(text: string): "PF" | "PJ" | "ALL" {
  const normalized = normalize(text);
  if (/\bpj\b|empresa|empresarial|negocio|cnpj/.test(normalized)) return "PJ";
  if (/\bpf\b|pessoal|particular/.test(normalized)) return "PF";
  return "ALL";
}

function includesFinanceTopic(text: string) {
  return /gasto|gastei|despesa|entrada|receita|recebi|mes|mes atual|categoria|saldo|sobrou|economizar|guardar|reserva|poupanca|cdb|invest|finance|dinheiro|conta|orcamento/.test(text);
}

function findEducationalAnswer(text: string) {
  return EDUCATIONAL_ANSWERS.find((item) => item.pattern.test(text))?.answer ?? null;
}

function detectCategory(text: string) {
  const normalized = normalize(text);
  return CATEGORY_ALIASES.find((item) => item.aliases.some((alias) => normalized.includes(alias))) ?? null;
}

function classifyAssistantIntent(text: string): AssistantIntent | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  const educationalAnswer = findEducationalAnswer(normalized);
  if (educationalAnswer) {
    return { type: "education", answer: educationalAnswer };
  }

  const scope = detectScope(normalized);
  const category = detectCategory(normalized);

  if (/o que voce faz|me ajuda|ajuda com meu financeiro|como voce pode ajudar/.test(normalized)) {
    return { type: "help" };
  }

  if (/resumo.*mes|como foi meu mes|fechamento do mes|resuma meu mes/.test(normalized)) {
    return { type: "monthly_summary", scope };
  }

  if (/quanto entrou.*quanto saiu|quanto entrou e quanto saiu|entradas? e saidas? do mes/.test(normalized)) {
    return { type: "cash_flow", scope };
  }

  if (/quanto sobrou|saldo do mes|saldo liquido|liquido do mes/.test(normalized)) {
    return { type: "net_balance", scope };
  }

  if ((/quanto.*gastei|gastos? com|despesas? com/.test(normalized) && category) || (/categoria/.test(normalized) && category)) {
    return { type: "category_total", scope, categoryLabel: category.label, aliases: category.aliases };
  }

  if (/maiores categorias|categorias mais pesaram|onde estou gastando mais|principais categorias|maiores gastos/.test(normalized)) {
    return { type: "top_categories", scope };
  }

  if (/estou gastando muito|meus gastos estao altos|to gastando muito/.test(normalized)) {
    return { type: "spending_health", scope };
  }

  if (/posso economizar mais|como posso melhorar minhas financas|como organizar meus gastos|como melhorar minhas financas|como melhorar meu financeiro/.test(normalized)) {
    return { type: "guidance", scope };
  }

  if (/como posso economizar mais durante a semana|economizar mais durante a semana|gastar menos durante a semana/.test(normalized)) {
    return { type: "guidance", scope };
  }

  if ((normalized.includes("?") && includesFinanceTopic(normalized)) || /quanto|qual|como|resumo|mostra|me mostra/.test(normalized)) {
    return { type: "help" };
  }

  return null;
}

function filterCurrentMonth(transactions: Transaction[]) {
  const { start, end } = currentMonthRange();
  return transactions.filter((item) => item.date >= start && item.date < end);
}

function sumTransactions(transactions: Transaction[], type: "entrada" | "saida") {
  return transactions
    .filter((item) => item.type === type)
    .reduce((sum, item) => sum + Number(item.amount), 0);
}

function getTopExpenseCategories(transactions: Transaction[]) {
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== "saida") continue;
    const key = transaction.category || "Sem categoria";
    totals.set(key, (totals.get(key) || 0) + Number(transaction.amount));
  }

  return Array.from(totals.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3);
}

function matchCategory(transaction: Transaction, aliases: string[]) {
  const category = normalize(transaction.category || "");
  const description = normalize(transaction.description || "");
  return aliases.some((alias) => category.includes(alias) || alias.includes(category) || description.includes(alias));
}

function scopeLabel(scope: "PF" | "PJ" | "ALL") {
  if (scope === "PF") return " na sua conta pessoal";
  if (scope === "PJ") return " na sua conta empresarial";
  return "";
}

async function getCurrentMonthTransactions(storage: IStorage, userId: string, scope: "PF" | "PJ" | "ALL") {
  const transactions = await storage.getTransactionsByUserId(userId, scope);
  return filterCurrentMonth(transactions);
}

export function looksLikeFinanceAssistantQuestion(text: string) {
  return Boolean(classifyAssistantIntent(text));
}

export async function buildFinanceAssistantReply(storage: IStorage, userId: string, text: string) {
  const intent = classifyAssistantIntent(text);
  if (!intent) {
    return "Posso ajudar com resumo do mes, gastos por categoria, saldo do periodo e explicacoes simples sobre reserva de emergencia, CDB e poupanca.";
  }

  if (intent.type === "education") {
    return intent.answer;
  }

  if (intent.type === "help") {
    return "Posso registrar gastos e recebimentos, resumir seu mes, mostrar categorias com mais impacto e responder duvidas simples sobre organizacao financeira, reserva de emergencia, CDB e poupanca.";
  }

  const monthTransactions = await getCurrentMonthTransactions(storage, userId, intent.scope);
  const income = sumTransactions(monthTransactions, "entrada");
  const expenses = sumTransactions(monthTransactions, "saida");
  const net = income - expenses;

  if (intent.type === "monthly_summary") {
    if (!monthTransactions.length) {
      return `Ainda nao encontrei movimentacoes suficientes${scopeLabel(intent.scope)} neste mes para montar um resumo confiavel.`;
    }

    const topCategory = getTopExpenseCategories(monthTransactions)[0];
    const topCategoryText = topCategory
      ? ` A categoria com maior peso foi ${topCategory[0]}, com ${formatCurrency(topCategory[1])}.`
      : "";

    return `Neste mes${scopeLabel(intent.scope)}, entraram ${formatCurrency(income)} e sairam ${formatCurrency(expenses)}. Seu saldo liquido esta em ${formatCurrency(net)}.${topCategoryText}`;
  }

  if (intent.type === "cash_flow") {
    if (!monthTransactions.length) {
      return `Ainda nao tenho movimentacoes suficientes${scopeLabel(intent.scope)} neste mes para comparar entradas e saidas.`;
    }

    return `Neste mes${scopeLabel(intent.scope)}, entraram ${formatCurrency(income)} e sairam ${formatCurrency(expenses)}. O saldo liquido parcial esta em ${formatCurrency(net)}.`;
  }

  if (intent.type === "net_balance") {
    if (!monthTransactions.length) {
      return `Ainda nao tenho dados suficientes${scopeLabel(intent.scope)} neste mes para calcular quanto sobrou.`;
    }

    return `Neste mes${scopeLabel(intent.scope)}, seu saldo liquido esta em ${formatCurrency(net)}.`;
  }

  if (intent.type === "category_total") {
    const total = monthTransactions
      .filter((item) => item.type === "saida")
      .filter((item) => matchCategory(item, intent.aliases))
      .reduce((sum, item) => sum + Number(item.amount), 0);

    if (total <= 0) {
      return `Ainda nao encontrei gastos de ${intent.categoryLabel.toLowerCase()}${scopeLabel(intent.scope)} neste mes.`;
    }

    return `Neste mes${scopeLabel(intent.scope)}, seus gastos com ${intent.categoryLabel.toLowerCase()} somam ${formatCurrency(total)}.`;
  }

  if (intent.type === "top_categories") {
    const topCategories = getTopExpenseCategories(monthTransactions);
    if (!topCategories.length) {
      return `Ainda nao tenho saidas suficientes${scopeLabel(intent.scope)} neste mes para apontar as categorias com maior peso.`;
    }

    const text = topCategories
      .map(([category, amount], index) => `${index + 1}. ${category} (${formatCurrency(amount)})`)
      .join(" ");

    return `As categorias que mais pesaram${scopeLabel(intent.scope)} neste mes foram: ${text}`;
  }

  if (intent.type === "spending_health") {
    if (!monthTransactions.length) {
      return `Ainda nao tenho movimentacoes suficientes${scopeLabel(intent.scope)} neste mes para avaliar seu ritmo de gastos.`;
    }

    if (income <= 0 && expenses > 0) {
      return `Neste mes${scopeLabel(intent.scope)}, so encontrei saidas. Vale revisar se faltam entradas registradas antes de concluir se voce esta gastando demais.`;
    }

    const expenseRatio = income > 0 ? expenses / income : 1;
    if (expenseRatio >= 0.9) {
      return `Seus gastos estao altos${scopeLabel(intent.scope)} neste mes: as saidas ja consomem cerca de ${Math.round(expenseRatio * 100)}% das entradas. Vale revisar as categorias com maior peso antes do fechamento.`;
    }
    if (expenseRatio >= 0.7) {
      return `Seu mes esta relativamente equilibrado${scopeLabel(intent.scope)}, mas as saidas ja consomem ${Math.round(expenseRatio * 100)}% das entradas. Ainda da para ajustar categorias menos essenciais.`;
    }

    return `Seu ritmo de gastos esta controlado${scopeLabel(intent.scope)} neste mes. As saidas consomem cerca de ${Math.round(expenseRatio * 100)}% das entradas.`;
  }

  if (intent.type === "guidance") {
    if (!monthTransactions.length) {
      return "Posso te orientar melhor quando houver mais movimentacoes registradas. Por enquanto, um bom começo e separar gastos essenciais, limitar despesas recorrentes e criar uma reserva para imprevistos.";
    }

    const topCategories = getTopExpenseCategories(monthTransactions);
    const topCategory = topCategories[0];
    const normalizedText = normalize(text);

    if (/durante a semana|na semana/.test(normalizedText)) {
      if (topCategory) {
        return `Para economizar mais durante a semana${scopeLabel(intent.scope)}, vale definir um teto curto para ${topCategory[0]}, evitar compras por impulso no dia a dia e revisar pequenos gastos recorrentes antes do fim da semana.`;
      }
      return `Para economizar mais durante a semana${scopeLabel(intent.scope)}, vale definir um limite para gastos variaveis, planejar alimentacao e acompanhar pequenas despesas antes que elas se acumulem.`;
    }

    if (net <= 0) {
      return topCategory
        ? `Seu fluxo do mes esta apertado${scopeLabel(intent.scope)}. Eu comecaria revisando ${topCategory[0]}, que ja soma ${formatCurrency(topCategory[1])}, e tambem gastos recorrentes pouco uteis.`
        : `Seu fluxo do mes esta apertado${scopeLabel(intent.scope)}. Vale revisar gastos recorrentes e tentar reduzir as categorias menos essenciais.`;
    }

    const suggestedReserve = net * 0.2;
    return topCategory
      ? `Seu mes esta positivo${scopeLabel(intent.scope)}. Como proximo passo, vale observar ${topCategory[0]} e considerar separar algo perto de ${formatCurrency(suggestedReserve)} para reserva ou objetivo de curto prazo.`
      : `Seu mes esta positivo${scopeLabel(intent.scope)}. Como orientacao geral, voce pode separar parte do saldo para reserva e acompanhar os gastos variaveis para nao perder o controle.`;
  }

  return "Posso ajudar com resumo do mes, gastos por categoria, saldo do periodo e explicacoes simples sobre organizacao financeira.";
}
