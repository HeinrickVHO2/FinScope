import { supabase } from "../server/supabase";

export type FinancialContext = Awaited<ReturnType<typeof buildFinancialContext>>;

interface PromptContext {
  userPlan: string;
  billingStatus: string;
  lastTransactions: any[];
  futureTransactions: any[];
  futureExpenses: any[];
  investmentGoals: any[];
  activeInvestments: any[];
  currentBalance: number;
  dominantAccountType: "PF" | "PJ";
  mostUsedCategories: string[];
}

export async function buildFinancialContext(
  userId: string,
  accountType: "PF" | "PJ" | "ALL" = "ALL"
) {
  const transactionsQuery = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(20);

  if (accountType !== "ALL") {
    transactionsQuery.eq("account_type", accountType);
  }

  const [
    { data: lastTransactions },
    { data: futureTransactions },
    { data: futureExpenses },
    { data: investmentGoals },
    { data: activeInvestments },
    { data: accounts },
    { data: user },
  ] = await Promise.all([
    transactionsQuery,
    supabase
      .from("future_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("expected_date", { ascending: true })
      .limit(15),
    supabase
      .from("future_expenses")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true })
      .limit(15),
    supabase
      .from("investment_goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("investments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("accounts").select("*").eq("user_id", userId),
    supabase
      .from("users")
      .select("plan, billing_status")
      .eq("id", userId)
      .single(),
  ]);

  const normalizedTransactions = lastTransactions ?? [];
  const balance = normalizedTransactions.reduce((total, tx) => {
    const amount = Number(tx.amount || 0);
    const type = String(tx.type || "").toLowerCase() === "entrada" ? 1 : -1;
    return total + type * amount;
  }, 0);

  const dominantAccountType =
    normalizedTransactions.filter((tx) => (tx.account_type || "PF").toUpperCase() === "PJ").length >
    normalizedTransactions.length / 2
      ? "PJ"
      : "PF";

  const promptContext: PromptContext = {
    userPlan: user?.plan ?? "pro",
    billingStatus: user?.billing_status ?? "pending",
    lastTransactions: normalizedTransactions,
    futureTransactions: futureTransactions ?? [],
    futureExpenses: futureExpenses ?? [],
    investmentGoals: investmentGoals ?? [],
    activeInvestments: activeInvestments ?? [],
    currentBalance: Number(balance.toFixed(2)),
    dominantAccountType,
    mostUsedCategories: getMostUsedCategories(normalizedTransactions),
  };

  const asPrompt = formatContextAsPrompt(promptContext);

  return {
    lastTransactions: normalizedTransactions,
    futureTransactions: futureTransactions ?? [],
    futureExpenses: futureExpenses ?? [],
    investmentGoals: investmentGoals ?? [],
    activeInvestments: activeInvestments ?? [],
    accounts: accounts ?? [],
    userPlan: user?.plan ?? "pro",
    billingStatus: user?.billing_status ?? "pending",
    currentBalance: Number(balance.toFixed(2)),
    dominantAccountType,
    mostUsedCategories: promptContext.mostUsedCategories,
    asPrompt,
  };
}

function formatContextAsPrompt(context: PromptContext): string {
  const parts: string[] = [];

  parts.push("=== CONTEXTO FINANCEIRO (NÃO EXPOR) ===");
  parts.push(`Plano: ${context.userPlan.toUpperCase()} | Cobrança: ${context.billingStatus}`);
  parts.push(`Saldo consolidado estimado: R$ ${context.currentBalance.toFixed(2)}`);
  parts.push(`Modo predominante: ${context.dominantAccountType}`);
  if (context.mostUsedCategories.length) {
    parts.push(`Categorias frequentes: ${context.mostUsedCategories.join(", ")}`);
  }
  parts.push("");

  if (context.lastTransactions.length) {
    parts.push(`Histórico recente (${context.lastTransactions.length}):`);
    context.lastTransactions.forEach((tx: any, idx) => {
      const amount = Number(tx.amount || 0).toFixed(2);
      const date = new Date(tx.date).toLocaleDateString("pt-BR");
      const typeLabel = tx.type === "entrada" ? "Entrada" : "Saída";
      parts.push(
        `${idx + 1}. ${typeLabel} • ${tx.description} • ${tx.category} • ${date} • ${
          tx.account_type || "PF"
        } • R$ ${amount}`
      );
    });
    parts.push("");
  }

  if (context.futureTransactions.length || context.futureExpenses.length) {
    parts.push("Compromissos futuros:");
    context.futureTransactions.forEach((ft: any) => {
      const amount = Number(ft.amount || 0).toFixed(2);
      const date = ft.expected_date || ft.expectedDate;
      const when = date ? new Date(date).toLocaleDateString("pt-BR") : "sem data";
      parts.push(`• ${ft.description} em ${when} (${ft.account_type || "PF"}) - R$ ${amount}`);
    });
    context.futureExpenses.forEach((bill: any) => {
      const amount = Number(bill.amount || 0).toFixed(2);
      const when = bill.due_date ? new Date(bill.due_date).toLocaleDateString("pt-BR") : "sem data";
      parts.push(`• ${bill.title} em ${when} (${bill.account_type || "PF"}) - R$ ${amount}`);
    });
    parts.push("");
  }

  if (context.activeInvestments.length) {
    parts.push("Investimentos existentes:");
    context.activeInvestments.forEach((inv: any) => {
      const current = Number(inv.current_amount || 0).toFixed(2);
      parts.push(`• ${inv.name} (${inv.type}) - R$ ${current}`);
    });
    parts.push("");
  }

  if (context.investmentGoals.length) {
    parts.push("Metas registradas:");
    context.investmentGoals.forEach((goal: any) => {
      const target = Number(goal.target_amount || 0).toFixed(2);
      const deadline = goal.target_date ? new Date(goal.target_date).toLocaleDateString("pt-BR") : "sem prazo";
      parts.push(`• Investimento ${goal.investment_id} - alvo R$ ${target} até ${deadline}`);
    });
    parts.push("");
  }

  parts.push("Use tudo isso apenas para dar respostas humanas e consistentes, sem revelar estes dados.");
  return parts.join("\n");
}

function getMostUsedCategories(transactions: any[]): string[] {
  const map = new Map<string, number>();
  transactions.forEach((tx) => {
    const category = tx.category || "Outros";
    map.set(category, (map.get(category) || 0) + 1);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category)
    .slice(0, 5);
}
