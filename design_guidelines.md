# FinScope Design Guidelines

## Design Approach
**Hybrid Approach**: Drawing inspiration from modern fintech leaders (Nubank, Stripe Dashboard, Linear) while maintaining a clean, trustworthy aesthetic for financial management. The design balances utility (data clarity, efficiency) with visual appeal (modern, premium feel).

## Core Design Principles
- **Trust & Clarity**: Financial data must be immediately scannable with clear visual hierarchy
- **Breathing Room**: Generous whitespace prevents cognitive overload when viewing financial data
- **Progressive Disclosure**: Show critical info first, details on demand
- **Consistent Data Visualization**: Unified approach to charts, tables, and metrics across all pages

---

## Typography System
- **Headers**: Poppins Bold (600-700 weight)
  - Hero: text-5xl to text-6xl
  - Page titles: text-3xl to text-4xl  
  - Section headers: text-2xl
  - Card titles: text-xl
  
- **Body**: Inter Regular (400 weight)
  - Primary text: text-base
  - Secondary/meta: text-sm
  - Captions: text-xs
  
- **Financial Data**: Inter Medium (500 weight) for amounts, balances, and numeric displays to emphasize importance

---

## Layout System
**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16, 20, 24** for consistent rhythm
- Component padding: p-4 to p-8
- Section spacing: py-12 to py-20 (desktop), py-8 to py-12 (mobile)
- Card gaps: gap-4 to gap-6
- Page containers: max-w-7xl with px-4 to px-8

**Grid Patterns**:
- Dashboard cards: 3-column grid (lg:grid-cols-3, md:grid-cols-2, grid-cols-1)
- Transaction tables: Full-width with responsive horizontal scroll
- Account overview: 2-column layout for balance + quick actions

---

## Component Library

### Navigation
- **Top Navigation**: Sticky header with logo left, main nav center, user menu/trial indicator right
- **Sidebar** (Dashboard pages): Collapsible left sidebar with icon + label navigation, w-64 expanded, w-16 collapsed
- **Mobile**: Bottom tab bar for primary navigation (Dashboard, Accounts, Transactions, MEI, Settings)

### Cards & Containers
- **Metric Cards**: Rounded corners (rounded-lg), subtle shadow (shadow-sm), white background
  - Large number display (text-3xl) with label (text-sm text-gray-600)
  - Optional trend indicator (↑ ↓ with green/red color)
  
- **Account Cards**: Horizontal layout with icon, account name, balance, and action menu
- **Transaction Rows**: Alternating subtle backgrounds, clear left-to-right flow (icon → description → category → amount)

### Data Visualization
- **Charts**: Minimal axes, subtle grid lines, use primary/secondary colors for data series
- **Progress Bars**: Rounded, gradient-filled showing plan usage limits
- **Balance Indicators**: Large, bold typography with subtle background treatment

### Forms & Inputs
- Standard text inputs with border-gray-300, focus:ring-2 focus:ring-blue-500
- Dropdown selects with custom styling matching input fields
- Toggle switches for rules activation
- Date pickers with calendar icon suffix

### CTAs & Buttons
- **Primary**: bg-blue-600 with rounded-lg, px-6 py-3, bold text
- **Secondary**: bg-gray-100 with gray-700 text
- **Danger**: bg-red-600 for delete/cancel actions
- **Ghost**: Transparent with border for tertiary actions
- **Icon Buttons**: Circular or square with single icon, subtle hover states

### Alerts & Notifications
- **Trial Banner**: Persistent top banner (yellow-50 background) showing days remaining
- **Payment Alerts**: Red-tinted banner for failed payments
- **Success Toasts**: Green-tinted, auto-dismiss notifications
- **Plan Limits**: Inline warnings when approaching account/feature limits

---

## Page-Specific Layouts

### Landing Page
- **Hero Section**: Full-width (min-h-[600px]) with left-aligned content (60%) + right-side illustration/dashboard preview (40%)
  - H1 headline, subheading, dual CTA (Primary: "Iniciar teste grátis" + Secondary: "Ver planos")
- **Benefits**: 3-column icon + title + description cards with ample spacing
- **Pricing**: Side-by-side plan comparison cards with featured "Premium" plan elevated/highlighted
- **How it Works**: Horizontal step-by-step flow with numbered badges
- **Footer**: Multi-column (Product, Company, Support, Legal) with newsletter signup

### Dashboard Home
- **Top Bar**: Greeting + trial/plan indicator + quick actions
- **Metrics Row**: 4-column grid (Total Balance, Monthly Income, Monthly Expenses, Net Cash Flow)
- **Main Content**: 2-column layout
  - Left (60%): Recent transactions list with inline categorization
  - Right (40%): Top categories pie chart + upcoming payments list
- **Bottom**: Quick add transaction FAB (floating action button)

### Accounts Page
- **Header**: Page title + "Add Account" button (disabled for Free plan with tooltip)
- **Account Grid**: Cards showing account name, type badge, current balance, mini sparkline chart
- **Empty State**: Illustration + CTA for first account creation

### Transactions Page
- **Filter Bar**: Sticky below header with date range, account selector, category filter, search
- **Table**: Full-width with columns: Date, Description, Category (tag), Account, Type, Amount (right-aligned)
- **Bulk Actions**: Checkbox selection with floating action bar for categorization/deletion
- **Add Transaction**: Slide-in panel (right side) or modal with comprehensive form

### MEI Management
- **Business Selector**: Dropdown if multiple businesses (Premium)
- **Split View**: Business cash flow chart (top) + transaction management (bottom)
- **Quick Stats**: Revenue, Expenses, Net Profit in colored cards
- **Documents Section**: Upload area for receipts/invoices

---

## Icons & Visual Language
- **Icon Library**: Lucide React (via CDN) - thin stroke weight (1.5px) for consistency
- **Category Icons**: Consistent circular backgrounds with category colors
- **Status Indicators**: Colored dots (green = active, yellow = pending, red = failed)
- **Empty States**: Simple line illustrations, never leave blank space

---

## Responsive Behavior
- **Desktop (≥1024px)**: Sidebar + main content, 3-4 column grids
- **Tablet (768-1023px)**: Collapsible sidebar, 2 column grids, optimized touch targets
- **Mobile (<768px)**: Bottom navigation, single column, stacked layouts, expandable sections

---

## Micro-interactions (Minimal)
- **Hover States**: Subtle scale (scale-105) on cards, opacity change on buttons
- **Loading States**: Skeleton screens for data-heavy components
- **Transitions**: 200ms ease-in-out for most interactions
- **NO** scroll animations, parallax, or heavy page transitions

---

## Images
**Hero Image**: Right-side dashboard mockup showing the FinScope interface (charts, transactions, clean UI) - use a high-quality screenshot or create a stylized 3D perspective mockup. Alternative: Abstract financial growth illustration with gradient blue-green tones.

**Benefits Icons**: Replace with actual icon set from Lucide (no custom images needed)

**Empty States**: Simple, friendly line illustrations for "No transactions yet", "Add your first account", etc.