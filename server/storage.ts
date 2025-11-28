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
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";

// Internal types with numeric amounts for calculations
type StoredAccount = Omit<Account, 'initialBalance'> & { initialBalance: number };
type StoredTransaction = Omit<Transaction, 'amount'> & { amount: number };
type StoredFutureTransaction = Omit<FutureTransaction, 'amount' | 'expectedDate' | 'createdAt' | 'dueDate'> & {
  amount: number;
  expectedDate: Date;
  isScheduled: boolean;
  dueDate: Date | null;
  createdAt: Date;
};
type StoredRecurringTransaction = Omit<RecurringTransaction, 'amount' | 'nextDate'> & {
  amount: number;
  nextDate: Date;
};
type AccountScope = "PF" | "PJ" | "ALL";

const matchesScope = (accountType: string, scope: AccountScope) => {
  if (scope === "ALL") return true;
  return (accountType || "PF").toUpperCase() === scope;
};

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
  updateAccount(id: string, updates: { name?: string; type?: string; businessCategory?: string | null }): Promise<Account | undefined>;
  deleteAccount(id: string): Promise<boolean>;

  // Transaction operations
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByUserId(userId: string, scope?: AccountScope): Promise<Transaction[]>;
  getTransactionsByAccountId(accountId: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: { description?: string; type?: string; amount?: number; category?: string; date?: Date; accountType?: "PF" | "PJ"; source?: "manual" | "ai" }): Promise<Transaction | undefined>;
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
  getDashboardMetrics(userId: string, scope?: AccountScope): Promise<{
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    netCashFlow: number;
  }>;
  getCategoryBreakdown(userId: string, scope?: AccountScope): Promise<{ category: string; amount: number }[]>;
  getInvestmentsSummary(userId: string): Promise<{
    totalInvested: number;
    byType: { type: string; amount: number; goal?: number }[];
  }>;
  getIncomeExpensesData(userId: string, scope?: AccountScope): Promise<{
    income: number;
    expenses: number;
  }>;
  // Future expenses
  getFutureExpenses(userId: string, scope?: AccountScope, status?: "pending" | "paid" | "overdue"): Promise<FutureExpense[]>;
  createFutureExpense(expense: InsertFutureExpense): Promise<FutureExpense>;
  updateFutureExpenseStatus(id: string, userId: string, status: "pending" | "paid" | "overdue"): Promise<FutureExpense | undefined>;
  getFutureTransactions(userId: string, scope?: AccountScope, status?: "pending" | "paid" | "received"): Promise<FutureTransaction[]>;
  createFutureTransaction(tx: InsertFutureTransaction): Promise<FutureTransaction>;
  getRecurringTransactions(userId: string, scope?: AccountScope): Promise<RecurringTransaction[]>;
  createRecurringTransaction(tx: InsertRecurringTransaction): Promise<RecurringTransaction>;
  getUserReportPreferences(userId: string): Promise<UserReportPreference | undefined>;
  upsertUserReportPreferences(userId: string, settings: InsertUserReportPreference): Promise<UserReportPreference>;
}

// MemStorage is deprecated - use SupabaseStorage instead
export class MemStorage {
  private users: Map<string, User>;
  private accounts: Map<string, StoredAccount>;
  private transactions: Map<string, StoredTransaction>;
  private futureExpenses: Map<string, FutureExpense>;
  private recurringTransactions: Map<string, StoredRecurringTransaction>;
  private futureTransactions: Map<string, StoredFutureTransaction>;
  private userReportPreferences: Map<string, UserReportPreference>;
  private rules: Map<string, Rule>;

  constructor() {
    this.users = new Map();
    this.accounts = new Map();
    this.transactions = new Map();
    this.futureExpenses = new Map();
    this.recurringTransactions = new Map();
    this.futureTransactions = new Map();
    this.userReportPreferences = new Map();
    this.rules = new Map();
  }

  private getScopedTransactions(userId: string, scope: AccountScope) {
    return Array.from(this.transactions.values()).filter(
      (transaction) => transaction.userId === userId && matchesScope(transaction.accountType || "PF", scope)
    );
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

  private toApiRecurringTransaction(record: RecurringTransaction & { amount: number; nextDate: Date }): RecurringTransaction {
    return {
      ...record,
      amount: record.amount.toFixed(2),
      nextDate: record.nextDate,
    };
  }

  private toApiFutureTransaction(transaction: StoredFutureTransaction): FutureTransaction {
    return {
      ...transaction,
      amount: transaction.amount.toFixed(2),
      expectedDate: transaction.expectedDate,
      dueDate: transaction.dueDate ?? null,
      createdAt: transaction.createdAt,
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
    const user: User = {
      id,
      email: insertUser.email,
      password: hashedPassword,
      fullName: insertUser.fullName,
      plan: "pro",
      trialStart: null,
      trialEnd: null,
      caktoSubscriptionId: null,
      billingStatus: "pending",
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
      businessCategory: insertAccount.businessCategory ?? null,
      initialBalance: insertAccount.initialBalance, // Store as number
      createdAt: new Date(),
    };

    this.accounts.set(id, account);
    return this.toApiAccount(account);
  }

  async updateAccount(id: string, updates: { name?: string; type?: string; businessCategory?: string | null }): Promise<Account | undefined> {
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

  async getTransactionsByUserId(userId: string, scope: AccountScope = "ALL"): Promise<Transaction[]> {
    return this.getScopedTransactions(userId, scope)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((transaction) => this.toApiTransaction(transaction));
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
      accountType: insertTransaction.accountType ?? "PF",
      autoRuleApplied,
      source: insertTransaction.source ?? "manual",
      createdAt: new Date(),
    };

    this.transactions.set(id, transaction);
    return this.toApiTransaction(transaction);
  }

  async updateTransaction(id: string, updates: { description?: string; type?: string; amount?: number; category?: string; date?: Date; accountType?: "PF" | "PJ"; source?: "manual" | "ai" }): Promise<Transaction | undefined> {
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
  async getDashboardMetrics(userId: string, scope: AccountScope = "ALL"): Promise<{
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    netCashFlow: number;
  }> {
    const storedTransactions = this.getScopedTransactions(userId, scope);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyTransactions = storedTransactions.filter((t) => t.date >= monthStart);

    const monthlyIncome = monthlyTransactions
      .filter((t) => t.type === "entrada")
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpenses = monthlyTransactions
      .filter((t) => t.type === "saida")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalBalance = storedTransactions.reduce((acc, tx) => {
      return acc + (tx.type === "entrada" ? tx.amount : -tx.amount);
    }, 0);

    return {
      totalBalance: Number(totalBalance.toFixed(2)),
      monthlyIncome: Number(monthlyIncome.toFixed(2)),
      monthlyExpenses: Number(monthlyExpenses.toFixed(2)),
      netCashFlow: Number((monthlyIncome - monthlyExpenses).toFixed(2)),
    };
  }

  async getCategoryBreakdown(userId: string, scope: AccountScope = "ALL"): Promise<{ category: string; amount: number }[]> {
    const storedTransactions = this.getScopedTransactions(userId, scope);
    
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

  async getIncomeExpensesData(userId: string, scope: AccountScope = "ALL"): Promise<{
    income: number;
    expenses: number;
  }> {
    const storedTransactions = this.getScopedTransactions(userId, scope);
    const income = storedTransactions
      .filter((t) => t.type === "entrada")
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = storedTransactions
      .filter((t) => t.type === "saida")
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      income: Number(income.toFixed(2)),
      expenses: Number(expenses.toFixed(2)),
    };
  }

  async getFutureExpenses(userId: string, scope: AccountScope = "ALL", status?: "pending" | "paid" | "overdue") {
    return Array.from(this.futureExpenses.values()).filter((expense) => {
      if (expense.userId !== userId) return false;
      if (scope !== "ALL" && (expense.accountType || "PF").toUpperCase() !== scope) {
        return false;
      }
      if (status && expense.status !== status) {
        return false;
      }
      return true;
    });
  }

  async createFutureExpense(expense: InsertFutureExpense): Promise<FutureExpense> {
    const id = randomUUID();
    const record: FutureExpense = {
      id,
      userId: expense.userId,
      accountType: expense.accountType,
      title: expense.title,
      category: expense.category,
      amount: expense.amount.toString(),
      dueDate: expense.dueDate,
      isRecurring: Boolean(expense.isRecurring),
      recurrenceType: expense.recurrenceType ?? null,
      status: expense.status || "pending",
      createdAt: new Date(),
    };
    this.futureExpenses.set(id, record);
    return record;
  }

  async updateFutureExpenseStatus(id: string, userId: string, status: "pending" | "paid" | "overdue") {
    const existing = this.futureExpenses.get(id);
    if (!existing || existing.userId !== userId) {
      return undefined;
    }
    const updated: FutureExpense = { ...existing, status };
    this.futureExpenses.set(id, updated);
    return updated;
  }

  async getFutureTransactions(userId: string, scope: AccountScope = "ALL", status?: "pending" | "paid" | "received") {
    return Array.from(this.futureTransactions.values())
      .filter((tx) => {
        if (tx.userId !== userId) return false;
        if (scope !== "ALL" && (tx.accountType || "PF").toUpperCase() !== scope) return false;
        if (status && tx.status !== status) return false;
        return true;
      })
      .sort((a, b) => b.expectedDate.getTime() - a.expectedDate.getTime())
      .map((tx) => this.toApiFutureTransaction(tx));
  }

  async createFutureTransaction(tx: InsertFutureTransaction): Promise<FutureTransaction> {
    const id = randomUUID();
    const record: StoredFutureTransaction = {
      id,
      userId: tx.userId,
      type: tx.type,
      description: tx.description,
      amount: tx.amount,
      expectedDate: tx.expectedDate,
      accountType: tx.accountType ?? "PF",
      status: tx.status || "pending",
      isScheduled: Boolean(tx.isScheduled),
      dueDate: tx.dueDate ?? tx.expectedDate,
      createdAt: new Date(),
    };
    this.futureTransactions.set(id, record);
    return this.toApiFutureTransaction(record);
  }

  async getRecurringTransactions(userId: string, scope: AccountScope = "ALL") {
    return Array.from(this.recurringTransactions.values())
      .filter((item) => {
        if (item.userId !== userId) return false;
        if (scope !== "ALL" && (item.accountType || "PF").toUpperCase() !== scope) {
          return false;
        }
        return true;
      })
      .map((item) => this.toApiRecurringTransaction(item));
  }

  async createRecurringTransaction(tx: InsertRecurringTransaction): Promise<RecurringTransaction> {
    const id = randomUUID();
    const record: StoredRecurringTransaction = {
      id,
      userId: tx.userId,
      type: tx.type,
      description: tx.description,
      amount: tx.amount,
      frequency: tx.frequency,
      nextDate: tx.nextDate,
      accountType: tx.accountType ?? "PF",
      createdAt: new Date(),
    };
    this.recurringTransactions.set(id, record);
    return this.toApiRecurringTransaction(record);
  }

  async getUserReportPreferences(userId: string): Promise<UserReportPreference | undefined> {
    return this.userReportPreferences.get(userId);
  }

  async upsertUserReportPreferences(userId: string, settings: InsertUserReportPreference): Promise<UserReportPreference> {
    const existing = this.userReportPreferences.get(userId) || {
      userId,
      focusEconomy: false,
      focusDebt: false,
      focusInvestments: false,
      updatedAt: new Date(),
    };
    const updated = {
      ...existing,
      ...settings,
      updatedAt: new Date(),
    };
    this.userReportPreferences.set(userId, updated);
    return updated;
  }
}

import { SupabaseStorage } from "./supabaseStorage";

export const storage = new SupabaseStorage();
