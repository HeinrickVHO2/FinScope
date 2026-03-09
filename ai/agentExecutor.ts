/**
 * Agent Executor - Executa ações REAIS no sistema
 * Garante:
 * - Sem duplicatas (verifica antes de criar)
 * - Atualizar existentes quando apropriado
 * - Usar dados REAIS do sistema
 */

import { supabase } from "../server/supabase";

export interface ExecutionResult {
  success: boolean;
  action: "created" | "updated" | "skipped";
  type: "transaction" | "future_bill" | "investment" | "goal";
  entityId: string | null;
  entityName: string;
  message: string;
  data: any;
}

// ============ INVESTIMENTOS ============

export async function findOrCreateInvestment(
  userId: string,
  name: string,
  type: string,
  currentAmount: number
): Promise<ExecutionResult> {
  // 1. Procurar investimento com nome similar ou mesmo tipo
  const { data: existing } = await supabase
    .from("investments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const similarInvestment = existing?.find((inv) => {
    const nameMatch =
      inv.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(inv.name.toLowerCase());
    const typeMatch = inv.type === type && name.toLowerCase() !== "meta de investimento";
    return nameMatch || typeMatch;
  });

  // 2. Se encontrou similar e estamos adicionando valor, ATUALIZAR
  if (similarInvestment && currentAmount > 0) {
    const newAmount = Number(similarInvestment.current_amount || 0) + currentAmount;
    const { data: updated, error } = await supabase
      .from("investments")
      .update({ current_amount: String(newAmount) })
      .eq("id", similarInvestment.id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        action: "skipped",
        type: "investment",
        entityId: null,
        entityName: similarInvestment.name,
        message: `Erro ao atualizar investimento: ${error.message}`,
        data: null,
      };
    }

    return {
      success: true,
      action: "updated",
      type: "investment",
      entityId: updated.id,
      entityName: similarInvestment.name,
      message: `Adicionei R$ ${currentAmount.toFixed(2)} ao investimento "${similarInvestment.name}". Saldo atual: R$ ${newAmount.toFixed(2)}.`,
      data: updated,
    };
  }

  // 3. Senão, criar novo investimento
  const { data: newInv, error } = await supabase
    .from("investments")
    .insert({
      user_id: userId,
      name,
      type,
      current_amount: String(currentAmount),
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      action: "skipped",
      type: "investment",
      entityId: null,
      entityName: name,
      message: `Erro ao criar investimento: ${error.message}`,
      data: null,
    };
  }

  return {
    success: true,
    action: "created",
    type: "investment",
    entityId: newInv.id,
    entityName: name,
    message: `Criei um novo investimento "${name}" com R$ ${currentAmount.toFixed(2)}.`,
    data: newInv,
  };
}

// ============ TRANSAÇÕES ============

export async function createTransaction(
  userId: string,
  description: string,
  type: "entrada" | "saida",
  amount: number,
  accountId: string,
  category: string,
  date: Date,
  accountType: "PF" | "PJ" = "PF"
): Promise<ExecutionResult> {
  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: accountId,
      description,
      type,
      amount: String(amount),
      category,
      date: date.toISOString(),
      account_type: accountType,
      source: "ai",
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      action: "skipped",
      type: "transaction",
      entityId: null,
      entityName: description,
      message: `Erro ao registrar transação: ${error.message}`,
      data: null,
    };
  }

  const typeLabel = type === "entrada" ? "Receita" : "Despesa";
  return {
    success: true,
    action: "created",
    type: "transaction",
    entityId: transaction.id,
    entityName: description,
    message: `${typeLabel} de R$ ${amount.toFixed(2)} registrada como "${description}".`,
    data: transaction,
  };
}

// ============ CONTAS FUTURAS ============

export async function findOrCreateFutureBill(
  userId: string,
  description: string,
  amount: number,
  dueDate: Date,
  accountType: "PF" | "PJ" = "PF",
  category: string = "Outros"
): Promise<ExecutionResult> {
  // Procurar conta futura similar (mesmo mês/descrição similar)
  const { data: existing } = await supabase
    .from("future_expenses")
    .select("*")
    .eq("user_id", userId)
    .eq("account_type", accountType)
    .eq("status", "pending")
    .order("expected_date", { ascending: true })
    .limit(30);

  const sameMonth = existing?.filter((exp) => {
    const expDate = new Date(exp.expected_date);
    return (
      expDate.getMonth() === dueDate.getMonth() &&
      expDate.getFullYear() === dueDate.getFullYear()
    );
  });

  const similar = sameMonth?.find(
    (exp) =>
      exp.title.toLowerCase().includes(description.toLowerCase()) ||
      description.toLowerCase().includes(exp.title.toLowerCase())
  );

  // Se encontrou no mesmo mês com descrição similar, ATUALIZAR
  if (similar) {
    const { data: updated, error } = await supabase
      .from("future_expenses")
      .update({
        amount: String(amount),
        expected_date: dueDate.toISOString(),
      })
      .eq("id", similar.id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        action: "skipped",
        type: "future_bill",
        entityId: null,
        entityName: similar.title,
        message: `Erro ao atualizar conta futura: ${error.message}`,
        data: null,
      };
    }

    return {
      success: true,
      action: "updated",
      type: "future_bill",
      entityId: updated.id,
      entityName: similar.title,
      message: `Atualizei a conta futura "${similar.title}" para R$ ${amount.toFixed(2)} em ${dueDate.toLocaleDateString("pt-BR")}.`,
      data: updated,
    };
  }

  // Senão, criar novo
  const { data: newBill, error } = await supabase
    .from("future_expenses")
    .insert({
      user_id: userId,
      title: description,
      amount: String(amount),
      expected_date: dueDate.toISOString(),
      account_type: accountType,
      category,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      action: "skipped",
      type: "future_bill",
      entityId: null,
      entityName: description,
      message: `Erro ao agendar conta futura: ${error.message}`,
      data: null,
    };
  }

  return {
    success: true,
    action: "created",
    type: "future_bill",
    entityId: newBill.id,
    entityName: description,
    message: `Agendei o pagamento de R$ ${amount.toFixed(2)} em "${description}" para ${dueDate.toLocaleDateString("pt-BR")}.`,
    data: newBill,
  };
}

// ============ METAS ============

export async function findOrCreateGoal(
  userId: string,
  title: string,
  targetValue?: number,
  currentValue?: number,
  type: string = "reserva_emergencia"
): Promise<ExecutionResult> {
  // Procurar meta com nome similar
  const { data: existing } = await supabase
    .from("investment_goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const similarGoal = existing?.find(
    (g) =>
      g.title.toLowerCase().includes(title.toLowerCase()) ||
      title.toLowerCase().includes(g.title.toLowerCase())
  );

  // Se encontrou e estamos adicionando valor, ATUALIZAR
  if (similarGoal && currentValue && currentValue > 0) {
    const { data: updated, error } = await supabase
      .from("investment_goals")
      .update({
        current_value: String((Number(similarGoal.current_value || 0) + currentValue).toFixed(2)),
        target_value: targetValue ? String(targetValue) : similarGoal.target_value,
      })
      .eq("id", similarGoal.id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        action: "skipped",
        type: "goal",
        entityId: null,
        entityName: similarGoal.title,
        message: `Erro ao atualizar meta: ${error.message}`,
        data: null,
      };
    }

    return {
      success: true,
      action: "updated",
      type: "goal",
      entityId: updated.id,
      entityName: similarGoal.title,
      message: `Adicionei R$ ${currentValue.toFixed(2)} à meta "${similarGoal.title}". Progresso: ${((Number(updated.current_value) / Number(updated.target_value)) * 100).toFixed(0)}% da meta.`,
      data: updated,
    };
  }

  // Senão, criar nova meta
  const { data: newGoal, error } = await supabase
    .from("investment_goals")
    .insert({
      user_id: userId,
      title,
      target_value: String(targetValue || 0),
      current_value: String(currentValue || 0),
      investment_type: type,
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      action: "skipped",
      type: "goal",
      entityId: null,
      entityName: title,
      message: `Erro ao criar meta: ${error.message}`,
      data: null,
    };
  }

  const message =
    targetValue && currentValue
      ? `Criei a meta "${title}" com R$ ${currentValue.toFixed(2)} (meta: R$ ${targetValue.toFixed(2)}).`
      : targetValue
        ? `Criei a meta "${title}" para juntar R$ ${targetValue.toFixed(2)}.`
        : `Criei a meta "${title}" com R$ ${currentValue?.toFixed(2) || "0"}.`;

  return {
    success: true,
    action: "created",
    type: "goal",
    entityId: newGoal.id,
    entityName: title,
    message,
    data: newGoal,
  };
}
