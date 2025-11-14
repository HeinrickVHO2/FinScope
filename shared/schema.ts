import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with plan and trial information
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  plan: text("plan").notNull().default("free"), // 'free' | 'pro' | 'premium'
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Financial accounts (personal or business)
export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'pessoal' | 'empresa'
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
  autoRuleApplied: boolean("auto_rule_applied").default(false),
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
  type: text("type").notNull(), // 'reserva-emergencia' | 'cdb' | 'renda-fixa' | 'renda-variavel'
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
  createdAt: true,
});

export const insertAccountSchema = createInsertSchema(accounts, {
  name: z.string().min(1, "Nome da conta é obrigatório"),
  type: z.enum(["pessoal", "empresa"], { errorMap: () => ({ message: "Tipo inválido" }) }),
  initialBalance: z.coerce.number().min(0, "Saldo deve ser positivo").refine(
    (val) => Number.isFinite(val) && Math.round(val * 100) === val * 100,
    "Saldo deve ter no máximo 2 casas decimais"
  ),
}).omit({
  id: true,
  createdAt: true,
});

// Update schemas with strict validation (no userId changes allowed)
export const updateAccountSchema = z.object({
  name: z.string().min(1, "Nome da conta é obrigatório").optional(),
  type: z.enum(["pessoal", "empresa"]).optional(),
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
}).omit({
  id: true,
  createdAt: true,
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
  type: z.enum(["reserva-emergencia", "cdb", "renda-fixa", "renda-variavel"], { 
    errorMap: () => ({ message: "Tipo inválido" }) 
  }),
}).omit({
  id: true,
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

export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type UpdateAccount = z.infer<typeof updateAccountSchema>;
export type Account = typeof accounts.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertRule = z.infer<typeof insertRuleSchema>;
export type UpdateRule = z.infer<typeof updateRuleSchema>;
export type Rule = typeof rules.$inferSelect;

export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;
export type UpdateInvestment = z.infer<typeof updateInvestmentSchema>;
export type Investment = typeof investments.$inferSelect;

export type InsertInvestmentGoal = z.infer<typeof insertInvestmentGoalSchema>;
export type UpdateInvestmentGoal = z.infer<typeof updateInvestmentGoalSchema>;
export type InvestmentGoal = typeof investmentGoals.$inferSelect;

export type InsertInvestmentTransaction = z.infer<typeof insertInvestmentTransactionSchema>;
export type InvestmentTransaction = typeof investmentTransactions.$inferSelect;

export type LoginData = z.infer<typeof loginSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

// Plan limits
export const PLAN_LIMITS = {
  free: { accounts: 1, features: ["basic_dashboard"] },
  pro: { accounts: 3, features: ["basic_dashboard", "cash_flow", "csv_export", "alerts"] },
  premium: { accounts: Infinity, features: ["advanced_dashboard", "auto_rules", "pdf_reports", "mei_management"] },
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
  { value: "reserva-emergencia", label: "Reserva de Emergência" },
  { value: "cdb", label: "CDB" },
  { value: "renda-fixa", label: "Renda Fixa" },
  { value: "renda-variavel", label: "Renda Variável" },
] as const;
