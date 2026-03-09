import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { uuid, numeric } from "drizzle-orm/pg-core";

// Users table with plan and trial information
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  plan: text("plan").notNull().default("pro"), // 'pro' | 'premium'
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  caktoSubscriptionId: text("cakto_subscription_id"),
  billingStatus: text("billing_status").notNull().default("pending"), // 'pending' | 'active' | 'canceled'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Financial accounts (personal or business)
export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'pf' | 'pj'
  businessCategory: text("business_category"),
  initialBalance: decimal("initial_balance", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transactions
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  accountId: varchar("account_id").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // 'entrada' | 'saida'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  date: timestamp("date").notNull(),
  accountType: text("account_type").notNull().default("PF"),
  autoRuleApplied: boolean("auto_rule_applied").default(false),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const futureExpenses = pgTable("future_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  accountType: text("account_type").notNull().default("PF"),
  title: text("title").notNull(),
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("due_date").notNull(),
  isRecurring: boolean("is_recurring").default(false),
  recurrenceType: text("recurrence_type"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const futureTransactions = pgTable("future_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(), // 'income' | 'expense'
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  expectedDate: timestamp("expected_date").notNull(),
  accountType: text("account_type").notNull().default("PF"),
  status: text("status").notNull().default("pending"),
  isScheduled: boolean("is_scheduled").notNull().default(false),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recurringTransactions = pgTable("recurring_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  frequency: text("frequency").notNull(),
  nextDate: timestamp("next_date").notNull(),
  accountType: text("account_type").notNull().default("PF"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiMessages = pgTable("ai_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiChatHistory = pgTable("ai_chat_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userReportPreferences = pgTable("user_report_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  focusEconomy: boolean("focus_saving").notNull().default(false),
  focusDebt: boolean("focus_debts").notNull().default(false),
  focusInvestments: boolean("focus_investments").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const businessProfiles = pgTable("business_profile", {
  userId: varchar("user_id").primaryKey().notNull(),
  cnpj: text("cnpj"),
  businessType: text("business_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Categorization rules (for Premium users)
export const rules = pgTable("rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  ruleName: text("rule_name").notNull(),
  contains: text("contains").notNull(), // keyword to match in description
  categoryResult: text("category_result").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Investment accounts (reserva de emergência, CDB, renda fixa, renda variável)
export const investments = pgTable("investments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'reserva_emergencia' | 'cdb' | 'renda_fixa' | 'renda_variavel'
  currentAmount: decimal("current_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Investment goals
export const investmentGoals = pgTable("investment_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  investmentId: varchar("investment_id").notNull(),
  targetAmount: decimal("target_amount", { precision: 10, scale: 2 }).notNull(),
  targetDate: timestamp("target_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Investment transactions (transfers from accounts to investments)
export const investmentTransactions = pgTable("investment_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  investmentId: varchar("investment_id").notNull(),
  sourceAccountId: varchar("source_account_id").notNull(), // Account money came from
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(), // 'deposit' | 'withdrawal'
  date: timestamp("date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas with validation
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  fullName: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
}).omit({
  id: true,
  plan: true,
  trialStart: true,
  trialEnd: true,
  caktoSubscriptionId: true,
  billingStatus: true,
  createdAt: true,
});

export const insertAccountSchema = createInsertSchema(accounts, {
  name: z.string().min(1, "Nome da conta é obrigatório"),
  type: z.enum(["pf", "pj"], { errorMap: () => ({ message: "Tipo inválido" }) }),
  businessCategory: z.enum(["mei"]).optional(),
  initialBalance: z.coerce.number().min(0, "Saldo deve ser positivo").refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
    "Saldo deve ter no máximo 2 casas decimais"
  ),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
});

// Update schemas with strict validation (no userId changes allowed)
export const updateAccountSchema = z.object({
  name: z.string().min(1, "Nome da conta é obrigatório").optional(),
  type: z.enum(["pf", "pj"]).optional(),
  businessCategory: z.union([z.literal("mei"), z.null()]).optional(),
}).strict();

export const insertTransactionSchema = createInsertSchema(transactions, {
  description: z.string().min(1, "Descrição é obrigatória"),
  type: z.enum(["entrada", "saida"], { errorMap: () => ({ message: "Tipo inválido" }) }),
  amount: z.coerce.number().positive("Valor deve ser maior que zero").refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
    "Valor deve ter no máximo 2 casas decimais"
  ),
  category: z.string().min(1, "Categoria é obrigatória"),
  date: z.coerce.date(),
  accountType: z.enum(["PF", "PJ"]).default("PF"),
  source: z.enum(["manual", "ai"]).default("manual"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertFutureExpenseSchema = createInsertSchema(futureExpenses, {
  title: z.string().min(1, "Título é obrigatório"),
  category: z.string().min(1, "Categoria é obrigatória"),
  amount: z.coerce.number().positive("Valor deve ser maior que zero").refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
    "Valor deve ter no máximo 2 casas decimais"
  ),
  dueDate: z.coerce.date(),
  accountType: z.enum(["PF", "PJ"]),
  isRecurring: z.boolean().default(false),
  recurrenceType: z.enum(["monthly", "yearly"]).optional().nullable(),
  status: z.enum(["pending", "paid", "overdue"]).optional(),
}).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export const insertFutureTransactionSchema = createInsertSchema(futureTransactions, {
  type: z.enum(["income", "expense"]),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.coerce.number().positive("Valor deve ser maior que zero").refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
    "Valor deve ter no máximo 2 casas decimais"
  ),
  expectedDate: z.coerce.date(),
  accountType: z.enum(["PF", "PJ"]).default("PF"),
  status: z.enum(["pending", "paid", "received"]).optional(),
  isScheduled: z.boolean().optional(),
  dueDate: z.coerce.date().optional(),
}).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export const insertRecurringTransactionSchema = createInsertSchema(recurringTransactions, {
  type: z.enum(["income", "expense"]),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.coerce.number().positive("Valor deve ser maior que zero").refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
    "Valor deve ter no máximo 2 casas decimais"
  ),
  frequency: z.enum(["monthly", "weekly"]),
  nextDate: z.coerce.date(),
  accountType: z.enum(["PF", "PJ"]).default("PF"),
}).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export const insertAiMessageSchema = createInsertSchema(aiMessages, {
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1, "Conteúdo é obrigatório"),
}).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export const insertUserReportPreferenceSchema = createInsertSchema(userReportPreferences, {
  focusEconomy: z.boolean().optional(),
  focusDebt: z.boolean().optional(),
  focusInvestments: z.boolean().optional(),
}).omit({
  id: true,
  userId: true,
  updatedAt: true,
});

export const updateTransactionSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").optional(),
  type: z.enum(["entrada", "saida"]).optional(),
  amount: z.coerce.number().positive("Valor deve ser maior que zero").refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
    "Valor deve ter no máximo 2 casas decimais"
  ).optional(),
  category: z.string().min(1, "Categoria é obrigatória").optional(),
  date: z.coerce.date().optional(),
  accountType: z.enum(["PF", "PJ"]).optional(),
  source: z.enum(["manual", "ai"]).optional(),
}).strict();

export const insertRuleSchema = createInsertSchema(rules, {
  ruleName: z.string().min(1, "Nome da regra é obrigatório"),
  contains: z.string().min(1, "Palavra-chave é obrigatória"),
  categoryResult: z.string().min(1, "Categoria é obrigatória"),
}).omit({
  id: true,
  createdAt: true,
});

export const updateRuleSchema = z.object({
  ruleName: z.string().min(1, "Nome da regra é obrigatório").optional(),
  contains: z.string().min(1, "Palavra-chave é obrigatória").optional(),
  categoryResult: z.string().min(1, "Categoria é obrigatória").optional(),
  isActive: z.boolean().optional(),
}).strict();

export const insertInvestmentSchema = createInsertSchema(investments, {
  name: z.string().min(1, "Nome do investimento é obrigatório"),
  type: z.enum(["reserva_emergencia", "cdb", "renda_fixa", "renda_variavel"], { 
    errorMap: () => ({ message: "Tipo inválido" }) 
  }),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  currentAmount: true,
});

export const updateInvestmentSchema = z.object({
  name: z.string().min(1, "Nome do investimento é obrigatório").optional(),
}).strict();

export const insertInvestmentGoalSchema = createInsertSchema(investmentGoals, {
  targetAmount: z.coerce.number().positive("Meta deve ser maior que zero").refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
    "Meta deve ter no máximo 2 casas decimais"
  ),
  targetDate: z.coerce.date().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const updateInvestmentGoalSchema = z.object({
  targetAmount: z.coerce.number().positive("Meta deve ser maior que zero").refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
    "Meta deve ter no máximo 2 casas decimais"
  ).optional(),
  targetDate: z.coerce.date().optional(),
}).strict();

export const insertInvestmentTransactionSchema = createInsertSchema(investmentTransactions, {
  amount: z.coerce.number().positive("Valor deve ser maior que zero").refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
    "Valor deve ter no máximo 2 casas decimais"
  ),
  type: z.enum(["deposit", "withdrawal"], { errorMap: () => ({ message: "Tipo inválido" }) }),
  date: z.coerce.date(),
  note: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// User profile update schema
export const updateUserProfileSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  email: z.string().email("Email inválido").optional(),
}).strict();

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertAccount = z.infer<typeof insertAccountSchema> & {userId: string;};
export type UpdateAccount = z.infer<typeof updateAccountSchema>;
export type Account = typeof accounts.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema> & {userId: string; accountId: string;};
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type BusinessProfile = typeof businessProfiles.$inferSelect;

export type InsertFutureExpense = z.infer<typeof insertFutureExpenseSchema> & { userId: string };
export type FutureExpense = typeof futureExpenses.$inferSelect;

export type InsertFutureTransaction = z.infer<typeof insertFutureTransactionSchema> & { userId: string };
export type FutureTransaction = typeof futureTransactions.$inferSelect;

export type InsertRecurringTransaction = z.infer<typeof insertRecurringTransactionSchema> & { userId: string };
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;

export type InsertAiMessage = z.infer<typeof insertAiMessageSchema> & { userId: string };
export type AiMessage = typeof aiMessages.$inferSelect;

export type UserReportPreference = typeof userReportPreferences.$inferSelect;
export type InsertUserReportPreference = z.infer<typeof insertUserReportPreferenceSchema> & {
  userId: string;
};

export type InsertRule = z.infer<typeof insertRuleSchema> & {userID: string;};
export type UpdateRule = z.infer<typeof updateRuleSchema>;
export type Rule = typeof rules.$inferSelect;

export type InsertInvestment = z.infer<typeof insertInvestmentSchema> & {userId: string;};
export type UpdateInvestment = z.infer<typeof updateInvestmentSchema>;
export type Investment = typeof investments.$inferSelect;

export type InsertInvestmentGoal = z.infer<typeof insertInvestmentGoalSchema> & {userId: string; investmentId: string;};
export type UpdateInvestmentGoal = z.infer<typeof updateInvestmentGoalSchema>;
export type InvestmentGoal = typeof investmentGoals.$inferSelect;

export type InsertInvestmentTransaction = z.infer<typeof insertInvestmentTransactionSchema> & {userId: string; investmentId: string; sourceAccountId: string;};
export type InvestmentTransaction = typeof investmentTransactions.$inferSelect;

export type LoginData = z.infer<typeof loginSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

// Plan limits
export const PLAN_LIMITS = {
  pro: { accounts: 3, features: ["basic_dashboard", "cash_flow", "csv_export", "alerts"] },
  premium: { accounts: Infinity, features: ["advanced_dashboard", "auto_rules", "pdf_reports"] },
} as const;

// Categories (predefined)
export const CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Moradia",
  "Saúde",
  "Educação",
  "Lazer",
  "Vestuário",
  "Investimentos",
  "Salário",
  "Freelance",
  "Vendas",
  "Outros",
] as const;

// Investment types
export const INVESTMENT_TYPES = [
  { value: "reserva_emergencia", label: "Reserva de Emergência" },
  { value: "cdb", label: "CDB" },
  { value: "renda_fixa", label: "Renda Fixa" },
  { value: "renda_variavel", label: "Renda Variável" },
] as const;

export const futureBills = pgTable("future_bills", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  amount: numeric("amount").notNull(),
  dueDate: timestamp("due_date").notNull(),
  type: text("type").$type<'PF' | 'PJ'>().notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const goals = pgTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  targetValue: numeric("target_value").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
