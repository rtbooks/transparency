# Project Structure for Financial Transparency Platform

This document outlines the recommended folder structure for the Next.js application.

```
transparency-platform/
├── .github/
│   └── workflows/              # GitHub Actions for CI/CD
├── prisma/
│   ├── migrations/             # Database migrations
│   ├── schema.prisma           # Database schema (copy from root)
│   └── seed.ts                 # Seed data for development
├── public/
│   ├── images/
│   └── favicon.ico
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── (auth)/             # Auth route group
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── layout.tsx
│   │   ├── (platform)/         # Platform admin routes
│   │   │   ├── admin/
│   │   │   │   ├── organizations/
│   │   │   │   ├── users/
│   │   │   │   ├── analytics/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── org/                # Organization routes (uses /org prefix)
│   │   │   └── [slug]/         # Dynamic org slug
│   │   │       ├── page.tsx    # Public dashboard
│   │   │       ├── dashboard/  # Org admin dashboard
│   │   │       │   ├── page.tsx
│   │   │       │   ├── transactions/
│   │   │       │   ├── planned-purchases/
│   │   │       │   ├── accounts/
│   │   │       │   ├── reports/
│   │   │       │   └── settings/
│   │   │       ├── donate/     # Donation page
│   │   │       └── layout.tsx
│   │   ├── (donor)/            # Donor profile routes
│   │   │   └── profile/
│   │   │       ├── page.tsx
│   │   │       ├── donations/
│   │   │       └── settings/
│   │   ├── api/                # API routes
│   │   │   ├── auth/
│   │   │   ├── organizations/
│   │   │   ├── transactions/
│   │   │   ├── accounts/
│   │   │   ├── planned-purchases/
│   │   │   ├── donations/
│   │   │   ├── webhooks/
│   │   │   │   └── stripe/
│   │   │   └── reports/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Landing page
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                 # Shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   ├── org/                # Organization-specific components
│   │   │   ├── TransactionList.tsx
│   │   │   ├── TransactionForm.tsx
│   │   │   ├── AccountTree.tsx
│   │   │   ├── FinancialOverview.tsx
│   │   │   ├── DonorHighlights.tsx
│   │   │   └── PlannedPurchaseCard.tsx
│   │   ├── dashboard/          # Dashboard components
│   │   │   ├── RevenueChart.tsx
│   │   │   ├── ExpenseChart.tsx
│   │   │   └── FiscalYearComparison.tsx
│   │   ├── forms/              # Form components
│   │   │   ├── DonationForm.tsx
│   │   │   ├── TransactionForm.tsx
│   │   │   ├── AccountForm.tsx
│   │   │   └── PlannedPurchaseForm.tsx
│   │   ├── layout/             # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Navigation.tsx
│   │   └── shared/             # Shared components
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorMessage.tsx
│   │       ├── EmptyState.tsx
│   │       └── ConfirmDialog.tsx
│   ├── lib/
│   │   ├── prisma.ts           # Prisma client instance
│   │   ├── stripe.ts           # Stripe client
│   │   ├── auth.ts             # Auth utilities (Clerk/Supabase)
│   │   ├── utils.ts            # General utilities
│   │   ├── validations.ts      # Zod schemas
│   │   ├── constants.ts        # App constants
│   │   ├── accounting/         # Accounting logic
│   │   │   ├── ledger.ts       # Double-entry bookkeeping
│   │   │   ├── balance.ts      # Balance calculations
│   │   │   └── reports.ts      # Report generation
│   │   └── emails/             # Email templates
│   │       ├── donation-receipt.tsx
│   │       └── welcome.tsx
│   ├── hooks/                  # Custom React hooks
│   │   ├── useOrganization.ts
│   │   ├── useTransactions.ts
│   │   ├── useAccounts.ts
│   │   └── useUser.ts
│   ├── types/                  # TypeScript types
│   │   ├── index.ts
│   │   ├── organization.ts
│   │   ├── transaction.ts
│   │   ├── account.ts
│   │   └── user.ts
│   └── middleware.ts           # Next.js middleware
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example                # Environment variables template
├── .env.local                  # Local environment (git-ignored)
├── .eslintrc.json
├── .gitignore
├── next.config.js
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── components.json             # Shadcn/ui config
├── README.md
├── APPROACH.md                 # This approach document
└── PROJECT_STRUCTURE.md        # This file
```

## Key Directories Explained

### `/src/app`
Next.js 14 App Router structure with route groups for organization:
- `(auth)`: Authentication pages
- `(platform)`: Platform admin (super admin) pages
- `org/[slug]`: Organization-specific pages (both public and admin) - **Note: Uses `/org/` prefix**
- `(donor)`: Donor profile pages
- `api/`: API routes

### `/src/components`
- `ui/`: Base UI components from Shadcn/ui
- `org/`: Organization-specific business components
- `dashboard/`: Dashboard and charting components
- `forms/`: Form components with validation
- `layout/`: Layout components (header, sidebar, etc.)
- `shared/`: Shared utility components

### `/src/lib`
- Core business logic and utilities
- `accounting/`: Financial calculations and ledger logic
- Database clients (Prisma, Stripe)
- Validation schemas (Zod)

### `/src/hooks`
Custom React hooks for data fetching and state management

### `/src/types`
TypeScript type definitions

### `/prisma`
Database schema and migrations

### `/tests`
Test files organized by type (unit, integration, e2e)

## Route Structure Examples

**IMPORTANT: All organization routes use the `/org/` prefix**

### Public Routes
- `/` - Landing page
- `/org/grit-hoops` - GRIT org public dashboard
- `/org/grit-hoops/donate` - Donation page for GRIT
- `/login` - Login page
- `/register` - Registration page

### Donor Routes (Authenticated)
- `/profile` - Donor profile
- `/profile/donations` - Donation history
- `/profile/settings` - Donor settings

### Organization Admin Routes (Authenticated + Org Admin Role)
- `/org/grit-hoops/dashboard` - Admin dashboard
- `/org/grit-hoops/dashboard/transactions` - Transaction management
- `/org/grit-hoops/dashboard/transactions/new` - Record new transaction
- `/org/grit-hoops/dashboard/accounts` - Chart of accounts
- `/org/grit-hoops/dashboard/planned-purchases` - Planned purchases
- `/org/grit-hoops/dashboard/reports` - Financial reports
- `/org/grit-hoops/dashboard/settings` - Organization settings

### Platform Admin Routes (Authenticated + Platform Admin Role)
- `/admin` - Platform admin dashboard
- `/admin/organizations` - Manage all organizations
- `/admin/users` - Manage all users
- `/admin/analytics` - Platform-wide analytics

## API Routes

### Public APIs
- `GET /api/organizations/[slug]` - Get org public data
- `GET /api/organizations/[slug]/transactions` - Get transactions (public view)
- `GET /api/organizations/[slug]/planned-purchases` - Get planned purchases

### Protected APIs (Org Admin)
- `POST /api/organizations/[slug]/transactions` - Create transaction
- `PUT /api/organizations/[slug]/transactions/[id]` - Update transaction
- `GET /api/organizations/[slug]/accounts` - Get chart of accounts
- `POST /api/organizations/[slug]/accounts` - Create account
- `POST /api/organizations/[slug]/planned-purchases` - Create planned purchase

### Donation APIs
- `POST /api/donations/create-checkout-session` - Create Stripe checkout
- `POST /api/webhooks/stripe` - Stripe webhook handler

### Platform Admin APIs
- `GET /api/admin/organizations` - List all orgs
- `POST /api/admin/organizations` - Create organization
- `GET /api/admin/analytics` - Platform analytics

## Environment Variables

Create a `.env.local` file with:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/transparency"

# Authentication (Choose one)
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# OR Supabase
# NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
# SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# File Storage (Cloudflare R2)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=transparency-uploads
NEXT_PUBLIC_R2_PUBLIC_URL=https://...

# Email (Optional - for now)
# RESEND_API_KEY=re_...

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Development Workflow

1. **Setup**
   ```bash
   npm install
   npx prisma generate
   npx prisma db push  # For dev (or prisma migrate dev for production)
   ```

2. **Development**
   ```bash
   npm run dev  # Start Next.js dev server
   ```

3. **Database Management**
   ```bash
   npx prisma studio  # Open Prisma Studio
   npx prisma migrate dev --name description  # Create migration
   npx prisma db seed  # Run seed script
   ```

4. **Testing**
   ```bash
   npm run test        # Run unit tests
   npm run test:e2e    # Run E2E tests
   ```

5. **Build**
   ```bash
   npm run build       # Build for production
   npm run start       # Start production server
   ```

## Git Workflow

1. Create feature branch: `git checkout -b feature/transaction-recording`
2. Make changes and commit: `git commit -m "Add transaction recording"`
3. Push: `git push origin feature/transaction-recording`
4. Create pull request
5. Merge to main after review
6. Deploy automatically (via Vercel)

## Deployment

### Vercel (Recommended)
1. Connect GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main

### Alternative (Railway/Fly.io)
1. Install CLI
2. Configure `railway.json` or `fly.toml`
3. Deploy with `railway up` or `fly deploy`
