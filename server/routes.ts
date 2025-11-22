import type { Express } from "express";
import bcrypt from "bcrypt";
import express from "express";
import session from "express-session";
import { supabase } from "./supabase";
import { sendResetEmail } from "server/emails/resetEmail";
import { sendContactEmail } from "server/emails/contactEmail";
import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import MemoryStore from "memorystore";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { buildPremiumInsights } from "./insights";
import { buildProTransactionsPdf } from "./pdf/proReport";
import { generateAiFinancialReport } from "./aiReports";
import { generateAiInsights } from "./aiInsights";
import type { AiInsightResult } from "./aiInsights";
import { 
  insertUserSchema, 
  loginSchema,
  insertAccountSchema,
  updateAccountSchema,
  insertTransactionSchema,
  updateTransactionSchema,
  insertRuleSchema,
  updateRuleSchema,
  updateUserProfileSchema,
  insertInvestmentSchema,
  updateInvestmentSchema,
  insertInvestmentGoalSchema,
  updateInvestmentGoalSchema,
  insertInvestmentTransactionSchema,
  insertFutureExpenseSchema,
  insertFutureTransactionSchema,
  insertAiReportSettingSchema,
} from "@shared/schema";
import type { User, Transaction, FutureTransaction, RecurringTransaction } from "@shared/schema";
import { z } from "zod";
import { randomUUID } from "crypto";
import fetch from "node-fetch";
import { buildFinancialContext } from "../ai/buildFinancialContext";
import { sanitizeUserInput, generateSafeRejectionMessage } from "../ai/sanitizeInput";
import { buildConversationalPrompt } from "../ai/conversationalPrompt";


// Extend Express session type
declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: User;
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {

  const puppeteerExecutable = resolvePuppeteerExecutable();
  if (!puppeteerExecutable) {
    console.warn("[PDF EXPORT] Puppeteer executable not resolved, relying on bundled Chromium");
  } else {
    console.log("[PDF EXPORT] using browser executable:", puppeteerExecutable);
  }

  app.use(express.json());      // 👈 OBRIGATÓRIO
  app.use(express.urlencoded({ extended: true }));  // (opcional, mas recomendado)
  const GUARANTEE_DAYS = Number(process.env.BILLING_GUARANTEE_DAYS || "10");
  const GUARANTEE_WINDOW_MS = GUARANTEE_DAYS * 24 * 60 * 60 * 1000;

  // Trust proxy - required for cookies to work behind Replit's proxy
  app.set('trust proxy', 1);

  // Configure session with proper settings
  const SessionStore = MemoryStore(session);
  
  // Debug: Log session configuration
  const isProduction = process.env.NODE_ENV === "production";
  console.log(`[SESSION CONFIG] NODE_ENV: ${process.env.NODE_ENV}, secure: ${isProduction}`);
  
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "finscope-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      proxy: true, // CRITICAL: Required for sessions to work behind Replit's reverse proxy
      store: new SessionStore({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
      cookie: {
        httpOnly: true,
        secure: isProduction, // Only require HTTPS in production (development uses HTTP)
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: "lax",
      },
    })
  );
  
  // Debug middleware to log session state
  app.use((req: any, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      if (req.path.includes('/api/auth/')) {
        console.log(`[SESSION DEBUG] ${req.method} ${req.path} - Session ID: ${req.session?.id}, User ID: ${req.session?.userId}, Cookie will be sent: ${req.session?.id ? 'YES' : 'NO'}`);
      }
      return originalJson(data);
    };
    next();
  });

  // Debug endpoint to check deployment config
  app.get("/api/debug/config", (req: any, res) => {
    res.json({
      nodeEnv: process.env.NODE_ENV,
      replitDeployment: process.env.REPLIT_DEPLOYMENT || "not set",
      sessionCookieSecure: isProduction || true, // Will always be true now
      trustProxy: app.get('trust proxy'),
      sessionId: req.session?.id || "no session",
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/api/contact", async (req, res) => {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios." });
    }

    try {
      await sendContactEmail({
        name: String(name).trim(),
        email: String(email).trim(),
        message: String(message).trim(),
      });
      res.json({ success: true });
    } catch (error) {
      console.error("[CONTACT] Erro ao enviar mensagem:", error);
      res.status(500).json({ error: "Não foi possível enviar sua mensagem agora." });
    }
  });

  type AccountScope = "PF" | "PJ" | "ALL";

  const parseAccountScope = (value: any): AccountScope => {
    const normalized = String(value || "ALL").toUpperCase();
    if (normalized === "PF" || normalized === "PJ") {
      return normalized;
    }
    return "ALL";
  };

  const parseFutureExpenseStatus = (value: any): "pending" | "paid" | "overdue" | undefined => {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "pending" || normalized === "paid" || normalized === "overdue") {
      return normalized as "pending" | "paid" | "overdue";
    }
    return undefined;
  };

  const parseFutureTransactionStatus = (value: any): "pending" | "paid" | "received" | undefined => {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "pending" || normalized === "paid" || normalized === "received") {
      return normalized as "pending" | "paid" | "received";
    }
    return undefined;
  };

  const normalizeAccountType = (value: any): "PF" | "PJ" => {
    return String(value || "PF").toUpperCase() === "PJ" ? "PJ" : "PF";
  };

  const aiChatRequestSchema = z.object({
    content: z.string().min(1, "Mensagem é obrigatória").max(2000, "Mensagem muito longa"),
  });

  const scopeLabels: Record<AccountScope, string> = {
    PF: "Conta Pessoal",
    PJ: "Conta Empresarial",
    ALL: "Consolidado PF + PJ",
  };

  const PF_EXPENSE_CATEGORIES = [
    "Mercado",
    "Streaming",
    "Aluguel",
    "Luz / Água",
    "Transporte",
    "Alimentação",
    "Outros",
  ];

  const PF_INCOME_CATEGORIES = ["Salário", "Renda extra", "Transferências", "Reembolso", "Outros"];

  const PJ_EXPENSE_CATEGORIES = [
    "Impostos",
    "Software",
    "Fornecedores",
    "Transporte",
    "Alimentação",
    "Outros",
  ];

  const PJ_INCOME_CATEGORIES = [
    "Faturamento / Receitas",
    "Serviços prestados",
    "Produtos vendidos",
    "Reembolsos empresariais",
    "Outros",
  ];

  const AI_ALLOWED_CATEGORIES = {
    PF: { income: PF_INCOME_CATEGORIES, expense: PF_EXPENSE_CATEGORIES },
    PJ: { income: PJ_INCOME_CATEGORIES, expense: PJ_EXPENSE_CATEGORIES },
  } as const;

  const DEFAULT_CATEGORY = {
    PF: { income: "Renda extra", expense: "Outros" },
    PJ: { income: "Faturamento / Receitas", expense: "Outros" },
  } as const;

  const CATEGORY_HINTS: Array<{
    scope: "PF" | "PJ";
    type: "income" | "expense";
    category: string;
    keywords: string[];
  }> = [
    { scope: "PF", type: "expense", category: "Mercado", keywords: ["mercado", "supermerc", "hortifruti"] },
    { scope: "PF", type: "expense", category: "Alimentação", keywords: ["restaurante", "lanch", "pizza", "comida"] },
    { scope: "PF", type: "expense", category: "Aluguel", keywords: ["aluguel", "condomínio", "locação"] },
    { scope: "PF", type: "expense", category: "Streaming", keywords: ["netflix", "spotify", "streaming", "prime video", "assinatura"] },
    { scope: "PF", type: "expense", category: "Luz / Água", keywords: ["energia", "luz", "água", "copasa", "sabesp"] },
    { scope: "PF", type: "expense", category: "Transporte", keywords: ["uber", "combust", "gasolina", "ônibus"] },
    { scope: "PF", type: "income", category: "Salário", keywords: ["salario", "pagamento", "folha"] },
    { scope: "PF", type: "income", category: "Reembolso", keywords: ["reembolso"] },
    { scope: "PJ", type: "income", category: "Faturamento / Receitas", keywords: ["faturamento", "nfe", "nota", "cliente"] },
    { scope: "PJ", type: "expense", category: "Impostos", keywords: ["das", "imposto", "taxa", "simples"] },
    { scope: "PJ", type: "expense", category: "Software", keywords: ["licença", "software", "saas"] },
    { scope: "PJ", type: "expense", category: "Fornecedores", keywords: ["fornecedor", "compra", "insumo"] },
    { scope: "PJ", type: "expense", category: "Transporte", keywords: ["logistica", "frete", "transporte"] },
    { scope: "PJ", type: "expense", category: "Alimentação", keywords: ["almoço equipe", "refeição", "coffee break"] },
  ];

  const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  const formatPtDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatCurrencyBRL = (value: number) => {
    const rounded = Number.isFinite(value) ? value : 0;
    const parts = rounded.toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `R$ ${parts.join(",")}`;
  };

  const ensureScopeAccess = (scope: AccountScope, req: any, res: any) => {
    if (scope === "PJ" && req.currentUser?.plan !== "premium") {
      res.status(403).json({ error: "Recurso empresarial disponível apenas para o plano Premium" });
      return false;
    }
    return true;
  };

  const mapAiMessage = (row: any) => ({
    id: row?.id,
    role: row?.role,
    content: row?.content,
    createdAt: row?.created_at || row?.createdAt || new Date().toISOString(),
  });

  const convertExpenseToFuture = (expense: FutureExpense): FutureTransaction => ({
    id: `expense-${expense.id}`,
    userId: expense.userId,
    type: "expense",
    description: expense.title,
    amount: expense.amount?.toString() ?? "0",
    expectedDate: expense.dueDate,
    accountType: expense.accountType || "PF",
    status: expense.status || "pending",
    createdAt: expense.createdAt,
    isScheduled: true,
    dueDate: expense.dueDate,
  });

  const computeFutureTotals = (items: FutureTransaction[]) => {
    let totalToPay = 0;
    let totalToReceive = 0;
    items.forEach((item) => {
      const amount = Number(item.amount) || 0;
      if (item.type === "expense") {
        if (item.status === "pending") {
          totalToPay += amount;
        }
      } else if (item.type === "income") {
        if (item.status === "pending") {
          totalToReceive += amount;
        }
      }
    });
    return {
      totalToPay: Number(totalToPay.toFixed(2)),
      totalToReceive: Number(totalToReceive.toFixed(2)),
      futureBalance: Number((totalToReceive - totalToPay).toFixed(2)),
    };
  };

  const AI_CATEGORY_TEXT = [
    `Categorias PF (despesas): ${PF_EXPENSE_CATEGORIES.join(", ")}`,
    `Categorias PF (receitas): ${PF_INCOME_CATEGORIES.join(", ")}`,
    `Categorias PJ (despesas): ${PJ_EXPENSE_CATEGORIES.join(", ")}`,
    `Categorias PJ (receitas): ${PJ_INCOME_CATEGORIES.join(", ")}`,
  ].join("\n");

  type CandidateTransaction = {
    type: "income" | "expense";
    description: string;
    amount: number;
    date: string;
    accountType: "PF" | "PJ";
    category: string;
    isScheduled?: boolean;
    dueDate?: string;
  };

  type PendingAction =
    | { kind: "transaction"; candidate: CandidateTransaction }
    | { kind: "future"; candidate: CandidateTransaction; intent: "income" | "expense" }
    | {
        kind: "recurring";
        candidate: CandidateTransaction;
        frequency: "monthly" | "weekly";
        immediateReceipt: boolean;
      };

  const pendingActions = new Map<string, PendingAction>();

  type ConversationStep =
    | "idle"
    | "collecting_amount"
    | "collecting_type"
    | "collecting_date"
    | "collecting_description"
    | "confirming_transaction";

  type ConversationMemory = {
    amount?: number;
    type?: "income" | "expense";
    date?: string;
    description?: string;
    accountType?: "PF" | "PJ";
    category?: string;
    isScheduled?: boolean;
    dueDate?: string;
  };

  type ConversationState = {
    step: ConversationStep;
    memory: ConversationMemory;
  };

  const conversationStates = new Map<string, ConversationState>();
  const isDevMode = process.env.NODE_ENV !== "production";

  const conversationStepOrder: ConversationStep[] = [
    "idle",
    "collecting_amount",
    "collecting_type",
    "collecting_date",
    "collecting_description",
    "confirming_transaction",
  ];

  const getConversationState = (userId: string): ConversationState => {
    if (!conversationStates.has(userId)) {
      conversationStates.set(userId, { step: "idle", memory: {} });
    }
    return conversationStates.get(userId)!;
  };

  const resetConversationState = (userId: string) => {
    conversationStates.set(userId, { step: "idle", memory: {} });
    pendingActions.delete(userId);
  };

  const logConversationState = (userId: string, label: string) => {
    if (!isDevMode) return;
    const snapshot = conversationStates.get(userId);
    console.log(`[AI STATE][${userId}] ${label}:`, snapshot);
  };

  const stepIndex = (step: ConversationStep) => conversationStepOrder.indexOf(step);

  const hasAllConversationData = (memory: ConversationMemory) =>
    memory.amount !== undefined &&
    memory.type !== undefined &&
    memory.date !== undefined &&
    memory.description &&
    (memory.accountType === "PF" || memory.accountType === "PJ");

  const determineNextStepFromMemory = (memory: ConversationMemory): ConversationStep => {
    if (!memory.amount) return "collecting_amount";
    if (!memory.type) return "collecting_type";
    if (!memory.date) return "collecting_date";
    if (!memory.description) return "collecting_description";
    return "confirming_transaction";
  };

  const advanceConversationStep = (state: ConversationState) => {
    const desired = determineNextStepFromMemory(state.memory);
    const currentIdx = stepIndex(state.step);
    const desiredIdx = stepIndex(desired);
    if (desiredIdx > currentIdx || state.step === "idle") {
      state.step = desired;
    }
  };

  const mapTypeToHuman = (type: "income" | "expense") => (type === "income" ? "recebimento" : "pagamento");

  const formatConfirmationMessage = (memory: ConversationMemory) => {
    const amount = memory.amount ? formatCurrencyBRL(memory.amount) : "R$ 0,00";
    const typeLabel = memory.type ? mapTypeToHuman(memory.type) : "pendente";
    const dateLabel = memory.date ? formatPtDate(new Date(memory.date)) : "sem data";
    const accountLabel = memory.accountType ? scopeLabels[memory.accountType] : scopeLabels.PF;
    const description = memory.description || "-";
    const scheduledNote = memory.isScheduled ? "\nAgendado: sim" : "";
    return `Posso salvar assim?
Valor: ${amount}
Tipo: ${typeLabel}
Data: ${dateLabel}
Conta: ${accountLabel}
Descrição: ${description}${scheduledNote}`;
  };

  const extractAmountFromText = (content: string): number | null => {
    const normalized = content.toLowerCase().replace(/\s+/g, " ");
    const regex = /(\d+(?:[.,]\d+)?)(?:\s*(milhão|milhao|milhões|milhoes|mil))?/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(normalized))) {
      const rawIndex = match.index;
      const tokens = normalized.slice(0, rawIndex).trim().split(/\s+/);
      const prevWord = tokens[tokens.length - 1] || "";
      if (prevWord.replace(/[^\p{L}]/gu, "").startsWith("dia")) {
        continue;
      }
      const raw = match[1].replace(/\./g, "").replace(",", ".");
      let value = Number(raw);
      if (!Number.isFinite(value)) continue;
      const unit = match[2];
      if (unit) {
        if (unit.startsWith("milh")) value *= 1_000_000;
        else value *= 1_000;
      }
      return Number(value.toFixed(2));
    }
    return null;
  };

  const parseDateFromText = (content: string): Date | null => {
    const normalized = content.toLowerCase();
    const now = new Date();
    if (normalized.includes("amanhã") || normalized.includes("amanha")) {
      return new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    }
    if (normalized.includes("hoje")) {
      return now;
    }
    if (normalized.includes("ontem")) {
      return new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    }
    const dayMatch = normalized.match(/dia\s+(\d{1,2})/);
    if (dayMatch) {
      const day = Number(dayMatch[1]);
      if (!Number.isFinite(day) || day < 1 || day > 31) return null;
      let target = new Date(now.getFullYear(), now.getMonth(), day);
      if (target.getTime() < now.getTime()) {
        target = new Date(now.getFullYear(), now.getMonth() + 1, day);
      }
      return target;
    }
    const explicitMatch = normalized.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (explicitMatch) {
      const day = Number(explicitMatch[1]);
      const month = Number(explicitMatch[2]) - 1;
      const year = explicitMatch[3] ? Number(explicitMatch[3].length === 2 ? "20" + explicitMatch[3] : explicitMatch[3]) : now.getFullYear();
      const candidate = new Date(year, month, day);
      if (Number.isNaN(candidate.getTime())) return null;
      return candidate;
    }
    return null;
  };

  const detectTransactionTypeFromText = (content: string): "income" | "expense" | null => {
    const normalized = content.toLowerCase();
    const incomeKeywords = ["recebi", "receber", "ganhei", "caiu", "entrou", "pagaram", "depositaram", "entrada"];
    const expenseKeywords = ["paguei", "pagar", "gastei", "despesa", "boleto", "saída", "saida", "transferi", "comprar", "conta"];
    if (incomeKeywords.some((keyword) => normalized.includes(keyword))) return "income";
    if (expenseKeywords.some((keyword) => normalized.includes(keyword))) return "expense";
    return null;
  };

  const detectAccountTypeFromText = (content: string, userPlan: string): "PF" | "PJ" | null => {
    const normalized = content.toLowerCase();
    const pjKeywords = [
      "empresa",
      "empresarial",
      "escritório",
      "escritorio",
      "consultório",
      "consultorio",
      "loja",
      "cnpj",
      "mei",
      "nota fiscal",
      "cliente pj",
      "cliente",
      "fornecedor",
      "emitir nfe",
      "mei/pj",
      "sala comercial",
      "venda",
      "faturamento",
      "contrato",
      "prestação de serviço",
      "serviço para empresa",
    ];
    const pfKeywords = ["pessoal", "pf", "casa", "família", "familia", "particular"];

    if (userPlan !== "premium") return "PF";

    const tokens = normalized.split(/\s+/);
    if (tokens.includes("pj")) return "PJ";
    if (tokens.includes("pf")) return "PF";

    if (pjKeywords.some((keyword) => normalized.includes(keyword))) {
      return "PJ";
    }
    if (pfKeywords.some((keyword) => normalized.includes(keyword))) {
      return "PF";
    }

    return null;
  };

  const inferTypeFromHistory = (messages: ConversationMessage[]): "income" | "expense" | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role !== "user") continue;
      if (i === messages.length - 1) continue;
      const type = detectTransactionTypeFromText(message.content);
      if (type) {
        return type;
      }
    }
    return null;
  };

  const inferAccountTypeFromHistory = (
    messages: ConversationMessage[],
    userPlan: string
  ): "PF" | "PJ" | null => {
    if (userPlan !== "premium") {
      return "PF";
    }
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role !== "user") continue;
      if (i === messages.length - 1) continue;
      const accountType = detectAccountTypeFromText(message.content, userPlan);
      if (accountType) {
        return accountType;
      }
    }
    return null;
  };

  const isAffirmativeWord = (content: string) => {
    const normalized = content.trim().toLowerCase();
    return ["sim", "claro", "pode", "ok", "certo"].includes(normalized);
  };

  const ensureAccountTypeInMemory = (state: ConversationState, userPlan: string) => {
    if (!state.memory.accountType) {
      if (userPlan !== "premium") {
        state.memory.accountType = "PF";
      }
    }
  };

  const fillMemoryFromInterpretation = (state: ConversationState, interpretation?: AiInterpretationSuccess) => {
    if (!interpretation) return;
    const tx = interpretation.transaction;
    if (tx.amount && state.memory.amount === undefined) {
      state.memory.amount = Number(tx.amount);
    }
    if (tx.type && !state.memory.type) {
      state.memory.type = tx.type;
    }
    if (tx.date && !state.memory.date) {
      state.memory.date = tx.date;
      state.memory.dueDate = tx.date;
    }
    if (tx.description && !state.memory.description) {
      state.memory.description = tx.description;
    }
    if (tx.accountType && !state.memory.accountType) {
      state.memory.accountType = tx.accountType;
    }
    if (tx.category && !state.memory.category) {
      state.memory.category = tx.category;
    }
    if (typeof tx.isScheduled === "boolean") {
      if (tx.isScheduled) {
        state.memory.isScheduled = true;
      } else if (state.memory.isScheduled === undefined) {
        state.memory.isScheduled = false;
      }
    }
    if (tx.dueDate && !state.memory.dueDate) {
      state.memory.dueDate = tx.dueDate;
    }
  };

  const applyHeuristicsFromContent = (state: ConversationState, content: string, userPlan: string) => {
    const amountFromText = extractAmountFromText(content);
    if (!state.memory.amount && amountFromText !== null) {
      state.memory.amount = amountFromText;
    }
    const typeFromText = detectTransactionTypeFromText(content);
    if (!state.memory.type && typeFromText) {
      state.memory.type = typeFromText;
    }
    const dateFromText = parseDateFromText(content);
    if (!state.memory.date && dateFromText) {
      state.memory.date = dateFromText.toISOString();
      state.memory.dueDate = state.memory.date;
    }
    if (!state.memory.accountType) {
      const detectedAccountType = detectAccountTypeFromText(content, userPlan);
      if (detectedAccountType) {
        state.memory.accountType = detectedAccountType;
      }
    }
    if (!state.memory.accountType && userPlan === "premium" && state.memory.description) {
      const desc = state.memory.description.toLowerCase();
      const inferred = detectAccountTypeFromText(desc, userPlan);
      if (inferred) {
        state.memory.accountType = inferred;
      }
    }
    const scheduled = detectScheduledKeyword(content);
    if (scheduled) {
      state.memory.isScheduled = true;
      if (state.memory.date) {
        state.memory.dueDate = state.memory.date;
      }
    }
    if (!state.memory.description && state.step === "collecting_description") {
      const trimmed = content.trim();
      if (trimmed.length > 2 && !isAffirmativeWord(trimmed)) {
        state.memory.description = trimmed;
      }
    }
  };

  const buildCandidateFromState = (state: ConversationState): CandidateTransaction | null => {
    if (!hasAllConversationData(state.memory)) {
      return null;
    }
    const type = state.memory.type || "expense";
    const accountType = state.memory.accountType || "PF";
    const description = state.memory.description || "";
    const amount = state.memory.amount || 0;
    const isoDate = state.memory.date!;
    const category =
      state.memory.category ||
      pickCategory(state.memory.category, accountType, type, description);

    return {
      type,
      description,
      amount,
      date: isoDate,
      accountType,
      category,
      isScheduled: Boolean(state.memory.isScheduled),
      dueDate: state.memory.dueDate || isoDate,
    };
  };

  const registerPendingActionForCandidate = (
    userId: string,
    candidate: CandidateTransaction,
    intentOverride?: "income" | "expense"
  ) => {
    if (candidate.isScheduled) {
      pendingActions.set(userId, { kind: "future", candidate, intent: intentOverride || candidate.type });
    } else {
      pendingActions.set(userId, { kind: "transaction", candidate });
    }
  };

  type PendingActionResult = {
    assistantText: string;
    transaction?: Transaction | null;
    futureTransaction?: FutureTransaction | null;
    recurringTransaction?: RecurringTransaction | null;
  };

  // O prompt conversacional é construído dinamicamente com contexto do usuário
  // Ver ai/conversationalPrompt.ts

type AiInterpretationSuccess = {
  status: "success";
  conversationalMessage?: string; // Mensagem humanizada da IA
  transaction: {
    type: "income" | "expense";
    description: string;
    amount: number;
    date: string;
    accountType: "PF" | "PJ";
    category: string;
    isScheduled?: boolean;
    dueDate?: string;
  };
};

type AiInterpretationResult =
  | AiInterpretationSuccess
  | {
      status: "clarify";
      conversationalMessage?: string; // Mensagem humanizada da IA
      message?: string; // Fallback para compatibilidade
    };

  const sanitizeAiJson = (raw: string) => {
    if (!raw) return "";
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) {
      return cleaned;
    }
    return cleaned.slice(firstBrace, lastBrace + 1);
  };

  const normalizeCategoryCandidate = (
    candidate: string | undefined,
    accountType: "PF" | "PJ",
    txType: "income" | "expense"
  ) => {
    if (!candidate) return undefined;
    const allowed = AI_ALLOWED_CATEGORIES[accountType][txType];
    return allowed.find((cat) => cat.toLowerCase() === candidate.toLowerCase());
  };

  const inferCategoryFromDescription = (
    description: string,
    accountType: "PF" | "PJ",
    txType: "income" | "expense"
  ) => {
    const normalized = description.toLowerCase();
    const hint = CATEGORY_HINTS.find(
      (item) =>
        item.scope === accountType &&
        item.type === txType &&
        item.keywords.some((keyword) => normalized.includes(keyword))
    );
    return hint?.category;
  };

  const pickCategory = (
    candidate: string | undefined,
    accountType: "PF" | "PJ",
    txType: "income" | "expense",
    description: string
  ) => {
    const normalizedCandidate = normalizeCategoryCandidate(candidate, accountType, txType);
    if (normalizedCandidate) return normalizedCandidate;
    const hinted = inferCategoryFromDescription(description, accountType, txType);
    if (hinted) return hinted;
    return DEFAULT_CATEGORY[accountType][txType];
  };

  const detectFutureIntent = (content: string): "income" | "expense" | null => {
    const normalized = content.toLowerCase();
    const futureExpensePatterns = [
      /vou\s+(ter\s+que\s+)?pagar/,
      /tenho\s+que\s+pagar/,
      /preciso\s+pagar/,
      /vou\s+pagar/,
      /vou\s+precisar\s+pagar/,
    ];
    const futureIncomePatterns = [
      /vou\s+(receber|ganhar)/,
      /tenho\s+que\s+receber/,
      /devo\s+receber/,
      /vou\s+emitir/,
    ];
    if (futureIncomePatterns.some((regex) => regex.test(normalized))) {
      return "income";
    }
    if (futureExpensePatterns.some((regex) => regex.test(normalized))) {
      return "expense";
    }
    return null;
  };

  const detectScheduledKeyword = (content: string): boolean => {
    const normalized = content.toLowerCase();
    const scheduledPatterns = [
      /vou\s+ter\s+que\s+pagar/,
      /conta\s+do\s+m[êe]s\s+que\s+vem/,
      /conta\s+do\s+pr[oó]ximo\s+m[êe]s/,
      /preciso\s+separar\s+dinheiro/,
      /separar\s+dinheiro/,
      /preciso\s+reservar/,
      /vou\s+reservar/,
    ];
    return scheduledPatterns.some((regex) => regex.test(normalized));
  };

  const detectRecurringFrequency = (content: string): "monthly" | "weekly" | null => {
    const normalized = content.toLowerCase();
    const monthlyPatterns = [
      /todo\s+m[êe]s/,
      /toda\s+m[êe]s/,
      /mensal/,
      /mensalmente/,
      /dia\s+\d+/,
      /sal[aá]rio/,
      /assinatura/,
      /streaming/,
      /netflix/,
      /spotify/,
      /mensalidade/,
      /aluguel/,
    ];
    const weeklyPatterns = [
      /toda\s+semana/,
      /toda\s+seman[ao]/,
      /semanal/,
      /semanalmente/,
      /toda\s+segunda/,
      /toda\s+ter[cç]a/,
      /toda\s+quarta/,
      /toda\s+quinta/,
      /toda\s+sexta/,
    ];

    if (weeklyPatterns.some((regex) => regex.test(normalized))) {
      return "weekly";
    }
    if (monthlyPatterns.some((regex) => regex.test(normalized))) {
      return "monthly";
    }
    return null;
  };

  const detectConfirmationIntent = (content: string): "confirm" | "cancel" | null => {
    const cleaned = content
      .toLowerCase()
      .replace(/[!?.]/g, "")
      .replace(/,/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return null;
    const words = cleaned.split(" ");
    if (words.length > 4) {
      return null;
    }
    const confirmKeywords = ["sim", "confirmo", "pode salvar", "pode confirmar", "ok", "pode registrar", "confirma"];
    const cancelKeywords = ["não", "nao", "cancela", "cancelar", "desconsidera", "descarta"];

    const matchesKeyword = (value: string, keywords: string[]) =>
      keywords.some((keyword) => value === keyword || value === `${keyword} sim` || value === `${keyword} por favor`);

    if (matchesKeyword(cleaned, confirmKeywords)) {
      return "confirm";
    }
    if (matchesKeyword(cleaned, cancelKeywords)) {
      return "cancel";
    }
    return null;
  };

  const detectResetIntent = (content: string): boolean => {
    const normalized = content
      .toLowerCase()
      .replace(/[!?.]/g, "")
      .replace(/,+/g, "")
      .trim();
    if (!normalized) return false;
    const resetKeywords = [
      "reset",
      "resetar",
      "reinicia",
      "reiniciar",
      "começar do zero",
      "começar de novo",
      "vamos do zero",
      "volta do zero",
      "comece do 0",
      "começa do zero",
    ];
    return resetKeywords.some((keyword) => normalized.includes(keyword));
  };

  const describeCandidate = (candidate: CandidateTransaction) => {
    const reference = candidate.dueDate || candidate.date;
    const date = reference ? new Date(reference) : new Date();
    const scheduledTag = candidate.isScheduled ? " (planejado)" : "";
    return `${candidate.type === "income" ? "Entrada" : "Saída"} de ${formatCurrencyBRL(candidate.amount)} em ${formatPtDate(
      date
    )} (${candidate.category}) na ${scopeLabels[candidate.accountType]}${scheduledTag}`;
  };

  const buildPendingSummary = (action: PendingAction) => {
    const base = describeCandidate(action.candidate);
    if (action.kind === "recurring") {
      const label = action.frequency === "monthly" ? "mensal" : "semanal";
      return `${base} marcada como recorrente ${label}. Confirma esta transação?`;
    }
    if (action.kind === "future") {
      const verb = action.intent === "expense" ? "pagar" : "receber";
      if (action.candidate.isScheduled) {
        return `${base} programada para ${verb}. Confirma este compromisso futuro?`;
      }
      return `${base} para ${verb} no futuro. Confirma esta previsão?`;
    }
    return `${base}. Confirma esta transação?`;
  };

  async function executePendingAction(action: PendingAction, user: User): Promise<PendingActionResult> {
    try {
      if (action.kind === "future") {
        let expectedDate = new Date(action.candidate.dueDate || action.candidate.date || Date.now());
        if (Number.isNaN(expectedDate.getTime())) {
          expectedDate = new Date();
        }
        const isScheduled = Boolean(action.candidate.isScheduled);
        const record = await storage.createFutureTransaction({
          userId: user.id,
          type: action.intent,
          description: action.candidate.description,
          amount: action.candidate.amount,
          expectedDate,
          accountType: action.candidate.accountType,
          status: "pending",
          isScheduled,
          dueDate: expectedDate,
        });
        const verb = action.intent === "expense" ? "precisa pagar" : "vai receber";
        const scheduledNote = isScheduled ? " (planejado)" : "";
        return {
          assistantText: `Anotado! Registrei que você ${verb} ${formatCurrencyBRL(
            action.candidate.amount
          )} em ${formatPtDate(expectedDate)}${scheduledNote} na ${scopeLabels[action.candidate.accountType]}.`,
          futureTransaction: record,
        };
      }

      await ensureDefaultAccounts(user.id, user.plan);
      const accounts = await storage.getAccountsByUserId(user.id);
      const targetAccount = accounts.find(
        (acc) => acc.type?.toLowerCase() === action.candidate.accountType.toLowerCase()
      );

      if (!targetAccount) {
        return {
          assistantText: "Não encontrei uma conta compatível para registrar isso agora. Tente novamente em alguns segundos.",
        };
      }

      if (action.kind === "transaction") {
        let transactionDate = new Date(action.candidate.date || Date.now());
        if (Number.isNaN(transactionDate.getTime())) {
          transactionDate = new Date();
        }
        const transaction = await storage.createTransaction({
          userId: user.id,
          accountId: targetAccount.id,
          description: action.candidate.description,
          type: action.candidate.type === "income" ? "entrada" : "saida",
          amount: action.candidate.amount,
          category: action.candidate.category,
          date: transactionDate,
          accountType: action.candidate.accountType,
          source: "ai",
        });
        return {
          assistantText: `Perfeito! Registrei ${action.candidate.description} em ${formatPtDate(transactionDate)}.`,
          transaction,
        };
      }

      if (action.kind === "recurring") {
        let referenceDate = new Date(action.candidate.date || Date.now());
        if (Number.isNaN(referenceDate.getTime())) {
          referenceDate = new Date();
        }
        if (action.immediateReceipt) {
          referenceDate = new Date();
        }
        const nextDate = computeNextOccurrence(referenceDate, action.frequency);
        const recurringRecord = await storage.createRecurringTransaction({
          userId: user.id,
          type: action.candidate.type,
          description: action.candidate.description,
          amount: action.candidate.amount,
          frequency: action.frequency,
          nextDate,
          accountType: action.candidate.accountType,
        });

        let futureRecord: FutureTransaction | null = null;
        try {
          futureRecord = await storage.createFutureTransaction({
            userId: user.id,
            type: action.candidate.type,
            description: action.candidate.description,
            amount: action.candidate.amount,
            expectedDate: nextDate,
            accountType: action.candidate.accountType,
            status: "pending",
            isScheduled: true,
            dueDate: nextDate,
          });
        } catch (error) {
          console.error("[AI CLIENT] erro ao criar previsão recorrente:", error);
        }

        let createdTransaction: Transaction | null = null;
        const shouldInsertNow = action.immediateReceipt || referenceDate <= new Date();
        if (shouldInsertNow) {
          try {
            createdTransaction = await storage.createTransaction({
              userId: user.id,
              accountId: targetAccount.id,
              description: action.candidate.description,
              type: action.candidate.type === "income" ? "entrada" : "saida",
              amount: action.candidate.amount,
              category: action.candidate.category,
              date: referenceDate,
              accountType: action.candidate.accountType,
              source: "ai",
            });
          } catch (error) {
            console.error("[AI CLIENT] erro ao registrar transação recorrente atual:", error);
          }
        }

        const recurringLabel = action.frequency === "monthly" ? "mensal" : "semanal";
        const immediateMsg = createdTransaction ? ", e já lancei o valor deste período" : "";
        return {
          assistantText: `Perfeito! Anotei ${action.candidate.description} como recorrência ${recurringLabel}${immediateMsg}.`,
          transaction: createdTransaction,
          futureTransaction: futureRecord,
          recurringTransaction: recurringRecord,
        };
      }

      return { assistantText: "Não consegui processar esta operação agora. Tente novamente em instantes." };
    } catch (error) {
      console.error("[AI CLIENT] erro ao confirmar ação pendente:", error);
      return { assistantText: "Algo deu errado ao registrar. Pode tentar novamente em alguns segundos?" };
    }
  }
  const resolveRelativeDateFromContent = (content: string): Date | null => {
    const normalized = content.toLowerCase();
    const now = new Date();
    if (normalized.includes("hoje")) {
      return now;
    }
    if (normalized.includes("ontem")) {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    if (normalized.includes("semana passada")) {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    return null;
  };

  const detectImmediateReceipt = (content: string): boolean => {
    const normalized = content.toLowerCase();
    const keywords = [
      "recebi",
      "recebido",
      "caiu",
      "entrou",
      "pix",
      "pagaram",
      "depositaram",
      "me pagaram",
      "ganhei",
    ];
    return keywords.some((keyword) => normalized.includes(keyword));
  };

  const computeNextOccurrence = (baseDate: Date, frequency: "monthly" | "weekly") => {
    const reference = new Date(baseDate);
    const now = new Date();
    let nextDate = reference;
    if (nextDate < now) {
      nextDate = new Date(reference);
      while (nextDate < now) {
        if (frequency === "monthly") {
          nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, nextDate.getDate());
        } else {
          nextDate = new Date(nextDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        }
      }
    }
    return nextDate;
  };

  type ConversationMessage = {
    role: "user" | "assistant";
    content: string;
  };

  const fetchRecentConversation = async (userId: string, limit = 6): Promise<ConversationMessage[]> => {
    try {
      const { data, error } = await supabase
        .from("ai_messages")
        .select("role, content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error || !data) {
        if (error) {
          console.warn("[AI CLIENT] não foi possível carregar histórico para contexto:", error);
        }
        return [];
      }
      return data
        .map((row) => ({
          role: row.role === "assistant" ? "assistant" : "user",
          content: row.content || "",
        }))
        .reverse();
    } catch (error) {
      console.warn("[AI CLIENT] falha ao buscar histórico de contexto:", error);
      return [];
    }
  };

  const interpretTransactionFromMessage = async (
    content: string,
    conversation: ConversationMessage[],
    userId: string,
    userFinancialContext?: string
  ): Promise<AiInterpretationResult> => {
    if (!OPENAI_API_KEY) {
      return {
        status: "clarify",
        message: "Para registrar automaticamente preciso da variável OPENAI_API_KEY configurada no servidor.",
      };
    }

    try {
      // Construir prompt conversacional com contexto financeiro do usuário
      const conversationalPrompt = buildConversationalPrompt(AI_CATEGORY_TEXT, userFinancialContext);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: conversationalPrompt },
            ...conversation.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            { role: "user", content },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[AI CLIENT] OpenAI response error:", errorText);
        return {
          status: "clarify",
          message: "Não consegui falar com a IA agora. Pode tentar novamente em instantes?",
        };
      }

      const completion = await response.json();
      const rawContent = completion?.choices?.[0]?.message?.content?.trim();
      if (!rawContent) {
        return {
          status: "clarify",
          message: "Não consegui entender essa mensagem. Pode enviar com valor, tipo e data?",
        };
      }

      console.log("[AI DEBUG] Raw response from OpenAI:", rawContent);
      const jsonPayload = sanitizeAiJson(rawContent);
      console.log("[AI DEBUG] Sanitized JSON:", jsonPayload);

      let parsed: any;
      try {
        parsed = JSON.parse(jsonPayload);
      } catch (error) {
        console.warn("[AI CLIENT] não consegui converter resposta da IA em JSON:", jsonPayload);
        return {
          status: "clarify",
          message: "Preciso de mais detalhes (valor, descrição e data) para registrar essa movimentação.",
        };
      }

      if (parsed.status && String(parsed.status).toLowerCase() !== "success") {
        return {
          status: "clarify",
          message:
            parsed.message ||
            "Ainda não entendi. Informe valor, descrição e se é gasto ou receita (PF ou PJ).",
        };
      }

      const payload = parsed.transaction ?? parsed;
      if (!payload) {
        return {
          status: "clarify",
          message: "Não encontrei uma transação clara nessa mensagem. Pode repetir com mais detalhes?",
        };
      }

      const typeText = String(payload.type || "").toLowerCase();
      const scheduledKeyword = detectScheduledKeyword(content);
      const inferredFutureIntent = detectFutureIntent(content);
      let normalizedType: "income" | "expense" | undefined =
        typeText === "income" ? "income" : typeText === "expense" ? "expense" : undefined;
      let isScheduledCandidate = false;

      if (typeText === "scheduled") {
        isScheduledCandidate = true;
      }

      if (isScheduledCandidate) {
        if (!normalizedType && inferredFutureIntent) {
          normalizedType = inferredFutureIntent;
        }
        if (!normalizedType) {
          return {
            status: "clarify",
            message: "Essa conta futura é um pagamento ou um recebimento?",
          };
        }
      } else if (!normalizedType && scheduledKeyword && inferredFutureIntent) {
        normalizedType = inferredFutureIntent;
        isScheduledCandidate = true;
      }

      if (!normalizedType) {
        return {
          status: "clarify",
          message: "É uma entrada ou saída? Conte se recebeu ou gastou dinheiro.",
        };
      }

      const description = String(payload.description || "").trim();
      if (!description) {
        return {
          status: "clarify",
          message: "Preciso de uma descrição curta (ex.: mercado, salário, fornecedor).",
        };
      }

      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return {
          status: "clarify",
          message: "Qual é o valor da movimentação?",
        };
      }

      const accountType = String(payload.account_type || payload.accountType || "PF").toUpperCase() === "PJ" ? "PJ" : "PF";
      const dateCandidate = payload.due_date || payload.dueDate || payload.date || payload.when;
      let parsedDate: Date | null = null;
      if (dateCandidate) {
        const candidateDate = new Date(dateCandidate);
        if (!Number.isNaN(candidateDate.getTime())) {
          parsedDate = candidateDate;
        }
      }

      if (!parsedDate && !isScheduledCandidate) {
        const relative = resolveRelativeDateFromContent(content);
        if (relative) {
          parsedDate = relative;
        }
      }

      if (!parsedDate) {
        return {
          status: "clarify",
          message: isScheduledCandidate
            ? "Qual é a data futura dessa movimentação?"
            : "Qual é a data dessa movimentação?",
        };
      }

      if (isScheduledCandidate && parsedDate.getTime() <= Date.now()) {
          return {
            status: "clarify",
            message: "Para agendar preciso de uma data no futuro. Informe dia/mês/ano.",
          };
      }

      const category = pickCategory(
        payload.category ? String(payload.category) : undefined,
        accountType,
        normalizedType,
        description
      );

      const isoDate = parsedDate.toISOString();

      return {
        status: "success",
        conversationalMessage: parsed.conversationalMessage, // Preservar mensagem da IA
        transaction: {
          type: normalizedType,
          description,
          amount: Math.abs(amount),
          date: isoDate,
          accountType,
          category,
          isScheduled: isScheduledCandidate,
          dueDate: isScheduledCandidate ? isoDate : undefined,
        },
      };
    } catch (error) {
      console.error("[AI CLIENT] erro ao conversar com a OpenAI:", error);
      return {
        status: "clarify",
        message: "A IA falhou desta vez. Reenvie a mensagem em alguns segundos, por favor.",
      };
    }
  };

  async function ensureDefaultAccounts(userId: string, plan: string) {
    const accounts = await storage.getAccountsByUserId(userId);
    const hasPF = accounts.some((account) => account.type?.toLowerCase() === "pf");
    const hasPJ = accounts.some((account) => account.type?.toLowerCase() === "pj");

    if (!hasPF) {
      await storage.createAccount({
        userId,
        name: "Conta pessoal",
        type: "pf",
        initialBalance: 0,
      });
    }

    if (plan === "premium" && !hasPJ) {
      await storage.createAccount({
        userId,
        name: "Conta empresarial",
        type: "pj",
        initialBalance: 0,
      });
    }
  }

  app.post("/api/pdf/export", requireAuth, requireActiveBilling, premiumRequired, async (req: any, res) => {
    const { type = "financeiro", period = "últimos 30 dias", includeCharts = true, includeInsights = true, accountScope } = req.body || {};

    try {
      const user = req.currentUser || (await storage.getUser(req.session.userId));
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      const normalizedLabel = String(type).toLowerCase();
      const scopeFromBody = parseAccountScope(accountScope);
      let scope: AccountScope = "ALL";
      if (normalizedLabel.includes("empresarial")) {
        scope = "PJ";
      } else if (normalizedLabel.includes("financeiro")) {
        scope = "PF";
      } else if (scopeFromBody) {
        scope = scopeFromBody;
      }

      if (!ensureScopeAccess(scope, req, res)) {
        return;
      }

      const [metrics, transactions, categories] = await Promise.all([
        storage.getDashboardMetrics(req.session.userId, scope),
        storage.getTransactionsByUserId(req.session.userId, scope),
        storage.getCategoryBreakdown(req.session.userId, scope),
      ]);

      const insights = includeInsights ? buildPremiumInsights(transactions) : [];
      const chartImage = includeCharts ? buildChartImage(categories) : null;
      const [forecast, aiInsights] = await Promise.all([
        computeCashflowForecast(req.session.userId, scope),
        generateAiInsights(req.session.userId, scope),
      ]);
      const html = buildReportHtml({
        user,
        type,
        period,
        metrics,
        categories,
        transactions,
        chartImage,
        includeCharts,
        insights,
        forecast,
        aiInsights,
      });

      const protocolTimeout = Number(process.env.PUPPETEER_PROTOCOL_TIMEOUT || "90000");
      const browser = await puppeteer.launch({
        headless: "new",
        executablePath: puppeteerExecutable ?? undefined,
        protocolTimeout,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-software-rasterizer",
          "--single-process",
          "--no-zygote",
        ],
        dumpio: process.env.NODE_ENV !== "production",
      });
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(protocolTimeout);
      page.setDefaultTimeout(protocolTimeout);
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", bottom: "20mm", left: "12mm", right: "12mm" },
      });
      await browser.close();

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=finscope-report.pdf",
        "Content-Length": pdfBuffer.length,
      });
      res.end(pdfBuffer, "binary");
      return;
    } catch (error) {
      console.error("[PDF EXPORT] erro ao gerar PDF:", error);
      return res.status(500).json({ error: "Não foi possível gerar o PDF agora." });
    }
  });

  // Middleware to check authentication
  function requireAuth(req: any, res: any, next: any) {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    next();
  }

  async function requireActiveBilling(req: any, res: any, next: any) {
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      await ensureDefaultAccounts(user.id, user.plan);
      req.currentUser = user;
      
      // Allow access if billing is active OR user is in trial period
      const isInTrial = user.trialEnd && new Date(user.trialEnd) > new Date();
      const hasActiveBilling = user.billingStatus === "active";
      
      if (!hasActiveBilling && !isInTrial) {
        return res.status(403).json({ error: "Pagamento pendente" });
      }
      next();
    } catch (error) {
      next(error);
    }
  }

  function premiumRequired(req: any, res: any, next: any) {
    const user = req.currentUser;
    if (!user || user.plan !== "premium") {
      return res.status(403).json({ error: "Recurso disponível apenas no plano Premium" });
    }
    next();
  }


  // ===== AUTH ROUTES =====

    app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório" });
    }

    const user = await storage.getUserByEmail(email);

    // Não revelar caso o email não exista
    if (!user) {
      console.log("[FORGOT] Email não encontrado, retornando sucesso genérico");
      return res.json({ success: true });
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    console.log("[FORGOT] Gerando token de reset:", {
      userId: user.id,
      token,
      expiresAt: expiresAt.toISOString(),
    });

    await supabase.from("password_reset_tokens").insert({
      user_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
    });

    const resetLink = `${process.env.APP_URL}/reset-password?token=${token}`;
    console.log("[FORGOT] Link de reset gerado:", resetLink);

    await sendResetEmail(email, resetLink);

    return res.json({ success: true });
  });


  app.get("/api/auth/reset-password/validate", async (req, res) => {
    const token = req.query.token?.toString();

    console.log("[RESET VALIDATE] Query recebida:", req.query);
    console.log("[RESET VALIDATE] Token recebido:", token);

    if (!token) {
      console.log("[RESET VALIDATE] Nenhum token informado");
      return res.status(400).json({ error: "Token inválido" });
    }

    const { data: tokenData, error } = await supabase
      .from("password_reset_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    console.log("[RESET VALIDATE] Resultado Supabase:", {
      tokenData,
      error,
    });

    if (error) {
      console.error("[RESET VALIDATE] Erro Supabase:", error);
      return res.status(500).json({ error: "Erro ao validar token" });
    }

    if (!tokenData) {
      console.log("[RESET VALIDATE] Nenhum registro encontrado para o token");
      return res.status(400).json({ error: "Token inválido ou expirado" });
    }

    const now = new Date();
    const expires = new Date(tokenData.expires_at);

    console.log("[RESET VALIDATE] Datas:", {
      agora: now.toISOString(),
      expiraEm: expires.toISOString(),
    });

    if (expires < now) {
      console.log("[RESET VALIDATE] Token expirado");
      return res.status(400).json({ error: "Token inválido ou expirado" });
    }

    return res.json({ valid: true });
  });


  app.post("/api/auth/reset-password", async (req, res) => {
  console.log("[RESET POST] Body recebido:", req.body);

  const { token, password, confirmPassword } = req.body;

  if (!token || !password || !confirmPassword) {
    console.log("[RESET POST] Campo faltando");
    return res.status(400).json({ error: "Dados inválidos" });
  }

  if (password !== confirmPassword) {
    console.log("[RESET POST] As senhas não coincidem!");
    return res.status(400).json({ error: "As senhas não coincidem" });
  }

  // Verifica token no Supabase
  const { data: tokenData, error: tokenError } = await supabase
    .from("password_reset_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  console.log("[RESET POST] Token no banco:", tokenData);

  if (!tokenData || tokenError) {
    return res.status(400).json({ error: "Token inválido" });
  }

  const agora = new Date();
  const expiraEm = new Date(tokenData.expires_at);

  if (agora > expiraEm) {
    return res.status(400).json({ error: "Token expirado" });
  }

  // Hash da nova senha
  const hashed = await bcrypt.hash(password, 10);

  // Atualiza o usuário
  await supabase
    .from("users")
    .update({ password: hashed })
    .eq("id", tokenData.user_id);

  // Remove o token
  await supabase
    .from("password_reset_tokens")
    .delete()
    .eq("token", token);

  console.log("[RESET POST] Senha atualizada com sucesso!");

  res.json({ success: true });
});


  // Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const user = await storage.createUser(data);
      
      // Create session and save it
      req.session.userId = user.id;
      
      console.log('[DEBUG] Session before save:', req.session.id, 'userId:', req.session.userId);
      
      req.session.save((err) => {
        if (err) {
          console.error('[ERROR] Failed to save session:', err);
          return res.status(500).json({ error: "Erro ao criar sessão" });
        }

        console.log('[DEBUG] Session saved successfully, ID:', req.session.id);
        
        // Create a new object without password to avoid read-only property errors
        const userWithoutPassword = {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          plan: user.plan,
          trialStart: user.trialStart,
          trialEnd: user.trialEnd,
          caktoSubscriptionId: user.caktoSubscriptionId,
          billingStatus: user.billingStatus,
          createdAt: user.createdAt,
        };
        
        res.json({ user: userWithoutPassword });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = await storage.verifyPassword(data.email, data.password);
      
      if (!user) {
        return res.status(401).json({ error: "Email ou senha incorretos" });
      }

      // Regenerate session on login (security best practice)
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ error: "Erro ao criar sessão" });
        }

        req.session.userId = user.id;
        
        // Create a new object without password to avoid read-only property errors
        const userWithoutPassword = {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          plan: user.plan,
          trialStart: user.trialStart,
          trialEnd: user.trialEnd,
          caktoSubscriptionId: user.caktoSubscriptionId,
          billingStatus: user.billingStatus,
          createdAt: user.createdAt,
        };
        res.json({ user: userWithoutPassword });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos" });
      }
      res.status(500).json({ error: "Erro interno" });
    }
  });

  // Get current user
  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Create a new object without password to avoid read-only property errors
      const userWithoutPassword = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        plan: user.plan,
        trialStart: user.trialStart,
        trialEnd: user.trialEnd,
        caktoSubscriptionId: user.caktoSubscriptionId,
        billingStatus: user.billingStatus,
        createdAt: user.createdAt,
      };
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Erro interno" });
    }
  });

  // Logout
  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Erro ao fazer logout" });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });

  // ===== ACCOUNT ROUTES =====
  
  // Get all accounts for user
  app.get("/api/accounts", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const accounts = await storage.getAccountsByUserId(req.session.userId);
      const filtered = req.currentUser?.plan === "premium"
        ? accounts
        : accounts.filter((account) => account.type !== "pj");
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar contas" });
    }
  });
  app.post("/api/accounts/ensure-default", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      await ensureDefaultAccounts(req.session.userId, req.currentUser.plan);
      const accounts = await storage.getAccountsByUserId(req.session.userId);
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: "Erro ao garantir contas padrão" });
    }
  });

  // Get single account
  app.get("/api/accounts/:id", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account || account.userId !== req.session.userId) {
        return res.status(404).json({ error: "Conta não encontrada" });
      }
      if (account.type === "pj" && req.currentUser?.plan !== "premium") {
        return res.status(403).json({ error: "Contas PJ disponíveis apenas no plano Premium" });
      }
      res.json(account);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar conta" });
    }
  });

  // Create account
  app.post("/api/accounts", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      // Parse the request body without userId first
      const validatedData = insertAccountSchema.parse(req.body);

      // Add userId from session after validation
      const dataWithUserId = {
        ...validatedData,
        userId: req.session.userId,
      };

      if (validatedData.type === "pj" && req.currentUser?.plan !== "premium") {
        return res.status(403).json({ error: "Contas PJ disponíveis apenas no plano Premium" });
      }

      const account = await storage.createAccount(dataWithUserId);
      res.json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Update account
  app.patch("/api/accounts/:id", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account || account.userId !== req.session.userId) {
        return res.status(404).json({ error: "Conta não encontrada" });
      }
      if (account.type === "pj" && req.currentUser?.plan !== "premium") {
        return res.status(403).json({ error: "Contas PJ disponíveis apenas no plano Premium" });
      }

      // Strict validation - only allow name and type updates
      const updates = updateAccountSchema.parse(req.body);
      const updated = await storage.updateAccount(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Delete account
  app.delete("/api/accounts/:id", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account || account.userId !== req.session.userId) {
        return res.status(404).json({ error: "Conta não encontrada" });
      }
      if (account.type === "pj" && req.currentUser?.plan !== "premium") {
        return res.status(403).json({ error: "Contas PJ disponíveis apenas no plano Premium" });
      }

      await storage.deleteAccount(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ===== TRANSACTION ROUTES =====
  
  // Get all transactions for user
  app.get("/api/transactions", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const scope = parseAccountScope(req.query?.type);
      if (!ensureScopeAccess(scope, req, res)) {
        return;
      }
      const transactions = await storage.getTransactionsByUserId(req.session.userId, scope);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar transações" });
    }
  });

  // Get transactions by account
  app.get("/api/accounts/:accountId/transactions", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      if (!account || account.userId !== req.session.userId) {
        return res.status(404).json({ error: "Conta não encontrada" });
      }
      if (account.type === "pj" && req.currentUser?.plan !== "premium") {
        return res.status(403).json({ error: "Transações de contas PJ disponíveis apenas no plano Premium" });
      }

      const transactions = await storage.getTransactionsByAccountId(req.params.accountId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar transações" });
    }
  });

  // Create transaction
  app.post("/api/transactions", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const accountId = req.body.accountId;
      if (!accountId) {
        return res.status(400).json({ error: "Conta é obrigatória" });
      }
      const account = await storage.getAccount(accountId);
      if (!account || account.userId !== req.session.userId) {
        return res.status(404).json({ error: "Conta não encontrada" });
      }
      const requestedAccountType = normalizeAccountType(req.body?.accountType ?? (account.type === "pj" ? "PJ" : "PF"));
      if (requestedAccountType === "PJ" && req.currentUser?.plan !== "premium") {
        return res.status(403).json({ error: "Transações em contas PJ disponíveis apenas no plano Premium" });
      }

      const data = insertTransactionSchema.parse({
        ...req.body,
        userId: req.session.userId,
        accountType: requestedAccountType,
        source: "manual",
      });
      const transaction = await storage.createTransaction({ ...data, accountId, accountType: requestedAccountType, source: "manual" });
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Update transaction
  app.patch("/api/transactions/:id", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction || transaction.userId !== req.session.userId) {
        return res.status(404).json({ error: "Transação não encontrada" });
      }
      const transactionAccount = await storage.getAccount(transaction.accountId);
      if (!transactionAccount) {
        return res.status(404).json({ error: "Conta não encontrada" });
      }
      if (transactionAccount?.type === "pj" && req.currentUser?.plan !== "premium") {
        return res.status(403).json({ error: "Transações em contas PJ disponíveis apenas no plano Premium" });
      }

      // Strict validation
      const parsedUpdates = updateTransactionSchema.parse(req.body);
      if (parsedUpdates.accountType) {
        parsedUpdates.accountType = normalizeAccountType(parsedUpdates.accountType);
        if (parsedUpdates.accountType === "PJ" && req.currentUser?.plan !== "premium") {
          return res.status(403).json({ error: "Transações em contas PJ disponíveis apenas no plano Premium" });
        }
      }
      const updated = await storage.updateTransaction(req.params.id, parsedUpdates);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Delete transaction
  app.delete("/api/transactions/:id", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction || transaction.userId !== req.session.userId) {
        return res.status(404).json({ error: "Transação não encontrada" });
      }
      const transactionAccount = await storage.getAccount(transaction.accountId);
      if (!transactionAccount) {
        return res.status(404).json({ error: "Conta não encontrada" });
      }
      if (transactionAccount?.type === "pj" && req.currentUser?.plan !== "premium") {
        return res.status(403).json({ error: "Transações em contas PJ disponíveis apenas no plano Premium" });
      }

      await storage.deleteTransaction(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ===== FUTURE EXPENSES =====
  app.get("/api/future-expenses", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const scope = parseAccountScope(req.query?.accountType);
      const statusFilter = parseFutureExpenseStatus(req.query?.status);
      if (!ensureScopeAccess(scope, req, res)) {
        return;
      }
      const [expenses, scheduled] = await Promise.all([
        storage.getFutureExpenses(req.session.userId, scope, statusFilter),
        storage.getFutureTransactions(req.session.userId, scope),
      ]);

      const scheduledExpenses = scheduled
        .filter((tx) => tx.isScheduled && tx.type === "expense")
        .filter((tx) => {
          if (!statusFilter) return true;
          if (statusFilter === "paid") return tx.status === "paid";
          if (statusFilter === "overdue") return tx.status === "overdue";
          return tx.status === "pending";
        })
        .map((tx) => {
          const category = (tx as any)?.category || "Outros";
          const amountValue =
            typeof tx.amount === "number"
              ? tx.amount.toFixed(2)
              : typeof tx.amount === "string"
              ? tx.amount
              : Number(tx.amount || 0).toFixed(2);
          return {
            id: `scheduled-${tx.id}`,
            userId: tx.userId,
            accountType: tx.accountType,
            title: tx.description || "Despesa futura",
            category,
            amount: amountValue,
            dueDate: tx.dueDate ? new Date(tx.dueDate) : new Date(tx.expectedDate),
            isRecurring: false,
            recurrenceType: null,
            status: tx.status === "paid" ? "paid" : tx.status === "overdue" ? "overdue" : "pending",
            createdAt: tx.createdAt ? new Date(tx.createdAt) : new Date(),
          };
        });

      res.json([...expenses, ...scheduledExpenses]);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post("/api/future-expenses", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const payload = insertFutureExpenseSchema.parse(req.body);
      if (!ensureScopeAccess(payload.accountType as AccountScope, req, res)) {
        return;
      }
      const expense = await storage.createFutureExpense({
        ...payload,
        status: payload.status || "pending",
        userId: req.session.userId,
      });
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.put("/api/future-expenses/:id/mark-paid", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const updated = await storage.updateFutureExpenseStatus(req.params.id, req.session.userId, "paid");
      if (!updated) {
        return res.status(404).json({ error: "Conta a pagar não encontrada" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.put("/api/future-expenses/:id/mark-overdue", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const updated = await storage.updateFutureExpenseStatus(req.params.id, req.session.userId, "overdue");
      if (!updated) {
        return res.status(404).json({ error: "Conta a pagar não encontrada" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/api/future", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const scope = parseAccountScope(req.query?.type);
      if (!ensureScopeAccess(scope, req, res)) {
        return;
      }
      const statusFilter = parseFutureTransactionStatus(req.query?.status);
      const [futureItems, expenseItems] = await Promise.all([
        storage.getFutureTransactions(req.session.userId, scope, statusFilter),
        storage.getFutureExpenses(req.session.userId, scope),
      ]);

      const expenseAsFuture = expenseItems
        .filter((expense) => {
          if (!statusFilter) return true;
          if (statusFilter === "pending") return expense.status === "pending";
          if (statusFilter === "paid") return expense.status === "paid";
          if (statusFilter === "received") return expense.status === "paid";
          if (statusFilter === "overdue") return expense.status === "overdue";
          return false;
        })
        .map(convertExpenseToFuture);

      const combined = [...futureItems, ...expenseAsFuture];
      const totals = computeFutureTotals(combined);
      res.json({ items: combined, totals });
    } catch (error) {
      console.error("[FUTURE TX] erro ao listar previsões:", error);
      res.status(500).json({ error: "Erro ao buscar valores previstos" });
    }
  });

  app.post("/api/future", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const parsed = insertFutureTransactionSchema.parse({
        ...req.body,
        accountType: normalizeAccountType(req.body?.accountType),
        expectedDate: req.body?.expectedDate,
      });
      if (parsed.accountType === "PJ" && req.currentUser?.plan !== "premium") {
        return res.status(403).json({ error: "Valores previstos PJ disponíveis apenas no plano Premium" });
      }
      const futureTx = await storage.createFutureTransaction({
        ...parsed,
        status: parsed.status || "pending",
        userId: req.session.userId,
        isScheduled: Boolean(parsed.isScheduled),
        dueDate: parsed.dueDate ?? parsed.expectedDate,
      });
      res.status(201).json(futureTx);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      console.error("[FUTURE TX] erro ao cadastrar previsão:", error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.post("/api/ai/chat", requireAuth, requireActiveBilling, async (req: any, res) => {
    const validation = aiChatRequestSchema.safeParse(req.body);
    if (!validation.success) {
      const message = validation.error.issues[0]?.message || "Mensagem inválida";
      return res.status(400).json({ error: message });
    }

    const user = req.currentUser;
    if (!user) {
      return res.status(401).json({ error: "Sessão expirada" });
    }

    const rawContent = validation.data.content.trim();
    
    // Sanitize input to prevent prompt injection
    const { clean, isDangerous, reason } = sanitizeUserInput(rawContent);
    
    if (isDangerous) {
      console.warn(`[AI SECURITY] Prompt injection attempt detected: ${reason} - User: ${user.id}`);
      const rejectionMessage = generateSafeRejectionMessage();
      
      // Clear conversation state and pending actions to prevent stale operations
      resetConversationState(user.id);
      
      try {
        // Save user message with proper DB persistence
        const { data: userMessage, error: userMessageError } = await supabase
          .from("ai_messages")
          .insert({
            user_id: user.id,
            role: "user",
            content: clean,
          })
          .select()
          .single();
        
        if (userMessageError || !userMessage) {
          console.error("[AI SECURITY] Failed to save dangerous message:", userMessageError);
          return res.status(500).json({ error: "Não foi possível registrar sua mensagem agora." });
        }
        
        // Save rejection response with proper DB persistence
        const { data: assistantMessage, error: assistantMessageError } = await supabase
          .from("ai_messages")
          .insert({
            user_id: user.id,
            role: "assistant",
            content: rejectionMessage,
          })
          .select()
          .single();
        
        if (assistantMessageError || !assistantMessage) {
          console.error("[AI SECURITY] Failed to save rejection response:", assistantMessageError);
          return res.status(500).json({ error: "Mensagem registrada, mas não foi possível gerar a resposta agora." });
        }
        
        return res.json({
          success: true,
          data: {
            userMessage: mapAiMessage(userMessage),
            assistantMessage: mapAiMessage(assistantMessage),
          },
        });
      } catch (error) {
        console.error("[AI SECURITY] Unexpected error handling dangerous input:", error);
        return res.status(500).json({ error: "Erro ao processar mensagem." });
      }
    }
    
    const content = clean;
    const state = getConversationState(user.id);
    logConversationState(user.id, "before");

    let assistantText = "";
    let createdTransaction: Transaction | null = null;
    let createdFutureTransaction: FutureTransaction | null = null;
    let createdRecurringTransaction: RecurringTransaction | null = null;

    const pendingAction = pendingActions.get(user.id);
    const confirmationIntent = detectConfirmationIntent(content);

    try {
      const { data: userMessage, error: userMessageError } = await supabase
        .from("ai_messages")
        .insert({
          user_id: user.id,
          role: "user",
          content,
        })
        .select()
        .single();

      if (userMessageError || !userMessage) {
        console.error("[AI CLIENT] erro ao salvar mensagem do usuário:", userMessageError);
        return res.status(500).json({ error: "Não foi possível registrar sua mensagem agora." });
      }

      const sendAssistantResponse = async () => {
        const { data: assistantMessage, error: assistantMessageError } = await supabase
          .from("ai_messages")
          .insert({
            user_id: user.id,
            role: "assistant",
            content: assistantText,
          })
          .select()
          .single();

        if (assistantMessageError || !assistantMessage) {
          console.error("[AI CLIENT] erro ao salvar resposta:", assistantMessageError);
          return res.status(500).json({ error: "Mensagem registrada, mas não foi possível gerar a resposta agora." });
        }

        return res.json({
          success: true,
          data: {
            userMessage: mapAiMessage(userMessage),
            assistantMessage: mapAiMessage(assistantMessage),
            transaction: createdTransaction,
            futureTransaction: createdFutureTransaction,
            recurringTransaction: createdRecurringTransaction,
          },
        });
      };

      if (detectResetIntent(content)) {
        resetConversationState(user.id);
        assistantText = "Sem problemas, vamos começar do zero. Qual é o valor dessa movimentação?";
        logConversationState(user.id, "reset-intent");
        return await sendAssistantResponse();
      }

      if (!pendingAction && confirmationIntent === "cancel") {
        resetConversationState(user.id);
        assistantText = "Tudo bem, limpei as informações. Vamos começar de novo: qual é o valor?";
        logConversationState(user.id, "reset/cancel");
        return await sendAssistantResponse();
      }

      if (pendingAction && confirmationIntent) {
        if (confirmationIntent === "confirm") {
          const result = await executePendingAction(pendingAction, user);
          assistantText = result.assistantText;
          createdTransaction = result.transaction ?? null;
          createdFutureTransaction = result.futureTransaction ?? null;
          createdRecurringTransaction = result.recurringTransaction ?? null;
        } else {
          assistantText = "Sem problemas, descartei essa movimentação. Quando quiser, me envie outra.";
        }
        pendingActions.delete(user.id);
        resetConversationState(user.id);
        logConversationState(user.id, "after confirmation");
        return await sendAssistantResponse();
      }

      if (state.step === "confirming_transaction" && pendingAction && !confirmationIntent) {
        assistantText = 'Só preciso de um "sim" para salvar ou "cancelar" para descartar.';
        return await sendAssistantResponse();
      }

      const [recentConversation, financialContext] = await Promise.all([
        fetchRecentConversation(user.id, 6),
        buildFinancialContext(user.id, "ALL"),
      ]);
      const interpretation = await interpretTransactionFromMessage(
        content,
        recentConversation,
        user.id,
        financialContext?.asPrompt
      );
      if (!state.memory.type) {
        const historyType = inferTypeFromHistory(recentConversation);
        if (historyType) {
          state.memory.type = historyType;
        }
      }
      if (!state.memory.accountType) {
        const historyAccount = inferAccountTypeFromHistory(recentConversation, user.plan);
        if (historyAccount) {
          state.memory.accountType = historyAccount;
        }
      }
      const futureIntent = detectFutureIntent(content);
      const recurringFrequency = detectRecurringFrequency(content);
      const immediateReceipt = detectImmediateReceipt(content);

      const snapshotBefore = JSON.stringify(state.memory);

      if (interpretation.status === "success") {
        fillMemoryFromInterpretation(state, interpretation);
      }

      applyHeuristicsFromContent(state, content, user.plan);

      if (state.memory.isScheduled && state.memory.date) {
        const plannedDate = new Date(state.memory.date);
        if (plannedDate.getTime() > Date.now()) {
          state.memory.dueDate = state.memory.date;
        } else {
          state.memory.date = undefined;
          state.memory.dueDate = undefined;
        }
      }
      if (futureIntent && !state.memory.isScheduled) {
        state.memory.isScheduled = true;
        state.memory.type = state.memory.type || futureIntent;
        if (state.memory.date) {
          state.memory.dueDate = state.memory.date;
        }
      }

      if (isDevMode && snapshotBefore === JSON.stringify(state.memory)) {
        console.log(`[AI STATE][${user.id}] Nenhum novo dado extraído de: "${content}"`);
      }

      ensureAccountTypeInMemory(state, user.plan);
      advanceConversationStep(state);
      if (user.plan === "premium" && !state.memory.accountType) {
        state.step = "collecting_type";
      }

      if (state.memory.accountType === "PJ" && user.plan !== "premium") {
        assistantText =
          "Transações empresariais exigem o Plano Premium. Vamos continuar na conta pessoal por enquanto.";
        resetConversationState(user.id);
        return await sendAssistantResponse();
      }

      // PRIORIDADE 1: Usar a mensagem conversacional da IA se disponível
      if (interpretation.conversationalMessage) {
        assistantText = interpretation.conversationalMessage;
        if (isDevMode) console.log(`[AI CONVERSATIONAL] Usando mensagem da IA: "${assistantText}"`);
      } 
      // PRIORIDADE 2: Usar mensagem de clarificação da IA (fallback para compatibilidade)
      else if (interpretation.status === "clarify" && interpretation.message) {
        assistantText = interpretation.message;
      }
      // PRIORIDADE 3: Lógica hardcoded como último recurso (quando IA falha)
      else if (state.step === "collecting_amount" && !state.memory.amount) {
        assistantText = "Qual é o valor dessa movimentação? (ex.: 250 ou 1.200,50)";
      } else if (state.step === "collecting_type" && !state.memory.type) {
        assistantText = "É um pagamento (saída) ou um recebimento (entrada)?";
      } else if (state.step === "collecting_type" && state.memory.type && user.plan === "premium" && !state.memory.accountType) {
        assistantText = "Essa movimentação deve sair da conta pessoal (PF) ou da conta empresarial (PJ)?";
      } else if (state.step === "collecting_date" && !state.memory.date) {
        assistantText = 'Qual é a data? Informe dia/mês/ano ou diga "amanhã"/"dia 10".';
      } else if (state.step === "collecting_description" && !state.memory.description) {
        assistantText = "Como você quer descrever essa movimentação?";
      }

      // Registrar pending action se estiver na etapa de confirmação (mas não sobrescrever mensagem!)
      if (state.step === "confirming_transaction" && hasAllConversationData(state.memory)) {
        const candidate = buildCandidateFromState(state);
        if (candidate) {
          if (recurringFrequency) {
            pendingActions.set(user.id, {
              kind: "recurring",
              candidate,
              frequency: recurringFrequency,
              immediateReceipt,
            });
            // Só sobrescrever se não houver mensagem da IA
            if (!assistantText) {
              assistantText = buildPendingSummary(pendingActions.get(user.id)!);
            }
          } else {
            if (futureIntent && !candidate.isScheduled) {
              candidate.isScheduled = true;
              candidate.dueDate = candidate.dueDate || candidate.date;
            }
            registerPendingActionForCandidate(user.id, candidate, candidate.type);
            // Só sobrescrever se não houver mensagem da IA
            if (!assistantText) {
              assistantText = formatConfirmationMessage(state.memory);
            }
          }
        } else if (!assistantText) {
          assistantText = "Preciso de mais detalhes antes de salvar.";
        }
      } else if (!assistantText) {
        assistantText = "Estou quase lá! Vamos seguir a ordem: valor → tipo → data → descrição.";
      }

      logConversationState(user.id, "after");
      return await sendAssistantResponse();
    } catch (error) {
      console.error("[AI CLIENT] erro inesperado:", error);
      return res.status(500).json({ error: "Erro ao processar mensagem" });
    }
  });

  app.get("/api/ai/chat", requireAuth, requireActiveBilling, async (req: any, res) => {
    const user = req.currentUser;
    if (!user) {
      return res.status(401).json({ error: "Sessão expirada" });
    }
    const limit = Number(req.query?.limit) || 100;
    try {
      const { data, error } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) {
        console.error("[AI CLIENT] erro ao buscar histórico:", error);
        return res.status(500).json({ error: "Erro ao buscar histórico" });
      }

      const messages = (data || []).map((row) => mapAiMessage(row));
      res.json({ messages });
    } catch (error) {
      console.error("[AI CLIENT] erro inesperado ao listar histórico:", error);
      res.status(500).json({ error: "Erro ao buscar histórico" });
    }
  });

  app.post("/api/ai/report", requireAuth, requireActiveBilling, premiumRequired, async (req: any, res) => {
    try {
      const { period } = req.body || {};
      if (!period || typeof period !== "string" || !/^\d{4}-\d{2}$/.test(period)) {
        return res.status(400).json({ error: "Período inválido. Use o formato YYYY-MM." });
      }

      const [yearStr, monthStr] = period.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ error: "Período inválido. Use o formato YYYY-MM." });
      }

      const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

      const preferences = await storage.getAiReportSettings(req.session.userId);

      const insights = await generateAiFinancialReport(
        req.session.userId,
        {
          start,
          end,
          label: period,
        },
        preferences ?? undefined
      );

      return res.json({
        insights: insights.insights,
        tips: insights.savingsTips,
        warnings: insights.alerts,
        projections: insights.rawSummary,
      });
    } catch (error) {
      console.error("[AI REPORT] erro ao gerar relatório:", error);
      res.status(500).json({ error: "Não foi possível gerar o relatório AI agora." });
    }
  });

  app.post("/api/ai/insights", requireAuth, requireActiveBilling, premiumRequired, async (req: any, res) => {
    try {
      const scope = parseAccountScope(req.body?.type ?? req.query?.type);
      const insights = await generateAiInsights(req.session.userId, scope);
      res.json(insights);
    } catch (error) {
      console.error("[AI INSIGHTS] erro ao gerar insights:", error);
      res.status(500).json({ error: "Não foi possível gerar insights agora." });
    }
  });

  app.get("/api/ai/report/settings", requireAuth, requireActiveBilling, premiumRequired, async (req: any, res) => {
    try {
      const settings =
        (await storage.getAiReportSettings(req.session.userId)) || (await storage.upsertAiReportSettings(req.session.userId, {}));
      res.json({
        focusEconomy: Boolean(settings.focusEconomy),
        focusDebt: Boolean(settings.focusDebt),
        focusInvestments: Boolean(settings.focusInvestments),
      });
    } catch (error) {
      console.error("[AI REPORT] erro ao buscar preferências:", error);
      res.status(500).json({ error: "Não foi possível carregar preferências agora." });
    }
  });

  app.put("/api/ai/report/settings", requireAuth, requireActiveBilling, premiumRequired, async (req: any, res) => {
    try {
      const payload = insertAiReportSettingSchema.partial().parse(req.body || {});
      const updated = await storage.upsertAiReportSettings(req.session.userId, payload);
      res.json({
        focusEconomy: Boolean(updated.focusEconomy),
        focusDebt: Boolean(updated.focusDebt),
        focusInvestments: Boolean(updated.focusInvestments),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      console.error("[AI REPORT] erro ao salvar preferências:", error);
      res.status(500).json({ error: "Não foi possível atualizar preferências agora." });
    }
  });

  app.get("/api/cashflow/forecast", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const scope = parseAccountScope(req.query?.type);
      if (!ensureScopeAccess(scope, req, res)) {
        return;
      }
      const forecast = await computeCashflowForecast(req.session.userId, scope);
      res.json(forecast);
    } catch (error) {
      console.error("[FORECAST] erro ao calcular previsão:", error);
      res.status(500).json({ error: "Não foi possível calcular a previsão de caixa." });
    }
  });

  // ===== RULE ROUTES =====
  
  // Get all rules for user
  app.get("/api/rules", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const rules = await storage.getRulesByUserId(req.session.userId);
      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar regras" });
    }
  });

  // Create rule
  app.post("/api/rules", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const data = insertRuleSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });
      const rule = await storage.createRule(data);
      res.json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Update rule
  app.patch("/api/rules/:id", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const rule = await storage.getRule(req.params.id);
      if (!rule || rule.userId !== req.session.userId) {
        return res.status(404).json({ error: "Regra não encontrada" });
      }

      // Strict validation
      const updates = updateRuleSchema.parse(req.body);
      const updated = await storage.updateRule(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Delete rule
  app.delete("/api/rules/:id", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const rule = await storage.getRule(req.params.id);
      if (!rule || rule.userId !== req.session.userId) {
        return res.status(404).json({ error: "Regra não encontrada" });
      }

      await storage.deleteRule(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }

  });


// -------------------------
// INVESTMENT GOALS
// -------------------------

// GET ALL GOALS FOR USER
app.get("/api/investments/goals", requireAuth, requireActiveBilling, async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Não autenticado" });

  const investments = await storage.getInvestmentsByUserId(userId);
  const goals = [];

  for (const inv of investments) {
    const goal = await storage.getInvestmentGoal(inv.id);
    if (goal) goals.push(goal);
  }

  res.json(goals);
});

// CREATE OR UPDATE GOAL
app.post("/api/investments/goals", requireAuth, requireActiveBilling, async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Não autenticado" });

  const { investmentId, targetAmount } = req.body;

  if (!investmentId) {
    return res.status(400).json({ error: "investmentId é obrigatório" });
  }

  if (!targetAmount) {
    return res.status(400).json({ error: "targetAmount é obrigatório" });
  }

  // 🔥 AQUI: parse correto
  const parsedAmount = Number(targetAmount);

  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "targetAmount inválido" });
  }

  console.log("[GOAL] Saving goal:", {
    userId,
    investmentId,
    parsedAmount,
  });

  const goal = await storage.createOrUpdateInvestmentGoal({
    userId,
    investmentId,
    targetAmount: parsedAmount, // 🔥 AQUI VAI O NUMERO CORRIGIDO
  });

  res.json(goal);
});

// DELETE GOAL
app.delete("/api/investments/goals/:investmentId", requireAuth, requireActiveBilling, async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "Não autenticado" });

  await storage.deleteInvestmentGoal(req.params.investmentId);

  res.json({ success: true });
});


  // ===== DASHBOARD ROUTES =====
  
  // Get dashboard metrics
  app.get("/api/dashboard/metrics", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const scope = parseAccountScope(req.query?.type);
      if (!ensureScopeAccess(scope, req, res)) {
        return;
      }
      const metrics = await storage.getDashboardMetrics(req.session.userId, scope);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar métricas" });
    }
  });

  // Get category breakdown
  app.get("/api/dashboard/categories", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const scope = parseAccountScope(req.query?.type);
      if (!ensureScopeAccess(scope, req, res)) {
        return;
      }
      const categories = await storage.getCategoryBreakdown(req.session.userId, scope);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar categorias" });
    }
  });

  // Get investments summary
  app.get("/api/dashboard/investments", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const summary = await storage.getInvestmentsSummary(req.session.userId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar investimentos" });
    }
  });

  app.get("/api/dashboard/income-expenses", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const scope = parseAccountScope(req.query?.type);
      if (!ensureScopeAccess(scope, req, res)) {
        return;
      }
      const data = await storage.getIncomeExpensesData(req.session.userId, scope);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar receitas e despesas" });
    }
  });

  // ===== INVESTMENT ROUTES =====

  // Get all investments
  app.get("/api/investments", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const investments = await storage.getInvestmentsByUserId(req.session.userId);
      res.json(investments);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar investimentos" });
    }
  });

  // Create investment
  app.post("/api/investments", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const validatedData = insertInvestmentSchema.parse(req.body);
      const investment = await storage.createInvestment({ ...validatedData, userId: req.session.userId });
      res.json(investment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Update investment
  app.patch("/api/investments/:id", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const investment = await storage.getInvestment(req.params.id);
      if (!investment || investment.userId !== req.session.userId) {
        return res.status(404).json({ error: "Investimento não encontrado" });
      }

      const updates = updateInvestmentSchema.parse(req.body);
      const updated = await storage.updateInvestment(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Delete investment
  app.delete("/api/investments/:id", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const investment = await storage.getInvestment(req.params.id);
      if (!investment || investment.userId !== req.session.userId) {
        return res.status(404).json({ error: "Investimento não encontrado" });
      }

      await storage.deleteInvestment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Get investment goal
  app.get("/api/investments/:id/goal", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const investment = await storage.getInvestment(req.params.id);
      if (!investment || investment.userId !== req.session.userId) {
        return res.status(404).json({ error: "Investimento não encontrado" });
      }

      const goal = await storage.getInvestmentGoal(req.params.id);
      if (!goal) {
        return res.status(404).json({ error: "Meta não encontrada" });
      }

      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar meta" });
    }
  });

  // Create or update investment goal
  app.post("/api/investments/:id/goal", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const investment = await storage.getInvestment(req.params.id);
      if (!investment || investment.userId !== req.session.userId) {
        return res.status(404).json({ error: "Investimento não encontrado" });
      }

      const data = insertInvestmentGoalSchema.parse({ 
        ...req.body, 
        userId: req.session.userId,
        investmentId: req.params.id 
      });
      const goal = await storage.createOrUpdateInvestmentGoal(data);
      res.json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Delete investment goal
  app.delete("/api/investments/:id/goal", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const investment = await storage.getInvestment(req.params.id);
      if (!investment || investment.userId !== req.session.userId) {
        return res.status(404).json({ error: "Investimento não encontrado" });
      }

      await storage.deleteInvestmentGoal(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Get investment transactions
  app.get("/api/investments/:id/transactions", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const investment = await storage.getInvestment(req.params.id);
      if (!investment || investment.userId !== req.session.userId) {
        return res.status(404).json({ error: "Investimento não encontrado" });
      }

      const transactions = await storage.getInvestmentTransactionsByInvestmentId(req.params.id);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar transações" });
    }
  });

  // Create investment transaction (RESTful route)
  app.post("/api/investments/:id/transactions", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const investment = await storage.getInvestment(req.params.id);
      if (!investment || investment.userId !== req.session.userId) {
        return res.status(404).json({ error: "Investimento não encontrado" });
      }

      const data = insertInvestmentTransactionSchema.parse({ 
        ...req.body, 
        investmentId: req.params.id,
        userId: req.session.userId 
      });
      
      const transaction = await storage.createInvestmentTransaction(data);
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Create investment transaction (legacy route - kept for backwards compatibility)
  app.post("/api/investment-transactions", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const data = insertInvestmentTransactionSchema.parse({ ...req.body, userId: req.session.userId });
      const transaction = await storage.createInvestmentTransaction(data);
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ===== USER/SETTINGS ROUTES =====
  
  // Update user profile
  app.patch("/api/user/profile", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const updates = updateUserProfileSchema.parse(req.body);
      const updated = await storage.updateUser(req.session.userId, updates);
      
      if (!updated) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Create a new object without password to avoid read-only property errors
      const userWithoutPassword = {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        plan: updated.plan,
        trialStart: updated.trialStart,
        trialEnd: updated.trialEnd,
        caktoSubscriptionId: updated.caktoSubscriptionId,
        billingStatus: updated.billingStatus,
        createdAt: updated.createdAt,
      };
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Update user plan
  app.patch("/api/user/plan", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const { plan } = req.body;
      if (!["pro", "premium"].includes(plan)) {
        return res.status(400).json({ error: "Plano inválido" });
      }

      const updated = await storage.updateUser(req.session.userId, { plan });
      
      if (!updated) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Create a new object without password to avoid read-only property errors
      const userWithoutPassword = {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        plan: updated.plan,
        trialStart: updated.trialStart,
        trialEnd: updated.trialEnd,
        caktoSubscriptionId: updated.caktoSubscriptionId,
        billingStatus: updated.billingStatus,
        createdAt: updated.createdAt,
      };
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ===== EXPORT ROUTES =====

  app.post("/api/export/pro", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const user = req.currentUser || (await storage.getUser(req.session.userId));
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      if (!["pro", "premium"].includes(user.plan)) {
        return res.status(403).json({ error: "Disponível apenas para planos Pro ou Premium" });
      }

      const scope = parseAccountScope(req.body?.type ?? req.query?.type);
      if (!ensureScopeAccess(scope, req, res)) {
        return;
      }

      const transactions = await storage.getTransactionsByUserId(user.id, scope);
      const orderedTransactions = [...transactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const realExpensesTotal = orderedTransactions
        .filter((tx) => tx.type === "saida")
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const futureExpenses = await storage.getFutureExpenses(user.id, scope, "pending");
      const futureExpensesTotal = futureExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      );
      const expensesDifference = futureExpensesTotal - realExpensesTotal;

      const printableTransactions = orderedTransactions.map((transaction) => {
        const txDate = new Date(transaction.date);
        const numericAmount =
          typeof transaction.amount === "number" ? transaction.amount : Number(transaction.amount);
        return {
          date: Number.isNaN(txDate.getTime()) ? "-" : formatPtDate(txDate),
          category: transaction.category || "Sem categoria",
          amount: formatCurrencyBRL(numericAmount),
          type: transaction.type === "entrada" ? "Entrada" : "Saida",
          description: transaction.description || "-",
        };
      });

      const rawPeriod = req.body?.period ?? req.query?.period;
      const providedPeriod = rawPeriod ? String(rawPeriod).trim() : "";
      let periodLabel = providedPeriod || "Sem movimentações registradas";
      if (!providedPeriod) {
        const validTimestamps = orderedTransactions
          .map((transaction) => {
            const asDate = new Date(transaction.date);
            return Number.isNaN(asDate.getTime()) ? null : asDate.getTime();
          })
          .filter((value): value is number => value !== null);

        if (validTimestamps.length > 0) {
          const startDate = new Date(Math.min(...validTimestamps));
          const endDate = new Date(Math.max(...validTimestamps));
          const startLabel = formatPtDate(startDate);
          const endLabel = formatPtDate(endDate);
          periodLabel = startLabel === endLabel ? endLabel : `${startLabel} a ${endLabel}`;
        }
      }

      const projections = await calculateAiProjections(user.id, scope);

      const pdfBuffer = buildProTransactionsPdf({
        userName: user.fullName || user.email,
        scopeLabel: scopeLabels[scope],
        periodLabel,
        generatedAt: new Date(),
        transactions: printableTransactions,
        stats: {
          realExpenses: formatCurrencyBRL(realExpensesTotal),
          futureExpenses: formatCurrencyBRL(futureExpensesTotal),
          difference:
            (expensesDifference >= 0 ? "+" : "") + formatCurrencyBRL(expensesDifference),
        },
        projections: {
          expectedEndBalance: formatCurrencyBRL(projections.expectedEndBalance),
          safeSpendingMargin: formatCurrencyBRL(projections.safeSpendingMargin),
          negativeRisk: `${projections.negativeRisk}%`,
        },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=finscope-pro-transactions.pdf");
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("[PRO PDF EXPORT] erro ao gerar PDF:", error);
      res.status(500).json({ error: "Não foi possível gerar o PDF agora." });
    }
  });

  // Export transactions to CSV
  app.get("/api/export/transactions", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const scope = parseAccountScope(req.query?.type);
      if (!ensureScopeAccess(scope, req, res)) {
        return;
      }
      const transactions = await storage.getTransactionsByUserId(req.session.userId, scope);
      const accounts = await storage.getAccountsByUserId(req.session.userId);
      const accountMap = new Map(accounts.map(a => [a.id, a]));
      
      const headers = ["Data", "Descrição", "Conta", "Tipo", "Categoria", "Valor"];
      const rows = transactions.map(t => {
        const date = new Date(t.date).toLocaleDateString('pt-BR');
        const accountName = accountMap.get(t.accountId)?.name || "Conta desconhecida";
        const type = t.type === "entrada" ? "Entrada" : "Saída";
        const amount = `R$ ${parseFloat(t.amount).toFixed(2).replace('.', ',')}`;
        
        return [
          date,
          `"${t.description.replace(/"/g, '""')}"`,
          `"${accountName}"`,
          type,
          t.category,
          amount
        ].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="transacoes_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({ error: "Erro ao exportar transações" });
    }
  });

// ======================================================
// CAKTO – Criar assinatura + checkout com garantia
// ======================================================
app.post("/api/checkout/create", requireAuth, async (req: any, res) => {
  try {
    const rawPlan = req.body?.plan?.toString().toLowerCase();
    const mode = req.body?.mode === "upgrade" ? "upgrade" : "trial";

    if (!["pro", "premium"].includes(rawPlan)) {
      return res.status(400).json({ error: "Plano inválido. Use: pro | premium" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const productId =
      rawPlan === "premium"
        ? process.env.CAKTO_PRODUCT_PREMIUM_ID || process.env.CAKTO_PLAN_PREMIUM_ID
        : process.env.CAKTO_PRODUCT_PRO_ID || process.env.CAKTO_PLAN_PRO_ID;

    if (!productId) {
      return res.status(500).json({ error: "IDs dos produtos da Cakto ausentes no .env" });
    }

    const directCheckoutUrl =
      rawPlan === "premium"
        ? process.env.CAKTO_CHECKOUT_PREMIUM_URL
        : process.env.CAKTO_CHECKOUT_PRO_URL;

    let checkoutUrl = (directCheckoutUrl || "").trim();

    if (!checkoutUrl) {
      const checkoutBase = process.env.CAKTO_CHECKOUT_BASE_URL || "https://app.cakto.com.br/product";
      const normalizedBase = checkoutBase.endsWith("/")
        ? checkoutBase.slice(0, -1)
        : checkoutBase;
      checkoutUrl = `${normalizedBase}/${productId}`;
    }

    return res.json({
      success: true,
      checkoutUrl,
      plan: rawPlan,
      mode,
    });
  } catch (err) {
    console.error("[CAKTO CHECKOUT ERROR]", err);
    res.status(500).json({ error: "Erro ao preparar checkout da Cakto" });
  }
});

// ======================================================
// CAKTO Webhook – ativação/cancelamento/renovações
// ======================================================
app.post("/api/cakto/webhook", async (req, res) => {
  try {
    const body = req.body;

    // Validação do secret
    const incomingSecret = body.secret || body.fields?.secret;
    if (incomingSecret !== process.env.CAKTO_WEBHOOK_SECRET) {
      console.warn("[CAKTO WEBHOOK] Secret inválido");
      return res.status(401).json({ error: "Invalid secret" });
    }

    // Tipo do evento
    const event =
      body.event ||
      body.event_id ||
      body.type ||
      body?.event?.custom_id;

    const data = body.data || body.payload || body;
    const customer = data.customer || body.customer;
    const email = customer?.email;

    console.log("[CAKTO WEBHOOK RECEIVED]", event, email);

    if (!email) return res.json({ received: true });

    const subscriptionId =
      data.id ||
      data.subscription_id ||
      data.subscriptionId ||
      data?.fields?.subscription_id;

    const user = await storage.getUserByEmail(email);
    if (!user) return res.json({ received: true });

    const normalizedEvent = (event || "").toLowerCase();
    const activationEvents = [
      "purchase_approved",
      "subscription_created",
      "subscription_renewed",
      "subscription_payment_confirmed",
      "subscription_payment_success",
    ];
    const cancellationEvents = [
      "subscription_canceled",
      "subscription_cancelled",
      "subscription_refunded",
      "purchase_refunded",
      "subscription_renewal_refused",
      "subscription_payment_failed",
      "subscription_chargeback",
      "refund_requested",
      "refund_completed",
      "refund",
    ];

    const now = new Date();
    const productName = data.product?.name?.toLowerCase() || "";
    const plan = productName.includes("premium") ? "premium" : "pro";

    if (activationEvents.some((evt) => normalizedEvent.includes(evt))) {
      const guaranteeEnd = new Date(now.getTime() + GUARANTEE_WINDOW_MS);

      await storage.updateUser(user.id, {
        plan,
        caktoSubscriptionId: subscriptionId || user.caktoSubscriptionId,
        billingStatus: "active",
        trialStart: now,
        trialEnd: guaranteeEnd,
      });

      console.log(`[CAKTO] Assinatura confirmada (${normalizedEvent}): ${email} → ${plan}`);
    } else if (cancellationEvents.some((evt) => normalizedEvent.includes(evt))) {
      await storage.updateUser(user.id, {
        plan: "pro",
        trialStart: null,
        trialEnd: null,
        billingStatus: "pending",
        caktoSubscriptionId: null,
      });

      console.log(`[CAKTO] Assinatura encerrada (${normalizedEvent}): ${email}`);
    } else {
      console.log("[CAKTO] Evento ignorado:", normalizedEvent);
    }

    return res.json({ received: true });

  } catch (err) {
    console.error("[CAKTO WEBHOOK ERROR]", err);
    return res.status(200).json({ received: true });
  }
});



  const httpServer = createServer(app);
  return httpServer;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}

function resolvePuppeteerExecutable() {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  // Check for Chromium from Nix (available in deployments)
  const nixChromiumPath = findChromiumInPath();
  if (nixChromiumPath) {
    console.log("[PDF EXPORT] Usando Chromium do sistema (Nix):", nixChromiumPath);
    return nixChromiumPath;
  }

  const cacheDir = path.join(os.homedir(), ".cache/puppeteer");
  const executableCandidates = ["chrome-headless-shell", "chrome", "chromium", "chrome.exe"];
  if (fs.existsSync(cacheDir)) {
    console.log("[PDF EXPORT] Procurando Chrome em", cacheDir);
  }
  for (const candidate of executableCandidates) {
    const candidatePath = findExecutableRecursive(cacheDir, candidate);
    if (candidatePath) {
      console.log("[PDF EXPORT] Chrome localizado automaticamente em:", candidatePath);
      return candidatePath;
    }
  }

  console.warn("[PDF EXPORT] Nenhum Chrome encontrado. Tentando instalar via npx...");
  const installSucceeded = installChromeBrowser(cacheDir);
  if (installSucceeded) {
    for (const candidate of executableCandidates) {
      const candidatePath = findExecutableRecursive(cacheDir, candidate);
      if (candidatePath) {
        console.log("[PDF EXPORT] Chrome instalado e localizado em:", candidatePath);
        return candidatePath;
      }
    }
  }

  try {
    const bundledPath = puppeteer.executablePath();
    if (bundledPath && fs.existsSync(bundledPath)) {
      console.log("[PDF EXPORT] Usando Chrome empacotado em:", bundledPath);
      return bundledPath;
    }
  } catch (error) {
    console.warn("[PDF EXPORT] Erro ao resolver Chrome empacotado:", error);
  }

  console.error("[PDF EXPORT] ⚠️ NENHUM EXECUTÁVEL DO CHROME FOI ENCONTRADO!");
  console.error("[PDF EXPORT] Para corrigir em deployment:");
  console.error("[PDF EXPORT] 1. Adicione 'chromium' como dependência do sistema via Nix");
  console.error("[PDF EXPORT] 2. OU defina PUPPETEER_EXECUTABLE_PATH com caminho do Chrome");
  console.error("[PDF EXPORT] PDF exports NÃO funcionarão até que Chrome/Chromium esteja disponível.");
  return null;
}

function findChromiumInPath(): string | null {
  try {
    // Try to find chromium in PATH (works with Nix-installed chromium)
    const result = spawnSync("which", ["chromium"], { encoding: "utf8" });
    if (result.status === 0 && result.stdout) {
      const chromiumPath = result.stdout.trim();
      if (fs.existsSync(chromiumPath)) {
        return chromiumPath;
      } else {
        console.warn("[PDF EXPORT] Chromium encontrado no PATH mas arquivo não existe:", chromiumPath);
      }
    } else {
      console.log("[PDF EXPORT] Chromium não encontrado no PATH (which retornou status", result.status, ")");
    }
  } catch (error) {
    console.warn("[PDF EXPORT] Erro ao procurar Chromium no PATH:", error);
  }
  return null;
}

function installChromeBrowser(cacheDir: string) {
  try {
    const result = spawnSync("npx", ["puppeteer", "browsers", "install", "chrome"], {
      cwd: process.cwd(),
      stdio: "inherit",
      timeout: 120_000,
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR: cacheDir,
      },
    });
    if (result.status === 0) {
      console.log("[PDF EXPORT] Instalação do Chrome concluída via npx puppeteer.");
      return true;
    }
    console.warn("[PDF EXPORT] Falha ao instalar Chrome automaticamente. status:", result.status);
    return false;
  } catch (error) {
    console.error("[PDF EXPORT] Erro ao executar instalação automática do Chrome:", error);
    return false;
  }
}

function findExecutableRecursive(
  dir: string,
  executableName: string,
  depth = 0,
  maxDepth = 8
): string | null {
  if (!fs.existsSync(dir) || depth > maxDepth) {
    return null;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const isExecutableFile =
      entry.isFile() || (entry.isSymbolicLink && entry.isSymbolicLink());
    if (!isExecutableFile) continue;

    if (entry.name === executableName || entry.name.startsWith(`${executableName}.`)) {
      return path.join(dir, entry.name);
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const result = findExecutableRecursive(path.join(dir, entry.name), executableName, depth + 1, maxDepth);
    if (result) {
      return result;
    }
  }

  return null;
}

function buildReportHtml({
  user,
  type,
  period,
  metrics,
  categories,
  transactions,
  chartImage,
  includeCharts,
  insights,
  forecast,
  aiInsights,
}: {
  user: User;
  type: string;
  period: string;
  metrics: { totalBalance: number; monthlyIncome: number; monthlyExpenses: number; netCashFlow: number };
  categories: { category: string; amount: number }[];
  transactions: any[];
  chartImage: string | null;
  includeCharts: boolean;
  insights: string[];
  forecast?: {
    currentBalance: number;
    expectedIncome: number;
    previousIncome: number;
    incomeDelta: number;
    futureExpensesTotal: number;
    forecastBalance: number;
    freeCash: number;
  };
  aiInsights?: AiInsightResult;
}) {
  const summaryRows = transactions.slice(0, 6).map((tx) => {
    const date = new Date(tx.date || tx.createdAt || Date.now());
    return `
      <tr>
        <td>${date.toLocaleDateString("pt-BR")}</td>
        <td>${escapeHtml(tx.description ?? tx.category ?? "-")}</td>
        <td>${escapeHtml(tx.category ?? "-")}</td>
        <td class="${tx.type === "saida" ? "text-negative" : "text-positive"}">
          ${tx.type === "saida" ? "-" : ""}${formatCurrency(Number(tx.amount || 0))}
        </td>
      </tr>
    `;
  }).join("");

  const categoriesRows = categories.slice(0, 8).map((cat, index) => {
    return `
      <tr>
        <td>${index + 1}</td>
        <td>
          <div class="table-title">${escapeHtml(cat.category)}</div>
          <div class="table-subtitle">Participação ${((Number(cat.amount) / (metrics.monthlyExpenses || 1)) * 100).toFixed(1)}%</div>
        </td>
        <td class="text-right">${formatCurrency(Number(cat.amount))}</td>
      </tr>
    `;
  }).join("");

  const kpiBlocks = [
    { label: "Saldo total", value: formatCurrency(metrics.totalBalance) },
    { label: "Receitas do período", value: formatCurrency(metrics.monthlyIncome) },
    { label: "Despesas do período", value: formatCurrency(metrics.monthlyExpenses) },
    { label: "Fluxo de caixa", value: formatCurrency(metrics.netCashFlow) },
  ].map(
    (kpi) => `
    <div class="kpi-card">
      <p class="kpi-label">${kpi.label}</p>
      <p class="kpi-value">${kpi.value}</p>
    </div>`
  ).join("");

  const forecastBlocks = forecast
    ? `
    <section class="forecast-grid">
      <div class="forecast-card">
        <p class="kpi-label">Saldo previsto</p>
        <p class="kpi-value">${formatCurrency(forecast.forecastBalance)}</p>
        <p class="muted">Saldo atual ${formatCurrency(forecast.currentBalance)} + receitas previstas ${formatCurrency(forecast.expectedIncome)} - gastos futuros ${formatCurrency(forecast.futureExpensesTotal)}</p>
      </div>
      <div class="forecast-card">
        <p class="kpi-label">Gastos já previstos</p>
        <p class="kpi-value text-negative">${formatCurrency(forecast.futureExpensesTotal)}</p>
        <p class="muted">Contas registradas como pendentes</p>
      </div>
      <div class="forecast-card">
        <p class="kpi-label">Dinheiro livre esperado</p>
        <p class="kpi-value text-positive">${formatCurrency(forecast.freeCash)}</p>
        <p class="muted">Comparativo vs. mês anterior: ${forecast.incomeDelta >= 0 ? "+" : "-"}${formatCurrency(Math.abs(forecast.incomeDelta))}</p>
      </div>
      <div class="forecast-card highlight">
        <p class="kpi-label">Economia recomendada</p>
        <p class="kpi-value">${formatCurrency(Math.max(0, forecast.freeCash * 0.3))}</p>
        <p class="muted">Reserve 30% do dinheiro livre para construir gordura financeira.</p>
      </div>
    </section>
  `
    : "";

  const insightsList = `
    <div class="card insights-card">
      <div class="card-header">
        <h3>Insights inteligentes</h3>
        <span class="badge">Premium</span>
      </div>
      ${
        insights.length
          ? `<ul class="insights-list">${insights
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}</ul>`
          : `<p class="muted italic">Os insights estratégicos aparecerão aqui assim que tivermos dados suficientes.</p>`
      }
    </div>
  `;

  const chartBlock = `
    <div class="card chart-card">
      <div class="card-header">
        <div>
          <p class="subtitle">Distribuição por categoria</p>
          <h3>Painel de gastos</h3>
        </div>
        <span class="muted">${includeCharts ? "Base64 embutido" : "Sem gráfico"}</span>
      </div>
      ${
        includeCharts && chartImage
          ? `<img src="${chartImage}" class="chart-image" alt="Gráfico base64" />`
          : `<div class="chart-placeholder">Cole aqui o gráfico em base64</div>`
      }
    </div>
  `;

  const categoriesTable = `
    <div class="card">
      <div class="card-header">
        <div>
          <p class="subtitle">Principais categorias</p>
          <h3>Ranking por impacto</h3>
        </div>
        <span class="muted">${categories.length ? "Top 8" : "Sem dados"}</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Categoria</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${
            categoriesRows ||
            `<tr><td colspan="3" class="muted text-center">Sem categorias suficientes neste período.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;

  const aiInsightsBlock = aiInsights
    ? `
    <section class="two-column">
      <div class="card">
        <div class="card-header">
          <div>
            <p class="subtitle">Resumo da IA</p>
            <h3>Contexto personalizado</h3>
          </div>
          <span class="badge">FinScope AI</span>
        </div>
        <p class="muted" style="white-space:pre-line;">${escapeHtml(aiInsights.summaryText)}</p>
        <div class="forecast-grid" style="grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 12px; margin-top:16px;">
          <div class="forecast-card">
            <p class="kpi-label">Gastos previstos</p>
            <p class="kpi-value">${formatCurrency(aiInsights.predictions.nextMonthExpenses || 0)}</p>
          </div>
          <div class="forecast-card">
            <p class="kpi-label">Economia estimada</p>
            <p class="kpi-value">${formatCurrency(aiInsights.predictions.nextMonthSavings || 0)}</p>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <p class="subtitle">Alertas & Dicas</p>
            <h3>Foco para o próximo mês</h3>
          </div>
        </div>
        ${
          aiInsights.alerts.length
            ? `<ul class="insights-list">${aiInsights.alerts
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join("")}</ul>`
            : `<p class="muted italic">Sem alertas críticos no momento.</p>`
        }
        <hr style="margin:18px 0; border:none; border-top:1px solid #e2e8f0;" />
        ${
          aiInsights.tips.length
            ? `<ul class="insights-list">${aiInsights.tips
                .map((item) => `<li>${escapeHtml(item)}</li>`)
                .join("")}</ul>`
            : `<p class="muted italic">Nenhuma recomendação extra desta vez.</p>`
        }
      </div>
    </section>
  `
    : "";

  const generatedAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Relatório FinScope</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; background: #f1f4fb; color: #0f172a; margin: 0; }
      .report-container { max-width: 900px; margin: 0 auto; background: #ffffff; min-height: 100vh; padding: 40px; box-shadow: 0 40px 120px rgba(15,23,42,0.12); }
      .report-header { border-radius: 28px; background: #0f172a; color: #fff; padding: 32px; margin-bottom: 40px; display: flex; flex-direction: column; gap: 24px; }
      .header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
      .header-title { text-transform: uppercase; letter-spacing: 0.2em; font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 6px; }
      .header-summary { border: 1px solid rgba(255,255,255,0.2); border-radius: 18px; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
      .kpi-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-bottom: 40px; }
      .kpi-card { border: 1px solid #e2e8f0; border-radius: 24px; padding: 20px; background: #f8fafc; box-shadow: 0 10px 40px rgba(15,23,42,0.08); }
      .kpi-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b; }
      .kpi-value { margin-top: 10px; font-size: 30px; font-weight: 600; color: #0f172a; }
      .forecast-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
      .forecast-card { border: 1px solid #e2e8f0; border-radius: 24px; padding: 20px; background: #f8fafc; box-shadow: 0 16px 40px rgba(15,23,42,0.08); min-height: 150px; }
      .forecast-card.highlight { background: #ecfdf5; border-color: #a7f3d0; }
      .two-column { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 24px; margin-bottom: 40px; }
      .card { border: 1px solid #e2e8f0; border-radius: 24px; padding: 24px; box-shadow: 0 20px 60px rgba(15,23,42,0.08); background: #fff; min-height: 100%; }
      .card-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
      .card-header h3 { margin: 4px 0 0 0; font-size: 20px; color: #0f172a; }
      .subtitle { text-transform: uppercase; letter-spacing: 0.2em; font-size: 11px; color: #94a3b8; }
      .muted { color: #94a3b8; font-size: 12px; }
      .chart-card { min-height: 320px; display:flex; flex-direction:column; }
      .chart-image { width: 100%; border-radius: 16px; border:1px solid #e2e8f0; box-shadow: inset 0 4px 12px rgba(15,23,42,0.05); object-fit: cover; flex:1; }
      .chart-placeholder { flex:1; border:1px dashed #cbd5f5; border-radius:16px; display:flex; align-items:center; justify-content:center; font-size:13px; color:#94a3b8; font-style:italic; min-height:220px; }
      .insights-card { background: #ecfdf5; border-color: #a7f3d0; }
      .insights-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; font-size: 14px; color: #0f172a; }
      .badge { font-size: 11px; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(16,185,129,0.4); color: #047857; background: rgba(255,255,255,0.7); font-weight: 600; }
      .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
      .data-table th { text-transform: uppercase; letter-spacing: 0.1em; font-size: 11px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding: 10px; text-align: left; }
      .data-table td { padding: 12px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
      .data-table tr:nth-child(even) { background: #f8fafc; }
      .table-title { font-weight: 600; color: #0f172a; }
      .table-subtitle { font-size: 12px; color: #94a3b8; }
      .text-positive { color: #059669; text-align: right; font-weight: 600; }
      .text-negative { color: #dc2626; text-align: right; font-weight: 600; }
      .summary-section .card-header { margin-bottom: 0; }
      .summary-section table { margin-top: 16px; }
      .text-center { text-align: center; }
      .italic { font-style: italic; }
    </style>
  </head>
  <body>
    <main class="report-container">
      <header class="report-header">
        <div class="header-row">
          <div>
            <p class="header-title">FinScope Premium</p>
            <h1 style="font-size:32px; margin:0 0 6px 0;">Relatório ${escapeHtml(type)}</h1>
            <p class="muted" style="color:rgba(255,255,255,0.8);">Formato A4 · Versão executiva</p>
          </div>
          <div class="muted" style="text-align:right;color:rgba(255,255,255,0.8);">
            <p style="margin:0 0 4px 0; font-size:13px;">Cliente</p>
            <p style="margin:0;font-size:20px;font-weight:600;color:#fff;">${escapeHtml(user.fullName)}</p>
            <p style="margin:4px 0 0 0; font-size:13px;">Período: ${escapeHtml(period)}</p>
          </div>
        </div>
        <div class="header-summary">
          <div>
            <p class="subtitle" style="color:rgba(255,255,255,0.7);">Resumo</p>
            <p style="margin:4px 0 0 0; font-size:18px; font-weight:600;">KPIs consolidados</p>
          </div>
          <p class="muted" style="color:rgba(255,255,255,0.7);">Gerado em ${escapeHtml(generatedAt)}</p>
        </div>
      </header>

      <section class="kpi-grid">
        ${kpiBlocks}
      </section>
      ${forecastBlocks}

      <section class="two-column">
        ${chartBlock}
        ${categoriesTable}
      </section>

      <section>${insightsList}</section>
      ${aiInsightsBlock}

      <section class="card summary-section">
        <div class="card-header">
          <div>
            <p class="subtitle">Movimentações recentes</p>
            <h3>Resumo financeiro</h3>
          </div>
          <span class="muted">${transactions.length ? "Últimas 6 entradas" : "Sem movimentações"}</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows || `<tr><td colspan="4" class="muted text-center">Sem movimentações recentes no período selecionado.</td></tr>`}
          </tbody>
        </table>
      </section>
    </main>
  </body>
</html>
`;

  return html;
}

function buildChartImage(categories: { category: string; amount: number }[]) {
  if (!categories.length) return null;
  const max = Math.max(...categories.map((c) => Number(c.amount) || 0), 1);
  const bars = categories
    .slice(0, 6)
    .map((c, i) => {
      const height = ((Number(c.amount) || 0) / max) * 180;
      return `<rect x="${20 + i * 70}" y="${200 - height}" width="40" height="${height}" fill="#0f172a" rx="6"></rect>
        <text x="${40 + i * 70}" y="215" font-size="12" text-anchor="middle" fill="#475569">${escapeHtml(c.category)}</text>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="240" viewBox="0 0 520 240">
    <rect width="100%" height="100%" fill="#f8fafc"/>
    ${bars}
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
  async function calculateAiProjections(userId: string, scope: AccountScope) {
    const metrics = await storage.getDashboardMetrics(userId, scope);
    const futureTransactions = await storage.getFutureTransactions(userId, scope, "pending");
    const recurring = await storage.getRecurringTransactions(userId, scope);

    const sumByType = (items: { type?: string; amount?: string | number }[], type: "income" | "expense") =>
      items
        .filter((item) => (item.type || "").toLowerCase() === type)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const projectedIncome =
      sumByType(futureTransactions, "income") + sumByType(recurring, "income");
    const projectedExpenses =
      sumByType(futureTransactions, "expense") + sumByType(recurring, "expense");

    const expectedEndBalance = metrics.totalBalance + projectedIncome - projectedExpenses;
    const availableCash = metrics.totalBalance + projectedIncome;
    const deficit = projectedExpenses - availableCash;
    const negativeRisk =
      projectedExpenses <= 0
        ? 0
        : Math.min(100, Math.max(0, (deficit / projectedExpenses) * 100));
    const safeSpendingMargin = Math.max(0, availableCash - projectedExpenses);

    return {
      expectedEndBalance: Number(expectedEndBalance.toFixed(2)),
      negativeRisk: Number(negativeRisk.toFixed(0)),
      safeSpendingMargin: Number(safeSpendingMargin.toFixed(2)),
      projectedIncome: Number(projectedIncome.toFixed(2)),
      projectedExpenses: Number(projectedExpenses.toFixed(2)),
    };
  }

  async function computeCashflowForecast(userId: string, scope: AccountScope) {
    const metrics = await storage.getDashboardMetrics(userId, scope);
    const transactions = await storage.getTransactionsByUserId(userId, scope);
    const futureExpenses = await storage.getFutureExpenses(userId, scope, "pending");
    const recurring = await storage.getRecurringTransactions(userId, scope);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const sumIncome = (start: Date, end?: Date) =>
      transactions
        .filter((tx) => {
          const txDate = new Date(tx.date);
          if (tx.type !== "entrada") return false;
          if (txDate < start) return false;
          if (end && txDate >= end) return false;
          return true;
        })
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const expectedIncome = sumIncome(startOfMonth);
    const previousIncome = sumIncome(startOfPrevMonth, startOfMonth);
    const recurringIncome = recurring
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const recurringExpenses = recurring
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const futureExpensesTotal =
      futureExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0) + recurringExpenses;
    const totalExpectedIncome = expectedIncome + recurringIncome;
    const forecastBalance = metrics.totalBalance + totalExpectedIncome - futureExpensesTotal;
    const freeCash = totalExpectedIncome - futureExpensesTotal;
    const incomeDelta = totalExpectedIncome - previousIncome;

    const projections = await calculateAiProjections(userId, scope);

    return {
      currentBalance: Number(metrics.totalBalance.toFixed(2)),
      expectedIncome: Number(totalExpectedIncome.toFixed(2)),
      previousIncome: Number(previousIncome.toFixed(2)),
      incomeDelta: Number(incomeDelta.toFixed(2)),
      futureExpensesTotal: Number(futureExpensesTotal.toFixed(2)),
      forecastBalance: Number(forecastBalance.toFixed(2)),
      freeCash: Number(freeCash.toFixed(2)),
      projections,
    };
  }
