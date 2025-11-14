import { 
  type User, 
  type InsertUser, 
  type Account,
  type InsertAccount,
  type Transaction,
  type InsertTransaction,
  type Rule,
  type InsertRule,
  PLAN_LIMITS
} from "@shared/schema";
import bcrypt from "bcrypt";
import { supabase } from "./supabase";
import type { IStorage } from "./storage";

export class SupabaseStorage implements IStorage {
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
      createdAt: new Date(data.created_at),
    };
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const existingUser = await this.getUserByEmail(insertUser.email);
    if (existingUser) {
      throw new Error("Email já cadastrado");
    }

    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    
    const trialStart = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 10);

    const { data, error } = await supabase
      .from("users")
      .insert({
        email: insertUser.email,
        password: hashedPassword,
        full_name: insertUser.fullName,
        plan: "free",
        trial_start: trialStart.toISOString(),
        trial_end: trialEnd.toISOString(),
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
      trialStart: new Date(data.trial_start),
      trialEnd: new Date(data.trial_end),
      createdAt: new Date(data.created_at),
    };
  }

  async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'password' | 'createdAt'>>): Promise<User | undefined> {
    const updateData: any = {};
    if (updates.email) updateData.email = updates.email;
    if (updates.fullName) updateData.full_name = updates.fullName;
    if (updates.plan) updateData.plan = updates.plan;
    if (updates.trialStart) updateData.trial_start = updates.trialStart.toISOString();
    if (updates.trialEnd) updateData.trial_end = updates.trialEnd.toISOString();

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
      initialBalance: parseFloat(data.initial_balance).toFixed(2),
      createdAt: new Date(data.created_at),
    };
  }

  async updateAccount(id: string, updates: { name?: string; type?: string }): Promise<Account | undefined> {
    const { data, error } = await supabase
      .from("accounts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      type: data.type,
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
      autoRuleApplied: data.auto_rule_applied,
      createdAt: new Date(data.created_at),
    };
  }

  async getTransactionsByUserId(userId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
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
      autoRuleApplied: row.auto_rule_applied,
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
      autoRuleApplied: row.auto_rule_applied,
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
        auto_rule_applied: autoRuleApplied,
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
      autoRuleApplied: data.auto_rule_applied,
      createdAt: new Date(data.created_at),
    };
  }

  async updateTransaction(id: string, updates: { description?: string; type?: string; amount?: number; category?: string; date?: Date }): Promise<Transaction | undefined> {
    const updateData: any = {};
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.amount !== undefined) updateData.amount = updates.amount;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.date !== undefined) updateData.date = updates.date.toISOString();

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
  async getDashboardMetrics(userId: string): Promise<{
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    netCashFlow: number;
  }> {
    const accounts = await this.getAccountsByUserId(userId);
    const transactions = await this.getTransactionsByUserId(userId);

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

    let totalBalance = 0;
    for (const account of accounts) {
      const accountTransactions = transactions.filter(t => t.accountId === account.id);
      const income = accountTransactions
        .filter(t => t.type === "entrada")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const expenses = accountTransactions
        .filter(t => t.type === "saida")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      totalBalance += parseFloat(account.initialBalance) + income - expenses;
    }

    return {
      totalBalance: Number(totalBalance.toFixed(2)),
      monthlyIncome: Number(monthlyIncome.toFixed(2)),
      monthlyExpenses: Number(monthlyExpenses.toFixed(2)),
      netCashFlow: Number((monthlyIncome - monthlyExpenses).toFixed(2)),
    };
  }

  async getCategoryBreakdown(userId: string): Promise<{ category: string; amount: number }[]> {
    const transactions = await this.getTransactionsByUserId(userId);
    
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
}
