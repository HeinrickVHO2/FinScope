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
import MemoryStore from "memorystore";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { buildPremiumInsights } from "./insights";
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
} from "@shared/schema";
import type { User } from "@shared/schema";
import { z } from "zod";
import { randomUUID } from "crypto";


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

  app.post("/api/pdf/export", requireAuth, requireActiveBilling, async (req: any, res) => {
    const { type = "financeiro", period = "últimos 30 dias", includeCharts = true, includeInsights = true } = req.body || {};

    try {
      const user = req.currentUser || (await storage.getUser(req.session.userId));
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      const requestedReportType = String(req.body.reportType || "").toLowerCase();
      const normalizedLabel = String(type).toLowerCase();
      const isBusinessReport =
        requestedReportType === "empresarial" ||
        requestedReportType === "mei" ||
        normalizedLabel.includes("empresarial") ||
        normalizedLabel.includes("mei");
      if (isBusinessReport && user.plan !== "premium") {
        return res.status(403).json({ error: "Relatórios empresariais disponíveis apenas no plano Premium" });
      }

      const [metrics, transactions, categories] = await Promise.all([
        storage.getDashboardMetrics(req.session.userId),
        storage.getTransactionsByUserId(req.session.userId),
        storage.getCategoryBreakdown(req.session.userId),
      ]);

      const insights = includeInsights ? buildPremiumInsights(transactions) : [];
      const chartImage = includeCharts ? buildChartImage(categories) : null;
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
      });

      const browser = await puppeteer.launch({
        headless: "new",
        executablePath: puppeteerExecutable ?? undefined,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--single-process",
          "--no-zygote",
        ],
        dumpio: process.env.NODE_ENV !== "production",
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", bottom: "20mm", left: "12mm", right: "12mm" },
      });
      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=finscope-report.pdf");
      res.setHeader("Content-Length", pdfBuffer.length.toString());
      res.status(200);
      res.end(pdfBuffer);
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
      req.currentUser = user;
      if (user.billingStatus !== "active") {
        return res.status(403).json({ error: "Pagamento pendente" });
      }
      next();
    } catch (error) {
      next(error);
    }
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
      const transactions = await storage.getTransactionsByUserId(req.session.userId);
      if (req.currentUser?.plan !== "premium") {
        const accounts = await storage.getAccountsByUserId(req.session.userId);
        const allowedIds = new Set(accounts.filter((acc) => acc.type !== "pj").map((acc) => acc.id));
        return res.json(transactions.filter((tx) => allowedIds.has(tx.accountId)));
      }
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
      if (account.type === "pj" && req.currentUser?.plan !== "premium") {
        return res.status(403).json({ error: "Transações em contas PJ disponíveis apenas no plano Premium" });
      }

      const data = insertTransactionSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });
      const transaction = await storage.createTransaction({ ...data, accountId });
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
      const updates = updateTransactionSchema.parse(req.body);
      const updated = await storage.updateTransaction(req.params.id, updates);
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
      const metrics = await storage.getDashboardMetrics(req.session.userId);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar métricas" });
    }
  });

  // Get category breakdown
  app.get("/api/dashboard/categories", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const categories = await storage.getCategoryBreakdown(req.session.userId);
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
      const data = await storage.getIncomeExpensesData(req.session.userId);
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

  // Export transactions to CSV
  app.get("/api/export/transactions", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const transactions = await storage.getTransactionsByUserId(req.session.userId);
      const accounts = await storage.getAccountsByUserId(req.session.userId);
      const accountMap = new Map(accounts.map(a => [a.id, a]));
      const exportTransactions =
        req.currentUser?.plan === "premium"
          ? transactions
          : transactions.filter((t) => accountMap.get(t.accountId)?.type !== "pj");
      
      // Generate CSV
      const headers = ["Data", "Descrição", "Conta", "Tipo", "Categoria", "Valor"];
      const rows = exportTransactions.map(t => {
        const date = new Date(t.date).toLocaleDateString('pt-BR');
        const accountName = accountMap.get(t.accountId)?.name || "Conta desconhecida";
        const type = t.type === "entrada" ? "Entrada" : "Saída";
        const amount = `R$ ${parseFloat(t.amount).toFixed(2).replace('.', ',')}`;
        
        return [
          date,
          `"${t.description.replace(/"/g, '""')}"`, // Escape quotes
          `"${accountName}"`,
          type,
          t.category,
          amount
        ].join(',');
      });

      
      
      const csv = [headers.join(','), ...rows].join('\n');
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="transacoes_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send('\uFEFF' + csv); // Add BOM for Excel UTF-8 support
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

  const shellPath = findExecutableRecursive(
    path.join(os.homedir(), ".cache/puppeteer"),
    "chrome-headless-shell"
  );
  if (shellPath) {
    return shellPath;
  }

  try {
    const bundledPath = puppeteer.executablePath();
    if (bundledPath && fs.existsSync(bundledPath)) {
      return bundledPath;
    }
  } catch (error) {
    console.warn("[PDF EXPORT] Unable to resolve bundled Chromium executable:", error);
  }

  return null;
}

function findExecutableRecursive(dir: string, executableName: string, depth = 0, maxDepth = 5): string | null {
  if (!fs.existsSync(dir) || depth > maxDepth) {
    return null;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name === executableName) {
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
}) {
  const summaryRows = transactions.slice(0, 6).map((tx) => {
    const date = new Date(tx.date || tx.createdAt || Date.now());
    return `
      <tr class="border-b border-slate-200">
        <td class="py-2 text-sm">${date.toLocaleDateString("pt-BR")}</td>
        <td class="py-2 text-sm">${escapeHtml(tx.description ?? tx.category ?? "-")}</td>
        <td class="py-2 text-sm">${escapeHtml(tx.category ?? "-")}</td>
        <td class="py-2 text-sm text-right ${tx.type === "saida" ? "text-red-500" : "text-emerald-600"}">
          ${tx.type === "saida" ? "-" : ""}${formatCurrency(Number(tx.amount || 0))}
        </td>
      </tr>
    `;
  }).join("");

  const categoriesRows = categories.slice(0, 8).map((cat, index) => {
    return `
      <tr class="border-b border-slate-100">
        <td class="py-3 text-xs font-semibold text-slate-500">${index + 1}</td>
        <td class="py-3">
          <p class="text-sm font-medium text-slate-900">${escapeHtml(cat.category)}</p>
          <p class="text-xs text-slate-500">Participação ${((Number(cat.amount) / (metrics.monthlyExpenses || 1)) * 100).toFixed(1)}%</p>
        </td>
        <td class="py-3 text-right text-sm font-semibold text-slate-900">${formatCurrency(Number(cat.amount))}</td>
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
    <div class="rounded-3xl border border-slate-100 bg-slate-50/70 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.08)]">
      <p class="text-xs uppercase tracking-wide text-slate-500">${kpi.label}</p>
      <p class="text-3xl font-semibold text-slate-900 mt-2">${kpi.value}</p>
    </div>`
  ).join("");

  const insightsList = `
    <div class="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6 shadow-sm">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-slate-900">Insights inteligentes</h3>
        <span class="text-xs font-medium text-emerald-600 bg-white/70 px-3 py-1 rounded-full border border-emerald-100">Premium</span>
      </div>
      ${
        insights.length
          ? `<ul class="space-y-2 text-sm text-slate-700 list-disc pl-5">${insights
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}</ul>`
          : `<p class="text-sm text-slate-500 italic">Os insights estratégicos aparecerão aqui assim que tivermos dados suficientes.</p>`
      }
    </div>
  `;

  const chartBlock = `
    <div class="rounded-3xl border border-slate-100 bg-slate-50/60 p-6 shadow-sm flex flex-col min-h-[320px]">
      <div class="flex items-center justify-between mb-4">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500">Distribuição por categoria</p>
          <h3 class="text-lg font-semibold text-slate-900">Painel de gastos</h3>
        </div>
        <span class="text-xs text-slate-500">${includeCharts ? "Base64 embutido" : "Sem gráfico"}</span>
      </div>
      ${
        includeCharts && chartImage
          ? `<img src="${chartImage}" class="w-full rounded-xl border border-slate-200 shadow-inner bg-white object-cover flex-1" alt="Gráfico base64"/>`
          : `<div class="flex-1 border border-dashed border-slate-300 rounded-xl grid place-items-center text-sm text-slate-400 italic">Cole aqui o gráfico em base64</div>`
      }
    </div>
  `;

  const categoriesTable = `
    <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500">Principais categorias</p>
          <h3 class="text-lg font-semibold text-slate-900">Ranking por impacto</h3>
        </div>
        <span class="text-xs text-slate-500">${categories.length ? "Top 8" : "Sem dados"}</span>
      </div>
      <table class="w-full text-left">
        <thead>
          <tr class="text-xs uppercase text-slate-500 border-b border-slate-200">
            <th class="py-2 w-12">#</th>
            <th class="py-2">Categoria</th>
            <th class="py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${
            categoriesRows ||
            `<tr><td colspan="3" class="py-6 text-center text-sm text-slate-500">Sem categorias suficientes neste período.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;

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
    </style>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-[#f1f4fb]">
    <main class="mx-auto max-w-[900px] bg-white min-h-screen py-10 px-10 shadow-[0_40px_120px_rgba(15,23,42,0.12)]">
      <header class="rounded-3xl bg-slate-900 text-white p-8 mb-10 flex flex-col gap-6">
        <div class="flex items-center justify-between gap-6">
          <div>
            <p class="text-sm uppercase tracking-[0.2em] text-slate-300">FinScope Premium</p>
            <h1 class="text-3xl font-semibold mt-2">Relatório ${escapeHtml(type)}</h1>
            <p class="text-sm text-slate-200 mt-1">Formato A4 · Versão executiva</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-slate-300">Cliente</p>
            <p class="text-xl font-semibold text-white">${escapeHtml(user.fullName)}</p>
            <p class="text-sm text-slate-300">Período: ${escapeHtml(period)}</p>
          </div>
        </div>
        <div class="border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.15em] text-slate-300">Resumo</p>
            <p class="text-lg font-semibold">KPIs consolidados</p>
          </div>
          <p class="text-sm text-slate-300">Gerado em ${escapeHtml(generatedAt)}</p>
        </div>
      </header>

      <section class="grid grid-cols-2 gap-6 mb-10">
        ${kpiBlocks}
      </section>

      <section class="grid grid-cols-2 gap-6 mb-10">
        ${chartBlock}
        ${categoriesTable}
      </section>

      <section class="mb-10">
        ${insightsList}
      </section>

      <section class="rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500">Movimentações recentes</p>
            <h3 class="text-lg font-semibold text-slate-900">Resumo financeiro</h3>
          </div>
          <span class="text-xs text-slate-500">${transactions.length ? "Últimas 6 entradas" : "Sem movimentações"}</span>
        </div>
        <table class="w-full text-left">
          <thead>
            <tr class="text-xs uppercase text-slate-500 border-b border-slate-200">
              <th class="py-2">Data</th>
              <th class="py-2">Descrição</th>
              <th class="py-2">Categoria</th>
              <th class="py-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows || `<tr><td colspan="4" class="py-6 text-center text-sm text-slate-500">Sem movimentações recentes no período selecionado.</td></tr>`}
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
