# FinScope - Financial Management Platform

## Recent Changes (November 14, 2025)

**Dashboard & Account Model Improvements - PRODUCTION READY ✅**
- ✅ Fixed investment type labels: changed from hyphen to underscore (reserva_emergencia, renda_fixa, renda_variavel)
- ✅ Charts now display professional labels: "Reserva de Emergência", "CDB", "Renda Fixa", "Renda Variável"
- ✅ Added Income vs Expenses bar chart to dashboard with proper aggregation
- ✅ Refactored account model: 'pessoal'/'empresa' → 'pf'/'pj'/'mei' (Pessoa Física, Pessoa Jurídica, MEI)
- ✅ MEI accounts restricted to Premium users (enforced at backend API level)
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

FinScope is a B2C financial management platform offering personal finance tracking and microenterprise (MEI) management. It provides unified financial dashboards, intelligent expense categorization, goals tracking, and comprehensive transaction management for both personal and business accounts. The platform operates on a freemium model with tiered subscriptions and a 10-day trial period. Its design is minimalist, inspired by leading fintech applications.

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