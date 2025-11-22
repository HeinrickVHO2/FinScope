import { supabase } from "../server/supabase";
import { transactions, futureBills, goals, users } from "../shared/schema";

export async function buildFinancialContext(
  userId: string,
  accountType: "PF" | "PJ"
) {
  // Últimas transações
  const { data: lastTransactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("account_type", accountType)
    .order("date", { ascending: false })
    .limit(10);

  // Contas futuras
  const { data: future } = await supabase
    .from("future_bills")
    .select("*")
    .eq("user_id", userId)
    .eq("type", accountType);

  // Metas
  const { data: goalsData } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId);

  // Plano do usuário
  const { data: user } = await supabase
    .from("users")
    .select("plan")
    .eq("id", userId)
    .single();

  return {
    lastTransactions: lastTransactions ?? [],
    futureBills: future ?? [],
    goals: goalsData ?? [],
    plan: user?.plan ?? "free"
  };
}
