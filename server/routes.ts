import type { Express } from "express";
import express from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
import { z } from "zod";

// Extend Express session type
declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Middleware to check authentication
  function requireAuth(req: any, res: any, next: any) {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    next();
  }

  // ===== AUTH ROUTES =====
  
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
  app.get("/api/accounts", requireAuth, async (req: any, res) => {
    try {
      const accounts = await storage.getAccountsByUserId(req.session.userId);
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar contas" });
    }
  });

  // Get single account
  app.get("/api/accounts/:id", requireAuth, async (req: any, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account || account.userId !== req.session.userId) {
        return res.status(404).json({ error: "Conta não encontrada" });
      }
      res.json(account);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar conta" });
    }
  });

  // Create account
  app.post("/api/accounts", requireAuth, async (req: any, res) => {
    try {
      const data = insertAccountSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });
      const account = await storage.createAccount(data);
      res.json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Update account
  app.patch("/api/accounts/:id", requireAuth, async (req: any, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account || account.userId !== req.session.userId) {
        return res.status(404).json({ error: "Conta não encontrada" });
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
  app.delete("/api/accounts/:id", requireAuth, async (req: any, res) => {
    try {
      const account = await storage.getAccount(req.params.id);
      if (!account || account.userId !== req.session.userId) {
        return res.status(404).json({ error: "Conta não encontrada" });
      }

      await storage.deleteAccount(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ===== TRANSACTION ROUTES =====
  
  // Get all transactions for user
  app.get("/api/transactions", requireAuth, async (req: any, res) => {
    try {
      const transactions = await storage.getTransactionsByUserId(req.session.userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar transações" });
    }
  });

  // Get transactions by account
  app.get("/api/accounts/:accountId/transactions", requireAuth, async (req: any, res) => {
    try {
      const account = await storage.getAccount(req.params.accountId);
      if (!account || account.userId !== req.session.userId) {
        return res.status(404).json({ error: "Conta não encontrada" });
      }

      const transactions = await storage.getTransactionsByAccountId(req.params.accountId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar transações" });
    }
  });

  // Create transaction
  app.post("/api/transactions", requireAuth, async (req: any, res) => {
    try {
      const data = insertTransactionSchema.parse({
        ...req.body,
        userId: req.session.userId,
      });
      const transaction = await storage.createTransaction(data);
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // Update transaction
  app.patch("/api/transactions/:id", requireAuth, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction || transaction.userId !== req.session.userId) {
        return res.status(404).json({ error: "Transação não encontrada" });
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
  app.delete("/api/transactions/:id", requireAuth, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction || transaction.userId !== req.session.userId) {
        return res.status(404).json({ error: "Transação não encontrada" });
      }

      await storage.deleteTransaction(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ===== RULE ROUTES =====
  
  // Get all rules for user
  app.get("/api/rules", requireAuth, async (req: any, res) => {
    try {
      const rules = await storage.getRulesByUserId(req.session.userId);
      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar regras" });
    }
  });

  // Create rule
  app.post("/api/rules", requireAuth, async (req: any, res) => {
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
  app.patch("/api/rules/:id", requireAuth, async (req: any, res) => {
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
  app.delete("/api/rules/:id", requireAuth, async (req: any, res) => {
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

  // ===== DASHBOARD ROUTES =====
  
  // Get dashboard metrics
  app.get("/api/dashboard/metrics", requireAuth, async (req: any, res) => {
    try {
      const metrics = await storage.getDashboardMetrics(req.session.userId);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar métricas" });
    }
  });

  // Get category breakdown
  app.get("/api/dashboard/categories", requireAuth, async (req: any, res) => {
    try {
      const categories = await storage.getCategoryBreakdown(req.session.userId);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar categorias" });
    }
  });

  // Get investments summary
  app.get("/api/dashboard/investments", requireAuth, async (req: any, res) => {
    try {
      const summary = await storage.getInvestmentsSummary(req.session.userId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar investimentos" });
    }
  });

  app.get("/api/dashboard/income-expenses", requireAuth, async (req: any, res) => {
    try {
      const data = await storage.getIncomeExpensesData(req.session.userId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar receitas e despesas" });
    }
  });

  // ===== INVESTMENT ROUTES =====

  // Get all investments
  app.get("/api/investments", requireAuth, async (req: any, res) => {
    try {
      const investments = await storage.getInvestmentsByUserId(req.session.userId);
      res.json(investments);
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar investimentos" });
    }
  });

  // Create investment
  app.post("/api/investments", requireAuth, async (req: any, res) => {
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
  app.patch("/api/investments/:id", requireAuth, async (req: any, res) => {
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
  app.delete("/api/investments/:id", requireAuth, async (req: any, res) => {
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
  app.get("/api/investments/:id/goal", requireAuth, async (req: any, res) => {
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
  app.post("/api/investments/:id/goal", requireAuth, async (req: any, res) => {
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
  app.delete("/api/investments/:id/goal", requireAuth, async (req: any, res) => {
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
  app.get("/api/investments/:id/transactions", requireAuth, async (req: any, res) => {
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
  app.post("/api/investments/:id/transactions", requireAuth, async (req: any, res) => {
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
  app.post("/api/investment-transactions", requireAuth, async (req: any, res) => {
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
  app.patch("/api/user/profile", requireAuth, async (req: any, res) => {
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
  app.patch("/api/user/plan", requireAuth, async (req: any, res) => {
    try {
      const { plan } = req.body;
      if (!["free", "pro", "premium"].includes(plan)) {
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
        createdAt: updated.createdAt,
      };
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  // ===== EXPORT ROUTES =====

  // Export transactions to CSV
  app.get("/api/export/transactions", requireAuth, async (req: any, res) => {
    try {
      const transactions = await storage.getTransactionsByUserId(req.session.userId);
      const accounts = await storage.getAccountsByUserId(req.session.userId);
      
      // Create account lookup map
      const accountMap = new Map(accounts.map(a => [a.id, a.name]));
      
      // Generate CSV
      const headers = ["Data", "Descrição", "Conta", "Tipo", "Categoria", "Valor"];
      const rows = transactions.map(t => {
        const date = new Date(t.date).toLocaleDateString('pt-BR');
        const accountName = accountMap.get(t.accountId) || "Conta desconhecida";
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

  // ===== CACKTO PAYMENT ROUTES =====

  // Create checkout session (called before user signup)
  app.post("/api/checkout/create", async (req, res) => {
    try {
      const { email, fullName, plan } = req.body;
      
      if (!email || !fullName || !plan) {
        return res.status(400).json({ error: "Email, nome completo e plano são obrigatórios" });
      }

      if (!["pro", "premium"].includes(plan)) {
        return res.status(400).json({ error: "Plano inválido. Escolha 'pro' ou 'premium'" });
      }

      // TODO: Implement Cackto API integration here
      // For now, return a placeholder response
      res.json({
        success: true,
        checkoutUrl: "https://checkout.cakto.com.br/placeholder",
        message: "Integração com Cackto em desenvolvimento"
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Webhook endpoint to receive Cackto payment events
  app.post("/api/webhooks/cackto", async (req, res) => {
    try {
      const event = req.body;
      
      console.log("[Cackto Webhook] Received event:", event.event || event.type);
      
      // Validate webhook signature (TODO: implement when we have API key)
      
      const eventType = event.event || event.type;
      
      switch (eventType) {
        case "payment.approved":
          console.log("[Cackto] Payment approved:", event.order_id);
          // TODO: Create user account and activate trial
          break;
          
        case "payment.pending":
          console.log("[Cackto] Payment pending:", event.order_id);
          break;
          
        case "payment.rejected":
          console.log("[Cackto] Payment rejected:", event.order_id);
          break;
          
        case "subscription.renewed":
          console.log("[Cackto] Subscription renewed:", event.order_id);
          // TODO: Extend subscription period
          break;
          
        case "subscription.cancelled":
          console.log("[Cackto] Subscription cancelled:", event.order_id);
          // TODO: Downgrade user to free plan
          break;
          
        default:
          console.log("[Cackto] Unknown event type:", eventType);
      }
      
      // Always return 200 to acknowledge receipt
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[Cackto Webhook] Error:", error);
      // Still return 200 to avoid retries
      res.status(200).json({ received: true, error: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
