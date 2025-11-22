# FinScope - Financial Management Platform

## Recent Changes (November 22, 2025)

**AI Financial Assistant Complete Refactoring - PRODUCTION READY ✅**
- ✅ **Consolidated all prompts** into single `ai/conversationalPrompt.ts` with clear structure (system prompt + user prompt with context)
- ✅ **Redesigned state management**: conversations auto-reset after success/failure, new conversations start in idle state, no stale data
- ✅ **Refactored confirmation logic**: AI generates humanized conversational messages, backend only validates/executes JSON actions
- ✅ **Fixed response priority**: (1) AI conversational message, (2) AI clarification, (3) hardcoded fallbacks only when AI fails
- ✅ **Fixed date handling**: system prompt includes current date (2025-11-22) so AI uses correct dates instead of 1970-01-01
- ✅ **Preserved conversationalMessage field**: `interpretTransactionFromMessage()` now returns AI-generated messages to frontend
- ✅ **Enhanced personality**: Brazilian financial consultant (friendly, direct, never robotic), context-aware, automatic intent detection
- ✅ **Security maintained**: `sanitizeUserInput()` detects 15+ injection patterns, resets state on dangerous input, logs security events
- ✅ **E2E tests passing**: humanized messages appear correctly, dates accurate, transactions created successfully, recurring detection works
- ⚠️ **MONITORING REQUIRED**: Track real-world conversational quality and adjust system prompt based on user feedback

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
