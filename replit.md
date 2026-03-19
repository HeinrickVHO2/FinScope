# FinScope - Financial Management Platform

## Overview

FinScope is a B2C financial management platform designed for personal and business finance tracking (PF/PJ). It provides unified financial dashboards, intelligent expense categorization, goal tracking, and comprehensive transaction management. The platform operates on a freemium model with tiered subscriptions and a 10-day trial. Its design is minimalist, inspired by leading fintech applications, focusing on user trust through clear UI and generous whitespace. Key capabilities include AI-driven investment type detection, automated transaction processing, future bill management, and contextualized financial insights.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build:** React 18 with TypeScript, Vite, Wouter for routing.
**State Management:** TanStack Query for server state, React Context for authentication, React hooks for local state.
**UI Component System:** Shadcn/ui with "new-york" preset, Tailwind CSS, CVA.
**Design & Typography:** Minimalist, trust-focused UI with Poppins (headers) and Inter (body). Custom HSL color palette, consistent spacing.
**Form Management:** React Hook Form with Zod validation, shared schemas, integrated error handling.

### Backend Architecture

**Server Framework:** Express.js on Node.js with TypeScript, ESM.
**API Design Pattern:** RESTful API (`/api`) with resource-based routing, authentication middleware, JSON request/response, consistent error handling.
**Authentication & Authorization:** Session-based authentication with HTTP-only cookies, bcrypt for password hashing, role-based access via plan tiers, trial tracking.
**Data Layer:** Supabase PostgreSQL, `IStorage` interface with `SupabaseStorage` implementation, Drizzle ORM for type-safe models, numeric decimals as strings for precision, Row Level Security (RLS).
**Business Logic:** Plan limit enforcement, AI-driven categorization and action processing (transactions, future bills, investment goals), dashboard metrics aggregation.
**Access Control & PJ Restrictions:** Comprehensive PJ validation across all entry points (API endpoints, AI chat, storage layer). Pro users cannot create/view PJ accounts or resources (transactions, future bills) - Premium only. Validation enforced at:
  - API level (POST/GET endpoints)
  - AI action processing (transactions, future_bills)
  - Account filtering (GET /api/accounts returns PF-only for Pro users)
  - All DELETE operations check plan tier

### Data Storage Solutions

**Database:** Supabase PostgreSQL with Drizzle ORM.
**Schema Design:** Tables for Users, Accounts, Transactions, Rules, Investments, Investment_Goals, Investment_Transactions. Uses decimal precision (10,2) for monetary values, UUID primary keys, TIMESTAMPTZ, and foreign key relationships with CASCADE deletion.
**Security:** RLS on all tables with user-scoped policies, service role key used only on the backend, bcrypt for password hashing.

### Development Environment

**Build & Deployment:** `tsx` for development, Vite for client, esbuild for server, environment variable configuration.
**File Structure:** `/client`, `/server`, `/shared`, `/migrations`. Path aliases (`@/`, `@shared/`, `@assets/`).
**AI Integration:** Utilizes OpenAI's GPT-4o for natural language processing, configured with a temperature of 0.7 for balanced creativity and accuracy. Processes user inputs into structured actions (transactions, future bills, investments) for direct database interaction.
**AI Agent Improvements (Nov 2025):**
  - Enhanced financial context: Now loads 15 transactions (was 10), 20 investment goals & 20 active investments
  - Conversation history: Increased from 6 to 20 recent messages for better coherence
  - **FIXED: Duplicate investments** - Agent now checks for similar investments before creating new; updates existing if found
  - **FIXED: Investment detection** - Frontend now filters JSON from display (shows only conversational message)
  - **FIXED: Ultra-fast responses** - Removed confirmation step, responses now 1-sentence max
  - Improved add-to-existing detection via keywords: "adicionar", "mais", "depositar em", "aumentar"

## External Dependencies

**UI Components:** Radix UI primitives, Recharts (data visualization), Lucide React (icons), CMDK (command palette).
**Development Tools:** Replit-specific plugins, TypeScript, PostCSS with Autoprefixer.
**Form & Validation:** React Hook Form, Zod, @hookform/resolvers.
**Styling:** Tailwind CSS 3.x, tailwind-merge, clsx, CSS variables.
**Database:** @supabase/supabase-js for PostgreSQL.
**Session Management:** express-session, memorystore.
**Security:** bcrypt.
**AI/LLM:** OpenAI (GPT-4o).
**PDF Generation:** Puppeteer (with Chromium via Nix packages).
**Payment Integration (Planned):** Cakto payment gateway (PIX, automatic billing).
**Monitoring & Analytics (Planned):** Vercel Analytics.