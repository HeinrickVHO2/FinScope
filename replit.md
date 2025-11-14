# FinScope - Financial Management Platform

## Overview

FinScope is a B2C financial management platform that combines personal finance tracking with simplified microenterprise (MEI) management. The application provides unified financial dashboards, intelligent expense categorization, goals tracking, and comprehensive transaction management for both personal and business accounts.

The platform follows a freemium model with tiered subscriptions (Free, Pro, Premium), offering a 10-day trial period with full access to premium features. It's designed with a modern, minimalist aesthetic inspired by fintech leaders like Nubank, Stripe Dashboard, and Linear.

## Recent Changes

**November 14, 2025 - Supabase Integration Complete**

✅ **Supabase Migration** (Task 4 - In Progress)
- Installed @supabase/supabase-js package for PostgreSQL integration
- Created Supabase client with service role key authentication (`server/supabase.ts`)
- Implemented SupabaseStorage class replacing MemStorage (`server/supabaseStorage.ts`)
- Migrated storage layer to use Supabase PostgreSQL instead of in-memory Maps
- Created database schema with 4 tables: users, accounts, transactions, rules
- Configured Row Level Security (RLS) policies for all tables
- Added database indexes for optimized query performance
- Set up automatic cascade deletion for related records
- All CRUD operations now persist to real PostgreSQL database
- Data survives server restarts (true persistence achieved)

**November 14, 2025 - MVP Core Features Completed**

✅ **Backend Implementation** (Task 2)
- Implemented 20+ RESTful API endpoints for authentication, accounts, transactions, and dashboard
- Added bcrypt password hashing with secure session-based authentication
- Implemented express-session with MemoryStore for HTTP-only cookie sessions
- Built complete storage interface with in-memory implementation (IStorage)
- Added plan-based limit enforcement (Free: 1 account, Pro: 3 accounts, Premium: unlimited)
- Implemented dashboard aggregation endpoints for financial metrics and category analysis
- Applied strict Zod validation for all API inputs with 2-decimal precision for monetary values

✅ **Frontend-Backend Integration** (Task 3)
- Connected all pages to backend APIs using TanStack Query
- Implemented AuthProvider with session-based authentication (no localStorage/JWTs)
- Built Login/Signup pages with proper error handling and form validation
- Completed Dashboard with real-time metrics, charts, and recent transactions
- Built Accounts page with CRUD operations and plan limit enforcement
- Built Transactions page with full CRUD, filtering, search, and categorization
- Added comprehensive loading states using Skeleton components
- Fixed critical security issues: removed client-side userId (server session only)
- Fixed date serialization to use ISO strings for backend compatibility
- Verified credentials: "include" on all API requests for cookie-based auth

✅ **End-to-End Testing**
- Passed comprehensive E2E tests covering signup → account creation → transaction management → dashboard metrics → logout
- Verified plan limits, balance calculations, and data persistence across all features
- Confirmed session persistence and proper authentication flow

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server with HMR (Hot Module Replacement)
- Client-side routing using Wouter (lightweight alternative to React Router)
- Component composition using Radix UI primitives for accessible, unstyled components

**State Management**
- TanStack Query (React Query) for server state management, caching, and data synchronization
- React Context API for authentication state and user session management
- Local component state with React hooks for UI interactions

**UI Component System**
- Shadcn/ui component library with "new-york" style preset
- Tailwind CSS for utility-first styling with custom design tokens
- Class Variance Authority (CVA) for type-safe component variants
- Design system enforces trust-focused financial UI with generous whitespace and clear hierarchy

**Typography & Design Tokens**
- Headers: Poppins Bold (600-700 weight) for titles and emphasis
- Body: Inter Regular (400 weight) for content, Medium (500) for financial data
- Custom color palette with HSL-based theming supporting light/dark modes
- Consistent spacing primitives (2, 4, 6, 8, 12, 16, 20, 24) for visual rhythm

**Form Management**
- React Hook Form with Zod validation for type-safe form handling
- Schema validation shared between frontend and backend
- Integrated error handling and display through form components

### Backend Architecture

**Server Framework**
- Express.js running on Node.js with TypeScript
- ESM (ECMAScript Modules) for modern import/export syntax
- Session-based authentication using express-session with memory store
- Custom middleware for request logging and error handling

**API Design Pattern**
- RESTful API endpoints under `/api` prefix
- Resource-based routing (users, accounts, transactions, rules)
- Authentication middleware protecting private routes
- JSON request/response format with consistent error handling

**Authentication & Authorization**
- Session-based authentication with HTTP-only cookies
- Password hashing using bcrypt for secure credential storage
- Role-based access through plan tiers (free, pro, premium)
- Trial period tracking with start/end timestamps

**Data Layer Architecture**
- Supabase PostgreSQL database for persistent storage (production-ready)
- Interface-based storage abstraction (`IStorage`) with SupabaseStorage implementation
- Type-safe data models with Drizzle ORM schema definitions
- Numeric decimal handling converted to strings for precision in financial calculations
- Supabase client using service role key for backend operations
- Row Level Security (RLS) enabled for all tables with user-scoped policies

**Business Logic**
- Plan limits enforcement (account limits, feature gating by tier)
- Automatic categorization rules for Premium users
- Dashboard metrics aggregation (total balance, monthly income/expenses, net cash flow)
- Category-based spending analysis and visualization data

### Data Storage Solutions

**Database Configuration (Supabase PostgreSQL)**
- Supabase PostgreSQL database with managed infrastructure
- Drizzle ORM schema definitions (TypeScript with type inference)
- Environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- Service role key used for backend database operations (bypasses RLS)

**Schema Design**
- **Users Table**: Authentication credentials, plan tier, trial period tracking
- **Accounts Table**: Financial accounts (personal or business type), initial balance
- **Transactions Table**: Financial entries with amount, category, type (entrada/saida), date
- **Rules Table**: User-defined categorization rules (Premium feature) with pattern matching

**Data Models**
- Decimal precision (10,2) for all monetary values
- UUID-based primary keys using PostgreSQL `uuid_generate_v4()`
- Timestamps (TIMESTAMPTZ) for audit trails with automatic timezone handling
- Foreign key relationships with CASCADE deletion for data consistency

**Current Implementation**
- SupabaseStorage class implementing IStorage interface
- All CRUD operations using Supabase client with proper error handling
- Row Level Security (RLS) policies protecting user data isolation
- Database indexes on user_id, account_id, date for query optimization
- True data persistence - survives server restarts
- Full data validation through Zod schemas before database operations

**Security Features**
- Row Level Security (RLS) enabled on all tables
- User-scoped policies: users can only access their own data
- Service role key used only on backend (never exposed to frontend)
- Automatic user authentication check via auth.uid() in RLS policies
- Secure password hashing with bcrypt before database storage

### External Dependencies

**UI Component Library**
- Radix UI primitives (@radix-ui/*) - 25+ accessible component primitives
- Recharts for data visualization (pie charts, bar charts, line graphs)
- Lucide React for consistent icon system
- CMDK for command palette functionality

**Development Tools**
- Replit-specific plugins for development experience (cartographer, dev-banner, runtime-error-modal)
- TypeScript compiler for type checking
- PostCSS with Autoprefixer for CSS processing

**Form & Validation**
- React Hook Form for performant form state management
- Zod for runtime type validation and schema definition
- @hookform/resolvers for seamless integration

**Styling & Theming**
- Tailwind CSS 3.x with custom configuration
- tailwind-merge and clsx for conditional class composition
- CSS variables for theme customization (light/dark mode support)

**Database & Storage**
- @supabase/supabase-js for PostgreSQL database operations
- Supabase PostgreSQL for persistent data storage with RLS
- Type-safe database queries with proper error handling

**Session Management**
- express-session for server-side session handling
- memorystore (in-memory session store) for development
- connect-pg-simple prepared for production PostgreSQL session storage

**Password Security**
- bcrypt for secure password hashing with salt rounds

**Payment Integration (Planned)**
- Cakto payment gateway for Brazilian market (PIX, automatic billing)
- Webhook handling for subscription lifecycle events

**Monitoring & Analytics (Planned)**
- Vercel Analytics for production monitoring

### Development Environment

**Build & Deployment**
- Development: tsx for running TypeScript directly with watch mode
- Production build: Vite for client, esbuild for server bundling
- Environment variable configuration for database and session secrets
- Separate client and server build outputs

**File Structure**
- `/client` - React frontend with pages, components, hooks
- `/server` - Express backend with routes and storage layer
- `/shared` - Shared schema definitions and types
- `/migrations` - Database migration files (Drizzle)
- Path aliases configured for clean imports (@/, @shared/, @assets/)