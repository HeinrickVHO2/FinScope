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

  async createInvestment(investment: InsertInvestment): Promise<Investment> {
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
      currentAmount: data.current_amount,
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
    // Create the investment transaction
    const { data: invTxData, error: invTxError } = await supabase
      .from("investment_transactions")
      .insert({
        user_id: transaction.userId,
        investment_id: transaction.investmentId,
        source_account_id: transaction.sourceAccountId,
        amount: transaction.amount.toString(),
        type: transaction.type,
        date: transaction.date.toISOString(),
        note: transaction.note || null,
      })
      .select()
      .single();

    if (invTxError || !invTxData) {
      throw new Error(invTxError?.message || "Erro ao criar transação de investimento");
    }

    // Update investment current amount
    const investment = await this.getInvestment(transaction.investmentId);
    if (investment) {
      const currentAmount = parseFloat(investment.currentAmount);
      const txAmount = transaction.amount;
      const newAmount = transaction.type === "deposit" 
        ? currentAmount + txAmount 
        : currentAmount - txAmount;

      await supabase
        .from("investments")
        .update({ current_amount: newAmount.toString() })
        .eq("id", transaction.investmentId);
    }

    // Create corresponding transaction in transactions table (money leaving account)
    if (transaction.type === "deposit") {
      const txDescription = transaction.note || `Investimento em ${investment?.name || 'investimento'}`;
      await supabase
        .from("transactions")
        .insert({
          user_id: transaction.userId,
          account_id: transaction.sourceAccountId,
          description: txDescription,
          type: "saida",
          amount: transaction.amount.toString(),
          category: "Investimentos",
          date: transaction.date.toISOString(),
        });
    }

    return {
      id: invTxData.id,
      userId: invTxData.user_id,
      investmentId: invTxData.investment_id,
      sourceAccountId: invTxData.source_account_id,
      amount: invTxData.amount,
      type: invTxData.type,
      date: new Date(invTxData.date),
      note: invTxData.note,
      createdAt: new Date(invTxData.created_at),
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
      const amount = parseFloat(investment.currentAmount);
      totalInvested += amount;

      const goal = await this.getInvestmentGoal(investment.id);
      
      byType.push({
        type: investment.type,
        amount,
        goal: goal ? parseFloat(goal.targetAmount) : undefined,
      });
    }

    return {
      totalInvested: Number(totalInvested.toFixed(2)),
      byType,
    };
  }
}
