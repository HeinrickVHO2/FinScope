import type { User } from "@shared/schema";
import { storage } from "../server/storage";
import { supabase } from "../server/supabase";
import { inferExpenseCategory } from "../server/modules/shared/expenseClassifier";
import { resolveAccountForScope, type AccountScope } from "../server/modules/shared/financialMessagePolicy";
import type { FinancialContext } from "./buildFinancialContext";

type AccountKind = AccountScope;

export interface AgentAction {
  type: "transaction" | "future_bill" | "goal";
  data: Record<string, any>;
}

export interface AgentActionResult {
  success: boolean;
  action: "created" | "updated" | "skipped";
  type: AgentAction["type"];
  entityId: string | null;
  entityName: string;
  message: string;
  data: any;
}

export async function executeAgentActions(
  user: User,
  actions: AgentAction[],
  context: FinancialContext,
): Promise<AgentActionResult[]> {
  const results: AgentActionResult[] = [];

  for (const action of actions) {
    try {
      if (action.type === "transaction") {
        results.push(await handleTransactionAction(user, action.data, context));
        continue;
      }

      if (action.type === "future_bill") {
        results.push(await handleFutureBillAction(user, action.data, context));
        continue;
      }

      if (action.type === "goal") {
        results.push(await handleGoalAction(user, action.data, context));
      }
    } catch (error) {
      results.push({
        success: false,
        action: "skipped",
        type: action.type,
        entityId: null,
        entityName: action.data?.description || action.data?.title || "desconhecido",
        message: (error as Error).message || "Nao foi possivel executar esta acao.",
        data: null,
      });
    }
  }

  return results;
}

async function handleTransactionAction(user: User, payload: any, context: FinancialContext): Promise<AgentActionResult> {
  const amount = toNumber(payload.amount);
  if (amount <= 0) {
    throw new Error("Precisamos de um valor positivo para registrar a transacao.");
  }

  const accountType = normalizeAccountType(payload.account_type, user.plan);
  const targetAccount = await resolveTargetAccount(user.id, accountType);
  const description = (payload.description || payload.title || "Transacao FinScope").trim();
  const normalizedDesc = normalizeText(description);
  const txType = String(payload.type || "").toLowerCase() === "income" ? "entrada" : "saida";
  const shouldUpdateExisting = payload.updateExisting === true || payload.update_existing === true;
  const existing = context.lastTransactions.find((tx) => {
    const sameType = String(tx.type).toLowerCase() === txType;
    const sameAccount = (tx.account_type || "PF").toUpperCase() === accountType;
    const sameDescription = normalizeText(tx.description) === normalizedDesc;
    return sameType && sameAccount && sameDescription;
  });

  const date = parseDate(payload.date);
  const category = payload.category || guessCategory(description, txType);

  if (existing && shouldUpdateExisting) {
    const newAmount = Number(txAmount(existing)) + amount;
    const updated = await storage.updateTransaction(existing.id, {
      amount: Number(newAmount.toFixed(2)),
      date,
      description,
      category,
    });
    await adjustAccountBalance(targetAccount.id, txType === "entrada" ? amount : -amount);
    return {
      success: true,
      action: "updated",
      type: "transaction",
      entityId: existing.id,
      entityName: description,
      message: `Atualizei ${description} para R$ ${newAmount.toFixed(2)}.`,
      data: updated,
    };
  }

  const created = await storage.createTransaction({
    userId: user.id,
    accountId: targetAccount.id,
    description,
    type: txType,
    amount,
    category,
    date,
    accountType,
    source: "ai",
  });
  await adjustAccountBalance(targetAccount.id, txType === "entrada" ? amount : -amount);

  return {
    success: true,
    action: "created",
    type: "transaction",
    entityId: created.id,
    entityName: description,
    message: `Registrei ${description} em ${date.toLocaleDateString("pt-BR")}.`,
    data: created,
  };
}

async function handleFutureBillAction(user: User, payload: any, context: FinancialContext): Promise<AgentActionResult> {
  const amount = toNumber(payload.amount);
  if (amount <= 0) {
    throw new Error("Precisamos de valor positivo para agendar a conta.");
  }

  const accountType = normalizeAccountType(payload.account_type, user.plan);
  await resolveTargetAccount(user.id, accountType);
  const description = (payload.description || payload.title || "Conta futura").trim();
  const normalizedDesc = normalizeText(description);
  const dueDate = parseDate(payload.dueDate || payload.date);

  const existingFuture = context.futureTransactions.find((ft) => {
    const sameDesc = normalizeText(ft.description || "") === normalizedDesc;
    const sameAccount = (ft.account_type || "PF").toUpperCase() === accountType;
    return sameDesc && sameAccount;
  });

  const futurePayload = {
    user_id: user.id,
    type: String(payload.type || "expense").toLowerCase() === "income" ? "income" : "expense",
    description,
    amount: String(amount),
    expected_date: dueDate.toISOString(),
    account_type: accountType,
    status: "pending",
    is_scheduled: true,
    due_date: dueDate.toISOString(),
  };

  if (existingFuture) {
    const { data: updated, error } = await supabase
      .from("future_transactions")
      .update({
        amount: String(amount),
        expected_date: futurePayload.expected_date,
        due_date: futurePayload.due_date,
      })
      .eq("id", existingFuture.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || "Nao consegui atualizar esta conta futura.");
    }

    await upsertFutureExpense(user.id, description, amount, dueDate, accountType, payload.category);

    return {
      success: true,
      action: "updated",
      type: "future_bill",
      entityId: existingFuture.id,
      entityName: description,
      message: `Atualizei ${description} para ${dueDate.toLocaleDateString("pt-BR")} - R$ ${amount.toFixed(2)}.`,
      data: updated,
    };
  }

  const { data: newFuture, error } = await supabase.from("future_transactions").insert(futurePayload).select().single();
  if (error) {
    throw new Error(error.message || "Falha ao criar a conta futura.");
  }

  await upsertFutureExpense(user.id, description, amount, dueDate, accountType, payload.category);

  return {
    success: true,
    action: "created",
    type: "future_bill",
    entityId: newFuture.id,
    entityName: description,
    message: `Agendei ${description} para ${dueDate.toLocaleDateString("pt-BR")}.`,
    data: newFuture,
  };
}

async function handleGoalAction(user: User, payload: any, context: FinancialContext): Promise<AgentActionResult> {
  const title = (payload.title || payload.description || "Meta financeira").trim();
  const deposit = toNumber(payload.deposit_amount ?? payload.current_value ?? 0);
  const target = toNumber(payload.target_value ?? payload.targetAmount ?? deposit);
  const investmentType = (payload.investment_type || guessInvestmentType(title)).toLowerCase();
  const deadline = payload.dueDate || payload.deadline;
  const targetAmount = target > 0 ? target : deposit > 0 ? deposit : 0;

  if (targetAmount <= 0) {
    throw new Error("Preciso saber o quanto voce pretende juntar para criar essa meta.");
  }

  let investment = findSimilarInvestment(context.activeInvestments, title, investmentType);
  if (!investment) {
    const { data, error } = await supabase
      .from("investments")
      .insert({
        user_id: user.id,
        name: title,
        type: investmentType,
        current_amount: String(Math.max(deposit, 0)),
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message || "Nao consegui criar o investimento.");
    }
    investment = data;
  } else if (deposit > 0) {
    const newAmount = Number(investment.current_amount || 0) + deposit;
    const { data, error } = await supabase
      .from("investments")
      .update({ current_amount: String(newAmount) })
      .eq("id", investment.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || "Nao consegui atualizar o investimento.");
    }
    investment = data;
  }

  const goalPayload = {
    userId: user.id,
    investmentId: investment.id,
    targetAmount,
    targetDate: deadline ? parseDate(deadline) : undefined,
  };
  const goal = await storage.createOrUpdateInvestmentGoal(goalPayload);

  return {
    success: true,
    action: "created",
    type: "goal",
    entityId: goal.id,
    entityName: title,
    message:
      deposit > 0
        ? `Meta "${title}" atualizada com aporte de R$ ${deposit.toFixed(2)} (meta: R$ ${goal.targetAmount}).`
        : `Meta "${title}" criada com objetivo de R$ ${goal.targetAmount}.`,
    data: goal,
  };
}

async function resolveTargetAccount(userId: string, accountType: AccountKind) {
  const accounts = await ensureAccounts(userId);
  const resolution = resolveAccountForScope(accounts, accountType, accountType === "PJ");
  if (!resolution.ok) {
    throw new Error(resolution.message);
  }
  return resolution.account;
}

async function ensureAccounts(userId: string) {
  const accounts = await storage.getAccountsByUserId(userId);
  const hasPF = accounts.some((acc) => acc.type?.toLowerCase() === "pf");

  if (!hasPF) {
    await storage.createAccount({ userId, name: "Conta pessoal", type: "pf", initialBalance: 0 });
  }

  return storage.getAccountsByUserId(userId);
}

async function upsertFutureExpense(
  userId: string,
  title: string,
  amount: number,
  dueDate: Date,
  accountType: AccountKind,
  category?: string,
) {
  const normalizedTitle = normalizeText(title);
  const inferredCategory = category || inferExpenseCategory(title) || "Outros";
  const { data: existing } = await supabase
    .from("future_expenses")
    .select("*")
    .eq("user_id", userId)
    .eq("account_type", accountType)
    .eq("status", "pending");

  const match = (existing || []).find((exp: any) => normalizeText(exp.title) === normalizedTitle);

  if (match) {
    await supabase
      .from("future_expenses")
      .update({
        amount: String(amount),
        due_date: dueDate.toISOString(),
        category: category || match.category || inferredCategory,
      })
      .eq("id", match.id);
    return;
  }

  await supabase.from("future_expenses").insert({
    user_id: userId,
    title,
    amount: String(amount),
    due_date: dueDate.toISOString(),
    account_type: accountType,
    category: inferredCategory,
    status: "pending",
  });
}

function findSimilarInvestment(investments: any[], title: string, type: string) {
  const normalized = normalizeText(title);
  return (investments || []).find((investment) => {
    const sameType = (investment.type || "").toLowerCase() === type.toLowerCase();
    const sameName = normalizeText(investment.name || "") === normalized;
    return sameType || sameName;
  });
}

function normalizeAccountType(value: any, plan: string): AccountKind {
  const requested = String(value || "PF").toUpperCase() === "PJ" ? "PJ" : "PF";
  if (requested === "PJ" && plan !== "premium") {
    return "PF";
  }
  return requested;
}

function parseDate(value?: string): Date {
  if (!value) {
    return new Date();
  }

  const calendarMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (calendarMatch) {
    return new Date(
      Date.UTC(
        Number(calendarMatch[1]),
        Number(calendarMatch[2]) - 1,
        Number(calendarMatch[3]),
        12,
        0,
        0,
        0,
      ),
    );
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function txAmount(tx: any): number {
  if (typeof tx.amount === "number") return tx.amount;
  return Number(tx.amount || 0);
}

function toNumber(value: any): number {
  const numeric = Number(String(value).replace(/[^\d.-]/g, ""));
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return Number(numeric.toFixed(2));
}

function guessCategory(description: string, txType: string): string {
  const lower = description.toLowerCase();
  if (txType !== "entrada") {
    return inferExpenseCategory(description) || "Outros";
  }
  if (txType === "entrada") {
    if (lower.includes("sal") || lower.includes("folha")) return "Salario";
    if (lower.includes("pix") || lower.includes("transfer")) return "Transferencias";
    return "Renda extra";
  }

  if (lower.includes("mercado") || lower.includes("ifood") || lower.includes("super")) return "Alimentacao";
  if (lower.includes("luz") || lower.includes("energia") || lower.includes("agua")) return "Luz / Agua";
  if (lower.includes("aluguel")) return "Aluguel";
  if (lower.includes("stream") || lower.includes("netflix") || lower.includes("spotify")) return "Streaming";
  if (lower.includes("soft") || lower.includes("sas") || lower.includes("assinatura")) return "Software";
  if (lower.includes("taxa") || lower.includes("imposto") || lower.includes("dar")) return "Impostos";
  if (lower.includes("combust") || lower.includes("uber") || lower.includes("transp")) return "Transporte";
  return "Outros";
}

function guessInvestmentType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("cdb")) return "cdb";
  if (lower.includes("emerg")) return "reserva_emergencia";
  if (lower.includes("fundo") || lower.includes("acao") || lower.includes("vari")) return "renda_variavel";
  if (lower.includes("fixa") || lower.includes("tesouro") || lower.includes("selic")) return "renda_fixa";
  return "reserva_emergencia";
}

async function adjustAccountBalance(accountId: string, delta: number) {
  try {
    const { data, error } = await supabase
      .from("accounts")
      .select("initial_balance")
      .eq("id", accountId)
      .single();

    if (error || !data) {
      return;
    }

    const current = Number(data.initial_balance || 0);
    const next = Number((current + delta).toFixed(2));
    await supabase
      .from("accounts")
      .update({ initial_balance: String(next) })
      .eq("id", accountId);
  } catch (error) {
    console.warn("[AI AGENT] Falha ao ajustar saldo da conta:", error);
  }
}
