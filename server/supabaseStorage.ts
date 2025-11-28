import { 
  type User, 
  type InsertUser, 
  type Account,
  type InsertAccount,
  type Transaction,
  type InsertTransaction,
  type Rule,
  type InsertRule,
  type Investment,
  type InsertInvestment,
  type InvestmentGoal,
  type InsertInvestmentGoal,
  type InvestmentTransaction,
  type InsertInvestmentTransaction,
  type FutureExpense,
  type InsertFutureExpense,
  type FutureTransaction,
  type InsertFutureTransaction,
  type RecurringTransaction,
  type InsertRecurringTransaction,
  type UserReportPreference,
  type InsertUserReportPreference,
  PLAN_LIMITS
} from "@shared/schema";
import bcrypt from "bcrypt";
import { supabase } from "./supabase";
import type { IStorage } from "./storage";

type AccountScope = "PF" | "PJ" | "ALL";

export class SupabaseStorage implements IStorage {
  private mapFutureExpenseRow(row: any): FutureExpense {
    return {
      id: row.id,
      userId: row.user_id,
      accountType: row.account_type,
      title: row.title,
      category: row.category,
      amount: row.amount?.toString() ?? "0",
      dueDate: row.due_date ? new Date(row.due_date) : new Date(),
      isRecurring: Boolean(row.is_recurring),
      recurrenceType: row.recurrence_type,
      status: row.status,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  private mapFutureTransactionRow(row: any): FutureTransaction {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      description: row.description,
      amount: row.amount?.toString() ?? "0",
      expectedDate: row.expected_date ? new Date(row.expected_date) : new Date(),
      accountType: row.account_type ?? "PF",
      status: row.status ?? "pending",
      isScheduled: Boolean(row.is_scheduled),
      dueDate: row.due_date ? new Date(row.due_date) : row.expected_date ? new Date(row.expected_date) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  private mapRecurringTransactionRow(row: any): RecurringTransaction {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      description: row.description,
      amount: row.amount?.toString() ?? "0",
      frequency: row.frequency,
      nextDate: row.next_date ? new Date(row.next_date) : new Date(),
      accountType: row.account_type ?? "PF",
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };
  }

  private mapUserReportPreferenceRow(row: any): UserReportPreference {
    if (!row) return undefined as any;
    return {
      id: row.id,
      userId: row.user_id,
      focusEconomy: Boolean(row.focus_saving),
      focusDebt: Boolean(row.focus_debts),
      focusInvestments: Boolean(row.focus_investments),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    };
  }
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      email: data.email,
      password: data.password,
      fullName: data.full_name,
      plan: data.plan,
      trialStart: data.trial_start ? new Date(data.trial_start) : null,
      trialEnd: data.trial_end ? new Date(data.trial_end) : null,
      caktoSubscriptionId: data.cakto_subscription_id || null,
      billingStatus: data.billing_status || "pending",
      createdAt: new Date(data.created_at),
    };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .ilike("email", email)
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      email: data.email,
      password: data.password,
      fullName: data.full_name,
      plan: data.plan,
      trialStart: data.trial_start ? new Date(data.trial_start) : null,
      trialEnd: data.trial_end ? new Date(data.trial_end) : null,
      caktoSubscriptionId: data.cakto_subscription_id || null,
      billingStatus: data.billing_status || "pending",
      createdAt: new Date(data.created_at),
    };
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const existingUser = await this.getUserByEmail(insertUser.email);
    if (existingUser) {
      throw new Error("Email já cadastrado");
    }

    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    
    const { data, error } = await supabase
      .from("users")
      .insert({
        email: insertUser.email,
        password: hashedPassword,
        full_name: insertUser.fullName,
        plan: "pro",
        trial_start: null,
        trial_end: null,
        cakto_subscription_id: null,
        billing_status: "pending",
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao criar usuário");
    }

    return {
      id: data.id,
      email: data.email,
      password: data.password,
      fullName: data.full_name,
      plan: data.plan,
      trialStart: data.trial_start ? new Date(data.trial_start) : null,
      trialEnd: data.trial_end ? new Date(data.trial_end) : null,
      caktoSubscriptionId: data.cakto_subscription_id || null,
      billingStatus: data.billing_status || "pending",
      createdAt: new Date(data.created_at),
    };
  }

  async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'password' | 'createdAt'>>): Promise<User | undefined> {
    const updateData: any = {};
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.fullName !== undefined) updateData.full_name = updates.fullName;
    if (updates.plan !== undefined) updateData.plan = updates.plan;
    if (updates.trialStart !== undefined) {
      updateData.trial_start = updates.trialStart ? updates.trialStart.toISOString() : null;
    }
    if (updates.trialEnd !== undefined) {
      updateData.trial_end = updates.trialEnd ? updates.trialEnd.toISOString() : null;
    }
    if (updates.caktoSubscriptionId !== undefined) {
      updateData.cakto_subscription_id = updates.caktoSubscriptionId || null;
    }
    if (updates.billingStatus !== undefined) {
      updateData.billing_status = updates.billingStatus;
    }

    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      email: data.email,
      password: data.password,
      fullName: data.full_name,
      plan: data.plan,
      trialStart: data.trial_start ? new Date(data.trial_start) : null,
      trialEnd: data.trial_end ? new Date(data.trial_end) : null,
      caktoSubscriptionId: data.cakto_subscription_id || null,
      billingStatus: data.billing_status || "pending",
      createdAt: new Date(data.created_at),
    };
  }

  async verifyPassword(email: string, password: string): Promise<User | undefined> {
    const user = await this.getUserByEmail(email);
    if (!user) return undefined;

    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : undefined;
  }

  // Account operations
  async getAccount(id: string): Promise<Account | undefined> {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      type: data.type,
      businessCategory: data.business_category,
      initialBalance: parseFloat(data.initial_balance).toFixed(2),
      createdAt: new Date(data.created_at),
    };
  }

  async getAccountsByUserId(userId: string): Promise<Account[]> {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type,
      businessCategory: row.business_category,
      initialBalance: parseFloat(row.initial_balance).toFixed(2),
      createdAt: new Date(row.created_at),
    }));
  }

  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    const user = await this.getUser(insertAccount.userId);
    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    const userAccounts = await this.getAccountsByUserId(insertAccount.userId);
    const planLimit = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS].accounts;
    
    if (userAccounts.length >= planLimit) {
      throw new Error(`Limite de ${planLimit} conta(s) atingido para o plano ${user.plan}`);
    }

    const { data, error } = await supabase
      .from("accounts")
      .insert({
        user_id: insertAccount.userId,
        name: insertAccount.name,
        type: insertAccount.type,
        business_category: insertAccount.businessCategory ?? null,
        initial_balance: insertAccount.initialBalance,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao criar conta");
    }

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      type: data.type,
      businessCategory: data.business_category,
      initialBalance: parseFloat(data.initial_balance).toFixed(2),
      createdAt: new Date(data.created_at),
    };
  }

  async updateAccount(id: string, updates: { name?: string; type?: string; businessCategory?: string | null }): Promise<Account | undefined> {
    const updateData: Record<string, any> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.businessCategory !== undefined) {
      updateData.business_category = updates.businessCategory;
    }

    const { data, error } = await supabase
      .from("accounts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      type: data.type,
      businessCategory: data.business_category,
      initialBalance: parseFloat(data.initial_balance).toFixed(2),
      createdAt: new Date(data.created_at),
    };
  }

  async deleteAccount(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", id);

    return !error;
  }

  // Transaction operations
  async getTransaction(id: string): Promise<Transaction | undefined> {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      userId: data.user_id,
      accountId: data.account_id,
      description: data.description,
      type: data.type,
      amount: parseFloat(data.amount).toFixed(2),
      category: data.category,
      date: new Date(data.date),
      accountType: data.account_type ?? "PF",
      autoRuleApplied: data.auto_rule_applied,
      createdAt: new Date(data.created_at),
    };
  }

  async getTransactionsByUserId(userId: string, scope: AccountScope = "ALL"): Promise<Transaction[]> {
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (scope !== "ALL") {
      query = query.eq("account_type", scope);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id,
      description: row.description,
      type: row.type,
      amount: parseFloat(row.amount).toFixed(2),
      category: row.category,
      date: new Date(row.date),
      accountType: row.account_type ?? "PF",
      autoRuleApplied: row.auto_rule_applied,
      source: row.source ?? "manual",
      createdAt: new Date(row.created_at),
    }));
  }

  async getTransactionsByAccountId(accountId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("account_id", accountId)
      .order("date", { ascending: false });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      userId: row.user_id,
      accountId: row.account_id,
      description: row.description,
      type: row.type,
      amount: parseFloat(row.amount).toFixed(2),
      category: row.category,
      date: new Date(row.date),
      accountType: row.account_type ?? "PF",
      autoRuleApplied: row.auto_rule_applied,
      source: row.source ?? "manual",
      createdAt: new Date(row.created_at),
    }));
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const account = await this.getAccount(insertTransaction.accountId);
    if (!account) {
      throw new Error("Conta não encontrada");
    }

    const userRules = await this.getRulesByUserId(insertTransaction.userId);
    let autoRuleApplied = false;
    let finalCategory = insertTransaction.category;

    for (const rule of userRules) {
      if (rule.isActive && insertTransaction.description.toLowerCase().includes(rule.contains.toLowerCase())) {
        finalCategory = rule.categoryResult;
        autoRuleApplied = true;
        break;
      }
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: insertTransaction.userId,
        account_id: insertTransaction.accountId,
        description: insertTransaction.description,
        type: insertTransaction.type,
        amount: insertTransaction.amount,
        category: finalCategory,
        date: insertTransaction.date.toISOString(),
        account_type: insertTransaction.accountType ?? "PF",
        auto_rule_applied: autoRuleApplied,
        source: insertTransaction.source ?? "manual",
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao criar transação");
    }

    return {
      id: data.id,
      userId: data.user_id,
      accountId: data.account_id,
      description: data.description,
      type: data.type,
      amount: parseFloat(data.amount).toFixed(2),
      category: data.category,
      date: new Date(data.date),
      accountType: data.account_type ?? "PF",
      autoRuleApplied: data.auto_rule_applied,
      source: data.source ?? "manual",
      createdAt: new Date(data.created_at),
    };
  }

  async updateTransaction(id: string, updates: { description?: string; type?: string; amount?: number; category?: string; date?: Date; accountType?: "PF" | "PJ"; source?: "manual" | "ai" }): Promise<Transaction | undefined> {
    const updateData: any = {};
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.date !== undefined) updateData.date = updates.date.toISOString();
    if (updates.accountType !== undefined) {
      updateData.account_type = updates.accountType;
    }
    if (updates.source !== undefined) {
      updateData.source = updates.source;
    }

    const { data, error } = await supabase
      .from("transactions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      userId: data.user_id,
      accountId: data.account_id,
      description: data.description,
      type: data.type,
      amount: parseFloat(data.amount).toFixed(2),
      category: data.category,
      date: new Date(data.date),
      autoRuleApplied: data.auto_rule_applied,
      accountType: data.account_type ?? "PF",
      source: data.source ?? "manual",
      createdAt: new Date(data.created_at),
    };
  }

  async deleteTransaction(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);

    return !error;
  }

  // Rule operations
  async getRule(id: string): Promise<Rule | undefined> {
    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      userId: data.user_id,
      ruleName: data.rule_name,
      contains: data.contains,
      categoryResult: data.category_result,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
    };
  }

  async getRulesByUserId(userId: string): Promise<Rule[]> {
    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id,
      userId: row.user_id,
      ruleName: row.rule_name,
      contains: row.contains,
      categoryResult: row.category_result,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
    }));
  }

  async createRule(insertRule: InsertRule): Promise<Rule> {
    const { data, error } = await supabase
      .from("rules")
      .insert({
        user_id: insertRule.userId,
        rule_name: insertRule.ruleName,
        contains: insertRule.contains,
        category_result: insertRule.categoryResult,
        is_active: true,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao criar regra");
    }

    return {
      id: data.id,
      userId: data.user_id,
      ruleName: data.rule_name,
      contains: data.contains,
      categoryResult: data.category_result,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
    };
  }

  async updateRule(id: string, updates: { ruleName?: string; contains?: string; categoryResult?: string; isActive?: boolean }): Promise<Rule | undefined> {
    const updateData: any = {};
    if (updates.ruleName !== undefined) updateData.rule_name = updates.ruleName;
    if (updates.contains !== undefined) updateData.contains = updates.contains;
    if (updates.categoryResult !== undefined) updateData.category_result = updates.categoryResult;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await supabase
      .from("rules")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      userId: data.user_id,
      ruleName: data.rule_name,
      contains: data.contains,
      categoryResult: data.category_result,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
    };
  }

  async deleteRule(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("rules")
      .delete()
      .eq("id", id);

    return !error;
  }

  // Aggregations
  async getDashboardMetrics(userId: string, scope: AccountScope = "ALL"): Promise<{
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    netCashFlow: number;
  }> {
    const transactions = await this.getTransactionsByUserId(userId, scope);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyTransactions = transactions.filter(
      (t) => new Date(t.date) >= monthStart
    );

    const monthlyIncome = monthlyTransactions
      .filter((t) => t.type === "entrada")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const monthlyExpenses = monthlyTransactions
      .filter((t) => t.type === "saida")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalBalance = transactions.reduce((acc, tx) => {
      const amount = parseFloat(tx.amount);
      return acc + (tx.type === "entrada" ? amount : -amount);
    }, 0);

    return {
      totalBalance: Number(totalBalance.toFixed(2)),
      monthlyIncome: Number(monthlyIncome.toFixed(2)),
      monthlyExpenses: Number(monthlyExpenses.toFixed(2)),
      netCashFlow: Number((monthlyIncome - monthlyExpenses).toFixed(2)),
    };
  }

  async getCategoryBreakdown(userId: string, scope: AccountScope = "ALL"): Promise<{ category: string; amount: number }[]> {
    const transactions = await this.getTransactionsByUserId(userId, scope);
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyExpenses = transactions.filter(
      (t) => t.type === "saida" && new Date(t.date) >= monthStart
    );

    const categoryMap = new Map<string, number>();
    monthlyExpenses.forEach((t) => {
      const current = categoryMap.get(t.category) || 0;
      categoryMap.set(t.category, current + parseFloat(t.amount));
    });

    return Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  // Investment operations
  async getInvestment(id: string): Promise<Investment | undefined> {
    const { data, error } = await supabase
      .from("investments")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      type: data.type,
      currentAmount: data.current_amount,
      createdAt: new Date(data.created_at),
    };
  }

  async getInvestmentsByUserId(userId: string): Promise<Investment[]> {
    const { data, error } = await supabase
      .from("investments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];

    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type,
      currentAmount: row.current_amount,
      createdAt: new Date(row.created_at),
    }));
  }

  async createInvestment(investment: InsertInvestment & { userId: string }): Promise<Investment> {
    const { data, error } = await supabase
      .from("investments")
      .insert({
        user_id: investment.userId,
        name: investment.name,
        type: investment.type,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao criar investimento");
    }

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      type: data.type,
      currentAmount: data.current_amount || "0",
      createdAt: new Date(data.created_at),
    };
  }

  async updateInvestment(id: string, updates: { name?: string }): Promise<Investment | undefined> {
    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;

    const { data, error } = await supabase
      .from("investments")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      type: data.type,
      currentAmount: data.current_amount,
      createdAt: new Date(data.created_at),
    };
  }

  async deleteInvestment(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("investments")
      .delete()
      .eq("id", id);

    return !error;
  }

  // Investment goal operations
  async getInvestmentGoal(investmentId: string): Promise<InvestmentGoal | undefined> {
    const { data, error } = await supabase
      .from("investment_goals")
      .select("*")
      .eq("investment_id", investmentId)
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      userId: data.user_id,
      investmentId: data.investment_id,
      targetAmount: data.target_amount,
      targetDate: data.target_date ? new Date(data.target_date) : null,
      createdAt: new Date(data.created_at),
    };
  }

  async createOrUpdateInvestmentGoal(goal: InsertInvestmentGoal): Promise<InvestmentGoal> {
    console.log("[GOAL RECEBIDO]", goal);
    const existing = await this.getInvestmentGoal(goal.investmentId);

    if (existing) {
      const updateData: any = {
        target_amount: goal.targetAmount.toString(),
      };
      if (goal.targetDate) {
        updateData.target_date = goal.targetDate.toISOString();
      }

      const { data, error } = await supabase
        .from("investment_goals")
        .update(updateData)
        .eq("investment_id", goal.investmentId)
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Erro ao atualizar meta");
      }

      return {
        id: data.id,
        userId: data.user_id,
        investmentId: data.investment_id,
        targetAmount: data.target_amount,
        targetDate: data.target_date ? new Date(data.target_date) : null,
        createdAt: new Date(data.created_at),
      };
    }

    const { data, error } = await supabase
      .from("investment_goals")
      .insert({
        user_id: goal.userId,
        investment_id: goal.investmentId,
        target_amount: goal.targetAmount.toString(),
        target_date: goal.targetDate ? goal.targetDate.toISOString() : null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao criar meta");
    }

    return {
      id: data.id,
      userId: data.user_id,
      investmentId: data.investment_id,
      targetAmount: data.target_amount,
      targetDate: data.target_date ? new Date(data.target_date) : null,
      createdAt: new Date(data.created_at),
    };
  }

  async deleteInvestmentGoal(investmentId: string): Promise<boolean> {
    const { error } = await supabase
      .from("investment_goals")
      .delete()
      .eq("investment_id", investmentId);

    return !error;
  }

  // Investment transaction operations
  async getInvestmentTransactionsByUserId(userId: string): Promise<InvestmentTransaction[]> {
    const { data, error } = await supabase
      .from("investment_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (error || !data) return [];

    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      investmentId: row.investment_id,
      sourceAccountId: row.source_account_id,
      amount: row.amount,
      type: row.type,
      date: new Date(row.date),
      note: row.note,
      createdAt: new Date(row.created_at),
    }));
  }

  async getInvestmentTransactionsByInvestmentId(investmentId: string): Promise<InvestmentTransaction[]> {
    const { data, error } = await supabase
      .from("investment_transactions")
      .select("*")
      .eq("investment_id", investmentId)
      .order("date", { ascending: false });

    if (error || !data) return [];

    return data.map(row => ({
      id: row.id,
      userId: row.user_id,
      investmentId: row.investment_id,
      sourceAccountId: row.source_account_id,
      amount: row.amount,
      type: row.type,
      date: new Date(row.date),
      note: row.note,
      createdAt: new Date(row.created_at),
    }));
  }

  async createInvestmentTransaction(transaction: InsertInvestmentTransaction): Promise<InvestmentTransaction> {
    // Use atomic stored procedure to ensure all operations succeed or fail together
    // This prevents partial writes (transaction without balance update, etc.)
    const { data, error } = await supabase.rpc('create_investment_transaction', {
      p_user_id: transaction.userId,
      p_investment_id: transaction.investmentId,
      p_source_account_id: transaction.sourceAccountId,
      p_amount: transaction.amount,
      p_type: transaction.type,
      p_date: transaction.date.toISOString(),
      p_note: transaction.note || null,
    });

    if (error) {
      throw new Error(error.message || "Erro ao criar transação de investimento");
    }

    // Parse JSON response from stored procedure
    const result = typeof data === 'string' ? JSON.parse(data) : data;

    return {
      id: result.id,
      userId: result.userId,
      investmentId: result.investmentId,
      sourceAccountId: result.sourceAccountId,
      amount: result.amount,
      type: result.type,
      date: new Date(result.date),
      note: result.note,
      createdAt: new Date(result.createdAt),
    };
  }

  // Investment summary aggregation
  async getInvestmentsSummary(userId: string): Promise<{
    totalInvested: number;
    byType: { type: string; amount: number; goal?: number }[];
  }> {
    const investments = await this.getInvestmentsByUserId(userId);
    
    let totalInvested = 0;
    const byType: { type: string; amount: number; goal?: number }[] = [];

    for (const investment of investments) {
      const amount = parseFloat(investment.currentAmount || "0") || 0;
      totalInvested += amount;

      const goal = await this.getInvestmentGoal(investment.id);
      
      byType.push({
        type: investment.type,
        amount,
        goal: goal ? (parseFloat(goal.targetAmount) || 0) : undefined,
      });
    }

    return {
      totalInvested: Number(totalInvested.toFixed(2)),
      byType,
    };
  }

  // Income vs Expenses aggregation
  async getIncomeExpensesData(userId: string, scope: AccountScope = "ALL"): Promise<{
    income: number;
    expenses: number;
  }> {
    const transactions = await this.getTransactionsByUserId(userId, scope);
    
    let income = 0;
    let expenses = 0;

    for (const tx of transactions) {
      const amount = parseFloat(tx.amount) || 0;
      if (tx.type === 'entrada') {
        income += amount;
      } else if (tx.type === 'saida') {
        expenses += amount;
      }
    }

    return {
      income: Number(income.toFixed(2)),
      expenses: Number(expenses.toFixed(2)),
    };
  }

  async getFutureExpenses(userId: string, scope: AccountScope = "ALL", status?: "pending" | "paid" | "overdue"): Promise<FutureExpense[]> {
    let query = supabase
      .from("future_expenses")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true });

    if (scope && scope !== "ALL") {
      query = query.eq("account_type", scope);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row) => this.mapFutureExpenseRow(row));
  }

  async createFutureExpense(expense: InsertFutureExpense): Promise<FutureExpense> {
    const { data, error } = await supabase
      .from("future_expenses")
      .insert({
        user_id: expense.userId,
        account_type: expense.accountType,
        title: expense.title,
        category: expense.category,
        amount: expense.amount,
        due_date: expense.dueDate.toISOString(),
        is_recurring: expense.isRecurring ?? false,
        recurrence_type: expense.recurrenceType ?? null,
        status: expense.status || "pending",
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao cadastrar conta a pagar");
    }

    return this.mapFutureExpenseRow(data);
  }

  async updateFutureExpenseStatus(id: string, userId: string, status: "pending" | "paid" | "overdue") {
    const { data, error } = await supabase
      .from("future_expenses")
      .update({ status })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) return undefined;
    return this.mapFutureExpenseRow(data);
  }

  async getFutureTransactions(userId: string, scope: AccountScope = "ALL", status?: "pending" | "paid" | "received"): Promise<FutureTransaction[]> {
    let query = supabase
      .from("future_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("expected_date", { ascending: true });

    if (scope && scope !== "ALL") {
      query = query.eq("account_type", scope);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row) => this.mapFutureTransactionRow(row));
  }

  async createFutureTransaction(tx: InsertFutureTransaction): Promise<FutureTransaction> {
    const { data, error } = await supabase
      .from("future_transactions")
      .insert({
        user_id: tx.userId,
        type: tx.type,
        description: tx.description,
        amount: tx.amount,
        expected_date: tx.expectedDate.toISOString(),
        account_type: tx.accountType ?? "PF",
        status: tx.status || "pending",
        is_scheduled: Boolean(tx.isScheduled),
        due_date: (tx.dueDate ?? tx.expectedDate).toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao cadastrar valor previsto");
    }

    return this.mapFutureTransactionRow(data);
  }

  async getRecurringTransactions(userId: string, scope: AccountScope = "ALL"): Promise<RecurringTransaction[]> {
    let query = supabase
      .from("recurring_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("next_date", { ascending: true });

    if (scope && scope !== "ALL") {
      query = query.eq("account_type", scope);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row) => this.mapRecurringTransactionRow(row));
  }

  async createRecurringTransaction(tx: InsertRecurringTransaction): Promise<RecurringTransaction> {
    const { data, error } = await supabase
      .from("recurring_transactions")
      .insert({
        user_id: tx.userId,
        type: tx.type,
        description: tx.description,
        amount: tx.amount,
        frequency: tx.frequency,
        next_date: tx.nextDate.toISOString(),
        account_type: tx.accountType ?? "PF",
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao cadastrar recorrência");
    }

    return this.mapRecurringTransactionRow(data);
  }

  async getUserReportPreferences(userId: string): Promise<UserReportPreference | undefined> {
    const { data, error } = await supabase
      .from("user_report_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) return undefined;
    return this.mapUserReportPreferenceRow(data);
  }

  async upsertUserReportPreferences(userId: string, settings: InsertUserReportPreference): Promise<UserReportPreference> {
    const payload = {
      focus_saving: settings.focusEconomy ?? false,
      focus_debts: settings.focusDebt ?? false,
      focus_investments: settings.focusInvestments ?? false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("user_report_preferences")
      .upsert(
        {
          id: settings.id,
          user_id: userId,
          ...payload,
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Erro ao salvar preferências de relatório");
    }

    return this.mapUserReportPreferenceRow(data);
  }
}
