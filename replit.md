# FinScope - Financial Management Platform

## Recent Changes (November 22, 2025)

**IA: Detecção de Contas Futuras - FUNCIONANDO COM GPT-4o ✅**
- ✅ **Infraestrutura completa**: Backend preparado para processar `actions[]` da IA
- ✅ **Tipo `AiInterpretationSuccess`**: Inclui campo `actions[]` com suporte a transaction/future_bill/goal
- ✅ **Pipeline de processamento**: Detecta quando IA retorna `actions[]` e executa automaticamente
- ✅ **Prompt otimizado**: Instruções claras + exemplos práticos + correção de instruções contraditórias
- ✅ **GPT-4o configurado**: Upgrade de GPT-4o-mini para GPT-4o em todos os módulos (routes, aiReports, aiInsights)
- ✅ **Temperature: 0.7**: Configuração ideal para IA ser proativa sem perder precisão
- ✅ **Correções TypeScript**: 13 erros LSP corrigidos (tipos, regex flags, etc.)
- ✅ **Prompt corrigido**: Removida linha 178 que causava conflito (type: "scheduled" → type: "future_bill")
- ✅ **Regras críticas enfatizadas**: "preciso pagar" + data futura = actions[{type: "future_bill"}] sem perguntar tipo
- 📌 **Status**: Sistema 100% FUNCIONAL com GPT-4o - cria future_bills automaticamente
- 📌 **Rota**: `/api/future-expenses` (backend cria registros quando IA retorna actions[])

**AI Agent Now Controls Entire Platform ✅**
- ✅ **Botões de Insight funcionando**: "Foco em economia", "Foco em dívidas", "Foco em investimentos" alternam entre True/False
- ✅ **Foco persistido**: Salvo em localStorage (frontend) e db (backend via `/api/ai/insight-focus`)
- ✅ **IA prioriza insights**: Quando foco ativado, prompt da IA prioriza análises na área selecionada
- ✅ **Transações criadas IMEDIATAMENTE**: Supabase - sem confirmar, apenas registra
- ✅ **Contas futuras criadas via IA**: IA pode criar "future_transactions" com dueDate
- ✅ **Metas financeiras criadas via IA**: IA pode criar "investment_goals" com target_value
- ✅ **Ações estruturadas retornadas**: Backend retorna `actions[]` com type (transaction/future_bill/goal)
- ✅ **JSON nunca mostrado**: Ações processadas silenciosamente pelo frontend, apenas mensagem exibida
- ✅ **Contexto financeiro automático**: IA usa histórico de transações, contas futuras, metas para respostas
- ✅ **Perguntas gerais com contexto**: "Quanto gastei?" → Resposta personalizada com dados reais
- ✅ **Dicas contextualizadas**: "Você gastou R$ 420 em mercado. Se reduzir 10%, sobra R$ 42 para investir"
- ✅ **Sincronia automática**: Ações disparam evento `ai-action-completed` para atualizar abas
- ✅ **Security mantida**: `sanitizeUserInput()` em funcionamento, input injection bloqueado

**PDF Export Fix for Production - READY FOR TESTING ✅**
- ✅ Added Chromium system dependency via Nix packages (resolves `libglib-2.0.so.0` error)
- ✅ Updated Puppeteer executable resolution to prioritize system Chromium over bundled Chrome
- ✅ Enhanced error logging to help debug Chrome/Chromium availability issues
- ✅ Increased `protocolTimeout` to 60 seconds (fixes "Network.enable timed out" error)
- ✅ Added GPU-disabling flags for better headless stability (`--disable-gpu`, `--disable-software-rasterizer`)
- ✅ Chromium verified in development: `/nix/store/.../bin/chromium`
- ⚠️ **TESTING REQUIRED**: Deploy and test PDF export functionality in production environment

**Deployment Fixes - READY FOR DEPLOYMENT ✅**
- ✅ Fixed dotenv loading issue: conditional check prevents loading .env files in production/deployment
- ✅ Added `/health` endpoint for Autoscale (Cloud Run) health checks
- ✅ Health check returns `{ status: 'ok', timestamp }` with HTTP 200
- ⚠️ **ACTION REQUIRED**: Add SUPABASE_ANON_KEY to deployment secrets (see deployment instructions below)

**Investment Goals UX + Landing Page Improvements - PRODUCTION READY ✅**
- ✅ Replaced browser prompt() with proper Dialog form for investment goal creation/editing
- ✅ Added Tooltip components on icon-only buttons (Target, Delete) for better accessibility
- ✅ Fixed critical cache bug: changed from invalidateQueries() to refetchQueries() to handle staleTime: Infinity
- ✅ Fixed hoisting bug: moved goalsMap initialization before function definitions
- ✅ Investment goals now update UI immediately after creation/editing
- ✅ Landing page: removed Free plan, kept only Pro (R$14,90) and Premium (R$29,90) with 10-day trial
- ✅ Landing page: added mobile-responsive navigation with Sheet-based hamburger menu
- ✅ Landing page: fixed pricing grid layout (md:grid-cols-2 with justify-items-center) for balanced appearance
- ✅ All E2E tests passing: mobile/desktop navigation, goal creation workflow

**Dashboard & Account Model Improvements - PRODUCTION READY ✅**
- ✅ Fixed investment type labels: changed from hyphen to underscore (reserva_emergencia, renda_fixa, renda_variavel)
- ✅ Charts now display professional labels: "Reserva de Emergência", "CDB", "Renda Fixa", "Renda Variável"
- ✅ Added Income vs Expenses bar chart to dashboard with proper aggregation
- ✅ Refactored account model: 'pessoal'/'empresa' → 'pf'/'pj' com categoria empresarial (ex: MEI)
- ✅ MEI agora é uma categoria opcional dentro de contas PJ, mantendo compatibilidade com planos Premium
- ✅ Database migration completed: accounts constraint updated to accept new types
- ✅ Fixed Select component bug in account creation form (defaultValue → value)

**Investment Transactions - PRODUCTION READY ✅**
- ✅ Implemented atomic investment transactions using PostgreSQL stored procedure with SELECT FOR UPDATE locking
- ✅ Fixed critical PostgREST schema cache issues (created `reload_postgrest_schema()` function)
- ✅ Added missing database columns: `user_id` in investment_transactions, `current_amount` in investments
- ✅ Fixed security vulnerability: validates both account AND investment ownership to prevent unauthorized access
- ✅ All operations wrapped in single atomic transaction with row-level locking (prevents race conditions)
- ✅ Complete deposit/withdrawal support: deposits create 'saida', withdrawals create 'entrada' transactions
- ✅ E2E tests passing: R$ 0 → R$ 1.000 (deposit) → R$ 1.500 (deposit) - all balances sync correctly
- ✅ Dashboard charts, account balances, and investment totals all in sync
- ✅ Investment feature fully integrated: create/update investments, track goals, transactions, view dashboard charts

## Overview

FinScope is a B2C financial management platform offering personal and business finance tracking (PF/PJ). It provides unified financial dashboards, intelligent expense categorization, goals tracking, and comprehensive transaction management for both personal and corporate accounts. The platform operates on a freemium model with tiered subscriptions and a 10-day trial period. Its design is minimalist, inspired by leading fintech applications.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:** React 18 with TypeScript, Vite for build and HMR, Wouter for client-side routing.
**State Management:** TanStack Query for server state, React Context for authentication, React hooks for local component state.
**UI Component System:** Shadcn/ui with "new-york" style preset, Tailwind CSS for utility styling, CVA for type-safe variants. Design emphasizes trust with generous whitespace.
**Typography & Design Tokens:** Poppins Bold for headers, Inter Regular for body text. Custom HSL-based color palette for light/dark modes, consistent spacing primitives.
**Form Management:** React Hook Form with Zod validation for type-safe forms, shared schemas between frontend and backend, integrated error handling.

### Backend Architecture

**Server Framework:** Express.js on Node.js with TypeScript, ESM for modern syntax, express-session for session-based authentication, custom middleware.
**API Design Pattern:** RESTful API under `/api`, resource-based routing, authentication middleware for private routes, JSON request/response with consistent error handling.
**Authentication & Authorization:** Session-based authentication with HTTP-only cookies, bcrypt for password hashing, role-based access via plan tiers, trial period tracking.
**Data Layer Architecture:** Supabase PostgreSQL, `IStorage` interface with `SupabaseStorage` implementation, Drizzle ORM for type-safe models, numeric decimals as strings for precision, Supabase client with service role key, Row Level Security (RLS).
**Business Logic:** Plan limit enforcement, automatic categorization rules, dashboard metrics aggregation, category-based spending analysis.

### Data Storage Solutions

**Database Configuration:** Supabase PostgreSQL, Drizzle ORM schema definitions (TypeScript), environment variables for Supabase credentials.
**Schema Design:** Tables include Users, Accounts, Transactions, Rules, Investments, Investment_Goals, Investment_Transactions.
**Data Models:** Decimal precision (10,2) for monetary values, UUID-based primary keys, Timestamps (TIMESTAMPTZ), foreign key relationships with CASCADE deletion.
**Current Implementation:** `SupabaseStorage` class, Supabase client for CRUD operations, RLS for user data isolation, database indexes for query optimization, Zod validation before database operations, true data persistence.
**Security Features:** RLS on all tables with user-scoped policies, service role key used only on backend, secure password hashing with bcrypt.

### Development Environment

**Build & Deployment:** `tsx` for development, Vite for client build, esbuild for server bundling, environment variable configuration, separate client/server builds.
**File Structure:** `/client` (React frontend), `/server` (Express backend), `/shared` (shared schemas/types), `/migrations` (Drizzle migration files), path aliases (`@/`, `@shared/`, `@assets/`).

## External Dependencies

**UI Component Library:** Radix UI primitives, Recharts for data visualization, Lucide React for icons, CMDK for command palette.
**Development Tools:** Replit-specific plugins, TypeScript compiler, PostCSS with Autoprefixer.
**Form & Validation:** React Hook Form, Zod, @hookform/resolvers.
**Styling & Theming:** Tailwind CSS 3.x, tailwind-merge, clsx, CSS variables for theme customization.
**Database & Storage:** @supabase/supabase-js for PostgreSQL, Supabase PostgreSQL.
**Session Management:** express-session, memorystore (development).
**Password Security:** bcrypt.
**Payment Integration (Planned):** Cakto payment gateway (PIX, automatic billing), webhook handling.
**Monitoring & Analytics (Planned):** Vercel Analytics.
