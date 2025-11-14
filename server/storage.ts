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
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";

// Internal types with numeric amounts for calculations
type StoredAccount = Omit<Account, 'initialBalance'> & { initialBalance: number };
type StoredTransaction = Omit<Transaction, 'amount'> & { amount: number };

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<Omit<User, 'id' | 'password' | 'createdAt'>>): Promise<User | undefined>;
  verifyPassword(email: string, password: string): Promise<User | undefined>;

  // Account operations
  getAccount(id: string): Promise<Account | undefined>;
  getAccountsByUserId(userId: string): Promise<Account[]>;
  createAccount(account: InsertAccount): Promise<Account>;
  updateAccount(id: string, updates: { name?: string; type?: string }): Promise<Account | undefined>;
  deleteAccount(id: string): Promise<boolean>;

  // Transaction operations
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByUserId(userId: string): Promise<Transaction[]>;
  getTransactionsByAccountId(accountId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: { description?: string; type?: string; amount?: number; category?: string; date?: Date }): Promise<Transaction | undefined>;
  deleteTransaction(id: string): Promise<boolean>;

  // Rule operations
  getRule(id: string): Promise<Rule | undefined>;
  getRulesByUserId(userId: string): Promise<Rule[]>;
  createRule(rule: InsertRule): Promise<Rule>;
  updateRule(id: string, updates: { ruleName?: string; contains?: string; categoryResult?: string; isActive?: boolean }): Promise<Rule | undefined>;
  deleteRule(id: string): Promise<boolean>;

  // Investment operations
  getInvestment(id: string): Promise<Investment | undefined>;
  getInvestmentsByUserId(userId: string): Promise<Investment[]>;
  createInvestment(investment: InsertInvestment & { userId: string }): Promise<Investment>;
  updateInvestment(id: string, updates: { name?: string }): Promise<Investment | undefined>;
  deleteInvestment(id: string): Promise<boolean>;

  // Investment goal operations
  getInvestmentGoal(investmentId: string): Promise<InvestmentGoal | undefined>;
  createOrUpdateInvestmentGoal(goal: InsertInvestmentGoal): Promise<InvestmentGoal>;
  deleteInvestmentGoal(investmentId: string): Promise<boolean>;

  // Investment transaction operations
  getInvestmentTransactionsByUserId(userId: string): Promise<InvestmentTransaction[]>;
  getInvestmentTransactionsByInvestmentId(investmentId: string): Promise<InvestmentTransaction[]>;
  createInvestmentTransaction(transaction: InsertInvestmentTransaction): Promise<InvestmentTransaction>;

  // Aggregations
  getDashboardMetrics(userId: string): Promise<{
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    netCashFlow: number;
  }>;
  getCategoryBreakdown(userId: string): Promise<{ category: string; amount: number }[]>;
  getInvestmentsSummary(userId: string): Promise<{
    totalInvested: number;
    byType: { type: string; amount: number; goal?: number }[];
  }>;
}

// MemStorage is deprecated - use SupabaseStorage instead
export class MemStorage {
  private users: Map<string, User>;
  private accounts: Map<string, StoredAccount>;
  private transactions: Map<string, StoredTransaction>;
  private rules: Map<string, Rule>;

  constructor() {
    this.users = new Map();
    this.accounts = new Map();
    this.transactions = new Map();
    this.rules = new Map();
  }

  // Helper to convert stored account to API account (number -> string)
  private toApiAccount(account: StoredAccount): Account {
    return {
      ...account,
      initialBalance: account.initialBalance.toFixed(2),
    };
  }

  // Helper to convert stored transaction to API transaction (number -> string)
  private toApiTransaction(transaction: StoredTransaction): Transaction {
    return {
      ...transaction,
      amount: transaction.amount.toFixed(2),
    };
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const existingUser = await this.getUserByEmail(insertUser.email);
    if (existingUser) {
      throw new Error("Email já cadastrado");
    }

    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    
    // Set trial dates for new users
    const trialStart = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 10); // 10 days trial

    const user: User = {
      id,
      email: insertUser.email,
      password: hashedPassword,
      fullName: insertUser.fullName,
      plan: "free",
      trialStart,
      trialEnd,
      createdAt: new Date(),
    };

    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'password' | 'createdAt'>>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async verifyPassword(email: string, password: string): Promise<User | undefined> {
    const user = await this.getUserByEmail(email);
    if (!user) return undefined;

    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : undefined;
  }

  // Account operations
  async getAccount(id: string): Promise<Account | undefined> {
    const account = this.accounts.get(id);
    return account ? this.toApiAccount(account) : undefined;
  }

  async getAccountsByUserId(userId: string): Promise<Account[]> {
    return Array.from(this.accounts.values())
      .filter((account) => account.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(this.toApiAccount);
  }

  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    const user = await this.getUser(insertAccount.userId);
    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    // Check plan limits
    const userAccounts = await this.getAccountsByUserId(insertAccount.userId);
    const planLimit = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS].accounts;
    
    if (userAccounts.length >= planLimit) {
      throw new Error(`Limite de ${planLimit} conta(s) atingido para o plano ${user.plan}`);
    }

    const id = randomUUID();
    const account: StoredAccount = {
      id,
      userId: insertAccount.userId,
      name: insertAccount.name,
      type: insertAccount.type,
      initialBalance: insertAccount.initialBalance, // Store as number
      createdAt: new Date(),
    };

    this.accounts.set(id, account);
    return this.toApiAccount(account);
  }

  async updateAccount(id: string, updates: { name?: string; type?: string }): Promise<Account | undefined> {
    const account = this.accounts.get(id);
    if (!account) return undefined;

    const updatedAccount = { ...account, ...updates };
    this.accounts.set(id, updatedAccount);
    return this.toApiAccount(updatedAccount);
  }

  async deleteAccount(id: string): Promise<boolean> {
    // Also delete all transactions for this account
    const transactionsToDelete = Array.from(this.transactions.values())
      .filter(t => t.accountId === id);
    transactionsToDelete.forEach((t) => this.transactions.delete(t.id));
    
    return this.accounts.delete(id);
  }

  // Transaction operations
  async getTransaction(id: string): Promise<Transaction | undefined> {
    const transaction = this.transactions.get(id);
    return transaction ? this.toApiTransaction(transaction) : undefined;
  }

  async getTransactionsByUserId(userId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter((transaction) => transaction.userId === userId)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(this.toApiTransaction);
  }

  async getTransactionsByAccountId(accountId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter((transaction) => transaction.accountId === accountId)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(this.toApiTransaction);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const account = await this.getAccount(insertTransaction.accountId);
    if (!account) {
      throw new Error("Conta não encontrada");
    }

    // Check if any auto-rules apply
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

    const id = randomUUID();
    const transaction: StoredTransaction = {
      id,
      userId: insertTransaction.userId,
      accountId: insertTransaction.accountId,
      description: insertTransaction.description,
      type: insertTransaction.type,
      amount: insertTransaction.amount, // Store as number
      category: finalCategory,
      date: insertTransaction.date,
      autoRuleApplied,
      createdAt: new Date(),
    };

    this.transactions.set(id, transaction);
    return this.toApiTransaction(transaction);
  }

  async updateTransaction(id: string, updates: { description?: string; type?: string; amount?: number; category?: string; date?: Date }): Promise<Transaction | undefined> {
    const transaction = this.transactions.get(id);
    if (!transaction) return undefined;

    const updatedTransaction = { ...transaction, ...updates };
    this.transactions.set(id, updatedTransaction);
    return this.toApiTransaction(updatedTransaction);
  }

  async deleteTransaction(id: string): Promise<boolean> {
    return this.transactions.delete(id);
  }

  // Rule operations
  async getRule(id: string): Promise<Rule | undefined> {
    return this.rules.get(id);
  }

  async getRulesByUserId(userId: string): Promise<Rule[]> {
    return Array.from(this.rules.values())
      .filter((rule) => rule.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createRule(insertRule: InsertRule): Promise<Rule> {
    const id = randomUUID();
    const rule: Rule = {
      id,
      userId: insertRule.userId,
      ruleName: insertRule.ruleName,
      contains: insertRule.contains,
      categoryResult: insertRule.categoryResult,
      isActive: true,
      createdAt: new Date(),
    };

    this.rules.set(id, rule);
    return rule;
  }

  async updateRule(id: string, updates: { ruleName?: string; contains?: string; categoryResult?: string; isActive?: boolean }): Promise<Rule | undefined> {
    const rule = this.rules.get(id);
    if (!rule) return undefined;

    const updatedRule = { ...rule, ...updates };
    this.rules.set(id, updatedRule);
    return updatedRule;
  }

  async deleteRule(id: string): Promise<boolean> {
    return this.rules.delete(id);
  }

  // Aggregations - all math done with numbers
  async getDashboardMetrics(userId: string): Promise<{
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    netCashFlow: number;
  }> {
    const storedAccounts = Array.from(this.accounts.values())
      .filter(a => a.userId === userId);
    const storedTransactions = Array.from(this.transactions.values())
      .filter(t => t.userId === userId);

    // Calculate current month start
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filter transactions for current month
    const monthlyTransactions = storedTransactions.filter(
      (t) => t.date >= monthStart
    );

    const monthlyIncome = monthlyTransactions
      .filter((t) => t.type === "entrada")
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpenses = monthlyTransactions
      .filter((t) => t.type === "saida")
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate total balance (initial + all transactions)
    let totalBalance = 0;
    for (const account of storedAccounts) {
      const accountTransactions = storedTransactions.filter(t => t.accountId === account.id);
      const income = accountTransactions
        .filter(t => t.type === "entrada")
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = accountTransactions
        .filter(t => t.type === "saida")
        .reduce((sum, t) => sum + t.amount, 0);
      
      totalBalance += account.initialBalance + income - expenses;
    }

    return {
      totalBalance: Number(totalBalance.toFixed(2)),
      monthlyIncome: Number(monthlyIncome.toFixed(2)),
      monthlyExpenses: Number(monthlyExpenses.toFixed(2)),
      netCashFlow: Number((monthlyIncome - monthlyExpenses).toFixed(2)),
    };
  }

  async getCategoryBreakdown(userId: string): Promise<{ category: string; amount: number }[]> {
    const storedTransactions = Array.from(this.transactions.values())
      .filter(t => t.userId === userId);
    
    // Calculate current month start
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filter for current month expenses only
    const monthlyExpenses = storedTransactions.filter(
      (t) => t.type === "saida" && t.date >= monthStart
    );

    // Group by category
    const categoryMap = new Map<string, number>();
    monthlyExpenses.forEach((t) => {
      const current = categoryMap.get(t.category) || 0;
      categoryMap.set(t.category, current + t.amount);
    });

    // Convert to array and sort by amount
    return Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5); // Top 5 categories
  }
}

import { SupabaseStorage } from "./supabaseStorage";

export const storage = new SupabaseStorage();
