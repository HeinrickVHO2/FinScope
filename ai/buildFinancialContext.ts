import { supabase } from "../server/supabase";

export async function buildFinancialContext(
  userId: string,
  accountType: "PF" | "PJ" | "ALL" = "ALL"
) {
  // Últimas 15 transações (aumentado para melhor contexto)
  const transactionsQuery = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(15);

  if (accountType !== "ALL") {
    transactionsQuery.eq("account_type", accountType);
  }

  const { data: lastTransactions } = await transactionsQuery;

  // Contas futuras (future_transactions)
  const futureQuery = supabase
    .from("future_transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("expected_date", { ascending: true })
    .limit(10);

  if (accountType !== "ALL") {
    futureQuery.eq("account_type", accountType);
  }

  const { data: futureTransactions } = await futureQuery;

  // Metas de investimento + Investimentos atuais
  const { data: investmentGoals } = await supabase
    .from("investment_goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  // NOVO: Carregar investimentos atuais (para detectar existentes)
  const { data: activeInvestments } = await supabase
    .from("investments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  // Plano do usuário
  const { data: user } = await supabase
    .from("users")
    .select("plan, billing_status")
    .eq("id", userId)
    .single();

  // Formatar contexto como prompt para o LLM
  const asPrompt = formatContextAsPrompt({
    lastTransactions: lastTransactions ?? [],
    futureTransactions: futureTransactions ?? [],
    investmentGoals: investmentGoals ?? [],
    activeInvestments: activeInvestments ?? [],
    userPlan: user?.plan ?? "pro",
    billingStatus: user?.billing_status ?? "pending"
  });

  return {
    lastTransactions: lastTransactions ?? [],
    futureTransactions: futureTransactions ?? [],
    investmentGoals: investmentGoals ?? [],
    activeInvestments: activeInvestments ?? [],
    userPlan: user?.plan ?? "pro",
    billingStatus: user?.billing_status ?? "pending",
    asPrompt
  };
}

function formatContextAsPrompt(context: any): string {
  const parts: string[] = [];

  parts.push(`CONTEXTO FINANCEIRO DO USUÁRIO:`);
  parts.push(`Plano: ${context.userPlan.toUpperCase()}`);
  parts.push(`Status de Cobrança: ${context.billingStatus}`);
  parts.push("");

  if (context.lastTransactions.length > 0) {
    parts.push(`Últimas ${context.lastTransactions.length} transações:`);
    context.lastTransactions.forEach((t: any, i: number) => {
      const amount = Number(t.amount || 0).toFixed(2);
      const date = new Date(t.date).toLocaleDateString('pt-BR');
      parts.push(`${i + 1}. ${t.description} - R$ ${amount} (${t.type}) - ${date} - Categoria: ${t.category}`);
    });
    parts.push("");
  }

  if (context.futureTransactions.length > 0) {
    parts.push(`Contas futuras pendentes (${context.futureTransactions.length}):`);
    context.futureTransactions.forEach((ft: any, i: number) => {
      const amount = Number(ft.amount || 0).toFixed(2);
      const date = new Date(ft.expected_date).toLocaleDateString('pt-BR');
      parts.push(`${i + 1}. ${ft.description} - R$ ${amount} - Previsto para: ${date}`);
    });
    parts.push("");
  }

  if (context.investmentGoals.length > 0) {
    parts.push(`Metas de investimento (${context.investmentGoals.length}):`);
    context.investmentGoals.forEach((g: any, i: number) => {
      const target = Number(g.target_value || 0).toFixed(2);
      parts.push(`${i + 1}. ${g.title} - Meta: R$ ${target}`);
    });
    parts.push("");
  }

  if (context.activeInvestments.length > 0) {
    parts.push(`INVESTIMENTOS ATIVOS (${context.activeInvestments.length}):`);
    context.activeInvestments.forEach((inv: any, i: number) => {
      const current = Number(inv.current_amount || 0).toFixed(2);
      const type = inv.type || "renda_fixa";
      parts.push(`${i + 1}. ${inv.name} (${type}) - Saldo atual: R$ ${current}`);
    });
    parts.push("");
    parts.push("🎯 ATENÇÃO: Se o usuário disser 'adicionar X a um investimento', verifique se já existe um investimento com nome similar. Se existir, ATUALIZE o saldo em vez de criar novo!");
    parts.push("");
  }

  parts.push("Use este contexto para dar respostas personalizadas e relevantes. NÃO mencione explicitamente que você tem acesso a esse contexto.");

  return parts.join("\n");
}
