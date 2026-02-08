# Quick Start Guide - Financial Transparency Platform

This guide will help you set up the project from scratch and get it running locally in under 30 minutes.

## Prerequisites

Before starting, make sure you have:
- Node.js 18+ installed
- PostgreSQL installed (or access to a hosted instance)
- Git installed
- A code editor (VS Code recommended)
- Basic knowledge of React/Next.js

## Step 1: Initialize the Project (5 minutes)

```bash
# Navigate to your workspace
cd /home/hayep/code/transparency

# Create Next.js app with TypeScript and Tailwind
npx create-next-app@latest transparency-platform \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"

# Enter the project directory
cd transparency-platform

# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit: Next.js with TypeScript and Tailwind"
```

## Step 2: Install Dependencies (3 minutes)

```bash
# Core dependencies
npm install prisma @prisma/client

# Authentication (choose one - using Clerk for this example)
npm install @clerk/nextjs

# Payment processing
npm install stripe

# Validation
npm install zod react-hook-form @hookform/resolvers

# Date handling
npm install date-fns

# Charts
npm install recharts

# UI Components
npx shadcn-ui@latest init
# ↑ Follow prompts: Yes to all defaults, choose a theme (e.g., "Default")

# Install commonly needed Shadcn components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add select
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add form
npx shadcn-ui@latest add toast
```

## Step 3: Set Up PostgreSQL Database (5 minutes)

### Option A: Local PostgreSQL

```bash
# Install PostgreSQL (if not already installed)
# On Ubuntu/Debian:
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres createdb transparency_dev

# Create user (optional)
sudo -u postgres psql -c "CREATE USER transparency_user WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE transparency_dev TO transparency_user;"
```

### Option B: Use Railway/Supabase (Free Tier)

1. Go to [Railway.app](https://railway.app) or [Supabase](https://supabase.com)
2. Create a new PostgreSQL database
3. Copy the connection string

## Step 4: Configure Prisma (5 minutes)

```bash
# Initialize Prisma
npx prisma init

# This creates:
# - prisma/schema.prisma
# - .env file
```

**Copy the schema:**
```bash
# Copy the schema from the root to your project
cp ../schema.prisma prisma/schema.prisma
```

**Update `.env` file:**
```bash
# Edit .env (or create .env.local)
DATABASE_URL="postgresql://transparency_user:your_password@localhost:5432/transparency_dev"

# OR use your Railway/Supabase connection string
# DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

**Generate Prisma Client and push schema:**
```bash
# Generate Prisma Client
npx prisma generate

# Push schema to database (for development)
npx prisma db push

# Open Prisma Studio to view your database
npx prisma studio
```

## Step 5: Set Up Authentication with Clerk (5 minutes)

1. **Sign up at [Clerk.com](https://clerk.com)** (free tier available)

2. **Create a new application**
   - Choose: Email and Password (add more later)

3. **Get your API keys**
   - Copy Publishable Key and Secret Key

4. **Update `.env.local`:**
```bash
# Add to .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx

# Set redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/register
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/profile
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/profile
```

5. **Create Clerk middleware:**
```typescript
// src/middleware.ts
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/:slug", "/:slug/donate", "/api/webhooks/(.*)"],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

## Step 6: Set Up Stripe (5 minutes)

1. **Sign up at [Stripe.com](https://stripe.com)**

2. **Get test API keys**
   - Dashboard → Developers → API keys
   - Copy Publishable and Secret keys

3. **Update `.env.local`:**
```bash
# Add to .env.local
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # We'll set this up later
```

4. **Install Stripe CLI (optional, for webhooks):**
```bash
# On Linux:
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.0/stripe_1.19.0_linux_x86_64.tar.gz
tar -xvf stripe_1.19.0_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

## Step 7: Create Basic Structure (5 minutes)

**Create Prisma client singleton:**
```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Create Stripe client:**
```typescript
// src/lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});
```

**Create basic types:**
```typescript
// src/types/index.ts
export type { Organization, User, Transaction, Account } from '@prisma/client';

// Additional helper types
export interface TransactionWithDetails extends Transaction {
  debitAccount: Account;
  creditAccount: Account;
  donor?: User | null;
}
```

## Step 8: Create Seed Data (3 minutes)

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create GRIT organization
  const grit = await prisma.organization.upsert({
    where: { slug: 'grit-hoops' },
    update: {},
    create: {
      name: 'GRIT Hoops Westwood Basketball, Inc',
      slug: 'grit-hoops',
      ein: '12-3456789',
      mission: 'Supporting Westwood High School girls basketball program',
      fiscalYearStart: new Date('2024-01-01'),
      status: 'ACTIVE',
      subscriptionTier: 'FREE',
    },
  });

  console.log('Created organization:', grit.name);

  // Create chart of accounts for GRIT
  const accounts = [
    { code: '1000', name: 'Assets', type: 'ASSET', parent: null },
    { code: '1100', name: 'Checking Account', type: 'ASSET', parent: '1000' },
    { code: '1200', name: 'Savings Account', type: 'ASSET', parent: '1000' },
    
    { code: '4000', name: 'Revenue', type: 'REVENUE', parent: null },
    { code: '4100', name: 'Donations', type: 'REVENUE', parent: '4000' },
    { code: '4200', name: 'Fundraising Events', type: 'REVENUE', parent: '4000' },
    
    { code: '5000', name: 'Expenses', type: 'EXPENSE', parent: null },
    { code: '5100', name: 'Equipment', type: 'EXPENSE', parent: '5000' },
    { code: '5200', name: 'Uniforms', type: 'EXPENSE', parent: '5000' },
    { code: '5300', name: 'Travel', type: 'EXPENSE', parent: '5000' },
    { code: '5400', name: 'Facilities', type: 'EXPENSE', parent: '5000' },
  ];

  const createdAccounts: Record<string, any> = {};

  for (const account of accounts) {
    const parentAccountId = account.parent 
      ? createdAccounts[account.parent]?.id 
      : null;

    const created = await prisma.account.create({
      data: {
        organizationId: grit.id,
        code: account.code,
        name: account.name,
        type: account.type,
        parentAccountId,
      },
    });

    createdAccounts[account.code] = created;
    console.log('Created account:', account.name);
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Add seed script to package.json:**
```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

**Install ts-node for seeding:**
```bash
npm install -D ts-node

# Run seed
npx prisma db seed
```

## Step 9: Start Development Server (1 minute)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser!

## Step 10: Create Your First Page (5 minutes)

**Landing Page:**
```typescript
// src/app/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">
          Radical Transparency
        </h1>
        <p className="text-xl mb-8 text-gray-600">
          Financial transparency for charitable organizations
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/grit-hoops">View GRIT Hoops</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
```

**Organization Dashboard (Public):**
```typescript
// src/app/[slug]/page.tsx
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export default async function OrganizationPage({
  params,
}: {
  params: { slug: string };
}) {
  const org = await prisma.organization.findUnique({
    where: { slug: params.slug },
    include: {
      transactions: {
        take: 10,
        orderBy: { transactionDate: 'desc' },
        include: {
          debitAccount: true,
          creditAccount: true,
        },
      },
    },
  });

  if (!org) {
    notFound();
  }

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-2">{org.name}</h1>
      <p className="text-gray-600 mb-8">{org.mission}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm text-gray-500">Current Balance</h3>
          <p className="text-3xl font-bold">$0.00</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm text-gray-500">Total Raised</h3>
          <p className="text-3xl font-bold text-green-600">$0.00</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm text-gray-500">Total Spent</h3>
          <p className="text-3xl font-bold text-red-600">$0.00</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">Recent Transactions</h2>
      {org.transactions.length === 0 ? (
        <p className="text-gray-500">No transactions yet.</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {org.transactions.map((txn) => (
                <tr key={txn.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {new Date(txn.transactionDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm">{txn.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    ${txn.amount.toString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
```

## Next Steps

Now that you have the basic foundation:

1. **Build Transaction Recording UI**
   - Create form for recording income/expenses
   - Implement double-entry bookkeeping logic

2. **Add Donation Flow**
   - Create Stripe checkout page
   - Implement webhook handler

3. **Build Dashboard Charts**
   - Add financial overview charts
   - Implement fiscal year comparisons

4. **Create Admin Dashboard**
   - Protected routes for org admins
   - Transaction management interface

5. **Deploy to Vercel**
   - Connect GitHub repo
   - Add environment variables
   - Deploy!

## Helpful Commands

```bash
# Database
npx prisma studio              # Open database GUI
npx prisma migrate dev         # Create migration
npx prisma db push            # Push without migration (dev only)
npx prisma db seed            # Run seed script

# Development
npm run dev                    # Start dev server
npm run build                  # Build for production
npm run start                  # Start production server

# Stripe (local webhooks)
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Clerk (manage users)
# Use Clerk Dashboard: https://dashboard.clerk.com
```

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -h localhost -U transparency_user -d transparency_dev
```

### Prisma Issues
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Regenerate Prisma Client
npx prisma generate
```

### Port Already in Use
```bash
# Find process on port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Clerk Docs](https://clerk.com/docs)
- [Stripe Docs](https://stripe.com/docs)
- [Shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

**You're all set!** 🎉 Start building your transparency platform!
