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
} from "@shared/schema";
import { z } from "zod";

// Extend Express session type
declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(express.json());

  // Configure session with proper settings
  const SessionStore = MemoryStore(session);
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "finscope-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      store: new SessionStore({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: "lax",
      },
    })
  );

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
      
      // Create session
      req.session.userId = user.id;

      // Don't send password back
      const { password, ...userWithoutPassword } = user;
      
      res.json({ user: userWithoutPassword });
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
        
        const { password, ...userWithoutPassword } = user;
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

      const { password, ...userWithoutPassword } = user;
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

  // ===== USER/SETTINGS ROUTES =====
  
  // Update user profile
  app.patch("/api/user/profile", requireAuth, async (req: any, res) => {
    try {
      const updates = updateUserProfileSchema.parse(req.body);
      const updated = await storage.updateUser(req.session.userId, updates);
      
      if (!updated) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const { password, ...userWithoutPassword } = updated;
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

      const { password, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
