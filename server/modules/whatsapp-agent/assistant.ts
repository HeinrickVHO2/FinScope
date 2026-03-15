import type { IStorage } from "../../storage";

const EDUCATIONAL_ANSWERS: Array<{ pattern: RegExp; answer: string }> = [
  {
    pattern: /reserva de emergencia|reserva de emergência/i,
    answer: "Reserva de emergência é um valor guardado para imprevistos. Em geral, faz sentido buscar liquidez e baixo risco antes de pensar em investimentos mais voláteis.",
  },
  {
    pattern: /diferen[cç]a.*cdb.*poupan[cç]a|cdb.*poupan[cç]a/i,
    answer: "De forma geral, CDB costuma ter rendimento potencial maior que a poupança, mas depende da taxa, prazo e liquidez. A poupança é mais simples; o CDB exige comparar regras e vencimento.",
  },
  {
    pattern: /o que e[é] cdb|o que é cdb/i,
    answer: "CDB é um título emitido por banco. Você empresta dinheiro para a instituição e recebe uma remuneração combinada. Vale olhar liquidez, prazo, rentabilidade e cobertura do FGC.",
  },
  {
    pattern: /o que e[é] poupan[cç]a|o que é poupança/i,
    answer: "Poupança é uma aplicação simples e líquida. Ela pode ser útil pela praticidade, mas costuma render menos do que outras alternativas conservadoras em muitos cenários.",
  },
];

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
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
    .trim();
}

export function looksLikeFinanceAssistantQuestion(text: string) {
  const normalized = normalize(text);
  if (!normalized) return false;

  return (
    normalized.includes("?") ||
    /^(quanto|qual|como|me mostra|mostra|resumo|posso|o que e|o que é)/.test(normalized) ||
    /reserva de emergencia|poupanca|poupança|cdb|investimento|investir|economizar|guardar dinheiro/.test(normalized)
  );
}

export async function buildFinanceAssistantReply(storage: IStorage, userId: string, text: string) {
  const normalized = normalize(text);

  for (const item of EDUCATIONAL_ANSWERS) {
    if (item.pattern.test(normalized)) {
      return item.answer;
    }
  }

  if (/resumo.*m[eê]s|como foi meu m[eê]s|fechamento do m[eê]s/i.test(normalized)) {
    const metrics = await storage.getDashboardMetrics(userId, "ALL");
    return `No mês atual, você tem ${formatCurrency(metrics.monthlyIncome)} de entradas, ${formatCurrency(metrics.monthlyExpenses)} de saídas e saldo mensal de ${formatCurrency(metrics.netCashFlow)}.`;
  }

  if (/quanto.*gastei.*alimenta|gastos?.*alimenta/i.test(normalized)) {
    const transactions = await storage.getTransactionsByUserId(userId, "ALL");
    const { start, end } = currentMonthRange();
    const total = transactions
      .filter((item) => item.type === "saida")
      .filter((item) => item.date >= start && item.date < end)
      .filter((item) => item.category.toLowerCase().includes("alimenta"))
      .reduce((sum, item) => sum + Number(item.amount), 0);

    return `Neste mês, seus gastos com alimentação somam ${formatCurrency(total)}.`;
  }

  if (/posso guardar mais dinheiro|consigo economizar mais/i.test(normalized)) {
    const metrics = await storage.getDashboardMetrics(userId, "ALL");
    if (metrics.netCashFlow <= 0) {
      return "Seu fluxo do mês está apertado. Antes de guardar mais, vale revisar categorias com saída alta e cortar gastos recorrentes pouco úteis.";
    }

    const suggested = metrics.netCashFlow * 0.2;
    return `Seu mês está positivo. Como orientação geral, você pode separar algo próximo de ${formatCurrency(suggested)} sem comprometer tanto o caixa, desde que não falte para despesas já previstas.`;
  }

  return "Posso ajudar com resumo do mês, gastos por categoria e explicações simples sobre reserva de emergência, CDB, poupança e organização financeira.";
}
