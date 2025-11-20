import type { Transaction } from "@shared/schema";

type TxLike = Pick<Transaction, "type" | "amount" | "category" | "date" | "createdAt"> & {
  amount?: number;
  date?: string | Date;
  createdAt?: string | Date;
  category?: string | null;
};

interface MonthlyAggregate {
  key: string;
  income: number;
  expenses: number;
  categories: Record<string, number>;
}

const MONTH_LABELS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function parseMonthKey(dateInput: string | Date | undefined): string | null {
  if (!dateInput) return null;
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildMonthlyAggregates(transactions: TxLike[]): MonthlyAggregate[] {
  const map = new Map<string, MonthlyAggregate>();

  for (const tx of transactions || []) {
    const key = parseMonthKey(tx.date ?? tx.createdAt);
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, { key, income: 0, expenses: 0, categories: {} });
    }

    const aggregate = map.get(key)!;
    const amount = Number(tx.amount) || 0;

    if (tx.type === "entrada") {
      aggregate.income += amount;
    } else if (tx.type === "saida") {
      aggregate.expenses += amount;
      const category = tx.category || "Outros";
      aggregate.categories[category] = (aggregate.categories[category] || 0) + amount;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  if (!year || !month) return monthKey;
  return `${MONTH_LABELS[month - 1] ?? month}/${year}`;
}

export function buildPremiumInsights(transactions: TxLike[]): string[] {
  const statements: string[] = [];
  const monthlyAggregates = buildMonthlyAggregates(transactions);

  if (!monthlyAggregates.length) {
    return ["Não encontramos movimentações suficientes para gerar insights neste período."];
  }

  const latest = monthlyAggregates[monthlyAggregates.length - 1];
  const previous = monthlyAggregates[monthlyAggregates.length - 2];

  if (latest) {
    const savings = latest.income - latest.expenses;
    const label = formatMonthLabel(latest.key);
    statements.push(
      `Seu saldo do mês de ${label} foi ${formatCurrency(savings)} (${formatCurrency(
        latest.income
      )} em entradas e ${formatCurrency(latest.expenses)} em saídas).`
    );

    const topCategory = Object.entries(latest.categories).sort((a, b) => b[1] - a[1])[0];
    if (topCategory) {
      statements.push(
        `Sua categoria com maior impacto foi ${topCategory[0]}, somando ${formatCurrency(topCategory[1])} no período.`
      );
    }
  }

  if (latest && previous) {
    const latestSavings = latest.income - latest.expenses;
    const prevSavings = previous.income - previous.expenses || 1;
    const variation = ((latestSavings - prevSavings) / Math.abs(prevSavings)) * 100;
    if (Number.isFinite(variation)) {
      const labelPrev = formatMonthLabel(previous.key);
      const labelCurrent = formatMonthLabel(latest.key);
      const direction = variation >= 0 ? "a mais" : "a menos";
      statements.push(
        `Você economizou ${Math.abs(variation).toFixed(1)}% ${direction} em ${labelCurrent} comparado a ${labelPrev}.`
      );
    }

    let biggestReduction: { category: string; difference: number } | null = null;
    const prevCategories = previous.categories;
    const currentCategories = latest.categories;
    const categorySet = new Set([...Object.keys(prevCategories), ...Object.keys(currentCategories)]);

    for (const category of categorySet) {
      const prevTotal = prevCategories[category] || 0;
      const currentTotal = currentCategories[category] || 0;
      const diff = prevTotal - currentTotal;
      if (diff > 0 && (!biggestReduction || diff > biggestReduction.difference)) {
        biggestReduction = { category, difference: diff };
      }
    }

    if (biggestReduction) {
      statements.push(
        `A categoria ${biggestReduction.category} teve a maior redução, diminuindo ${formatCurrency(
          biggestReduction.difference
        )} em relação ao mês anterior.`
      );
    }
  }

  return statements.slice(0, 4);
}
