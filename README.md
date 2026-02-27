# RadBooks

> Bringing radical transparency to charitable organizations' finances

A modern SaaS platform that enables 501(c)(3) charitable organizations to provide complete financial transparency to donors and the public. Starting with GRIT Hoops Westwood Basketball, Inc.

**Production**: [radbooks.org](https://radbooks.org) — Hosted on Vercel with Neon PostgreSQL

## 🎯 Mission

Make financial transparency the norm for charitable organizations, enabling donors to see exactly how their contributions are used and building trust through radical openness.

## ✨ Key Features

### For the Public
- **Real-time Financial Dashboard** - View all income and expenses
- **Historical Data Access** - View financial state as of any past date
- **Complete Audit Trail** - See all changes with full transparency
- **Donor Highlights** - Recognize supporters (with opt-in)
- **Program Spending** - See what organizations plan to buy
- **Completed Purchases Gallery** - Photos of impact
- **Historical Reports** - Fiscal year comparisons and trends

### For Donors
- **Secure Online Donations** - Stripe-powered giving
- **Multi-Organization Tracking** - See giving across all supported orgs
- **Impact Visibility** - Track where your money went
- **Anonymous Options** - Donate privately if desired
- **Automatic Receipts** - Tax documentation

### For Organization Admins
- **General Ledger** - Full double-entry bookkeeping
- **Transaction Recording** - Income and expenses
- **Chart of Accounts** - Hierarchical account structure
- **Version History** - Track all changes to accounts and settings
- **Audit Trail** - Complete change log with timestamps
- **Program Spending Management** - Track planned and actual spending
- **Bill Management** - Payables and receivables with payment tracking
- **Bank Reconciliation** - Match statements to ledger transactions
- **Fundraising Campaigns** - Fixed, tiered, and open campaigns
- **File Attachments** - Receipts and invoices on transactions/bills
- **Financial Reports** - Comprehensive reporting with historical accuracy
- **Time Machine** - View organization state as of any past date
- **Bank Reconciliation** - Match transactions to bank statements

### For Platform Admins
- **Multi-Tenant Management** - Manage all organizations
- **User Administration** - Role-based access control
- **System Analytics** - Platform-wide insights

## 🛠️ Technology Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Shadcn/ui** - Accessible component library
- **Recharts** - Data visualization

### Backend
- **Next.js API Routes** - Serverless functions
- **Prisma 7** - Type-safe ORM with bi-temporal versioning
- **PostgreSQL** - Primary database (Neon serverless in production)
- **Zod** - Runtime validation

### Infrastructure
- **Vercel** - Hosting and deployment
- **Neon** - Serverless PostgreSQL with branch databases
- **Clerk** - Authentication
- **Vercel Blob** - Private file storage (attachments)
- **Resend** - Transactional email

## 📚 Documentation

### Getting Started
- **[DEV_SETUP.md](./DEV_SETUP.md)** - Development environment setup
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Code standards and contribution workflow

### Architecture & Design
- **[APPROACH.md](./APPROACH.md)** - System architecture and technical approach
- **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** - Folder structure and organization
- **[TEMPORAL_SCHEMA_DESIGN.md](./TEMPORAL_SCHEMA_DESIGN.md)** - Bi-temporal versioning patterns
- **[docs/adr/](./docs/adr/)** - Architecture Decision Records

### Operations & Reference
- **[DEPLOYMENT_SETUP.md](./DEPLOYMENT_SETUP.md)** - Production deployment guide
- **[PREVIEW_DEPLOYMENTS.md](./PREVIEW_DEPLOYMENTS.md)** - Preview environments with Neon branches
- **[API_REFERENCE.md](./API_REFERENCE.md)** - API documentation for temporal endpoints
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and release notes
- **[IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)** - Feature roadmap and progress

## 🚀 Quick Start

### Option 1: Devcontainer (Recommended) ⚡

**One-click reproducible development environment!**

Prerequisites:
- Docker Desktop
- VS Code with Dev Containers extension

```bash
# 1. Clone the repository
git clone https://github.com/rtbooks/transparency.git
cd transparency

# 2. Test your setup (optional)
./test-devcontainer.sh

# 3. Open in VS Code
code .

# 4. Click "Reopen in Container" when prompted
# Everything else is automatic! ✨
```

After the container starts (~5-10 mins first time):
```bash
npm run dev  # Start developing!
```

**Benefits:**
- ✅ No manual installation needed
- ✅ PostgreSQL pre-configured and running
- ✅ All dependencies installed automatically
- ✅ Consistent environment for all collaborators
- ✅ VS Code extensions pre-installed

See [.devcontainer/README.md](.devcontainer/README.md) for full details.

### Option 2: Manual Setup

Prerequisites:
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

```bash
# Clone and navigate
git clone https://github.com/rtbooks/transparency.git
cd transparency

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Set up database
npx prisma generate
npx prisma db push
npx prisma db seed  # Seeds sample data for GRIT Hoops (development only)

# Start development
npm run dev
```

**Note:** Database seeding is automatically skipped in production environments. The production database starts empty and organizations are created through the application UI.

Visit [http://localhost:3000](http://localhost:3000)

For detailed manual setup instructions, see [DEV_SETUP.md](./DEV_SETUP.md).

## 🏗️ Project Status

**Current Phase**: Production ✅ — Live at [radbooks.org](https://radbooks.org)

### Roadmap

- [x] Core ledger (double-entry bookkeeping)
- [x] Public transparency dashboard
- [x] Bi-temporal versioning and audit trails
- [x] Financial reports (Income Statement, Balance Sheet)
- [x] Bills, contacts, and payment tracking
- [x] Fundraising campaigns and donor workflows
- [x] Bank reconciliation
- [x] File attachments (receipts, invoices)
- [x] Fiscal year-end closing
- [x] Production deployment (Vercel + Neon)
- [ ] Donation processing (Stripe)
- [ ] Beta launch with GRIT Hoops

See [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md) for detailed progress.

## 💡 Core Principles

### Radical Transparency
Every financial transaction is visible to the public (except anonymous donor names). No hidden fees, no obscured expenses. Complete audit trail of all changes.

### Temporal Data Architecture
All financial data is versioned with complete history. Query the state of any account or organization as of any past date. Never lose information - all changes are tracked and reversible.

### Double-Entry Bookkeeping
Professional accounting standards ensure accuracy and audit-ability. Every transaction affects two accounts.

### Donor-Centric
Donors can track their impact across multiple organizations and see exactly where their money went.

### Cost-Effective
Free tier for small organizations (<$50k annual revenue). Premium features at affordable prices. Never profit-seeking at the expense of charitable missions.

### Privacy-Respecting
Donors control their visibility. Anonymous donations are fully supported and respected.

## 🔒 Security

- End-to-end encryption for sensitive data
- PCI DSS compliance via Stripe
- Row-level security for multi-tenancy
- Regular security audits
- GDPR compliant

## 📊 Business Model

### Freemium Tiers

**Free Tier** (Small Organizations)
- Up to $50k annual revenue
- 100 transactions/month
- 1GB storage
- All core features

**Premium - $29/month** (Growing Organizations)
- Unlimited transactions
- 10GB storage
- Priority support
- Custom branding

**Enterprise - $99/month** (Large Nonprofits)
- Bank account sync
- QuickBooks integration
- Dedicated support
- Custom features

**Advertising** (Future)
- Ethical sponsor placements
- Revenue share with organizations

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) for details.

## 🙏 Acknowledgments

- GRIT Hoops Westwood Basketball, Inc - Our first partner
- All the donors who believe in transparency
- The open-source community

## 📧 Contact

- **Website**: [radbooks.org](https://radbooks.org)
- **Email**: info@radbooks.org
- **GitHub**: [github.com/rtbooks/transparency](https://github.com/rtbooks/transparency)

## 🎯 For GRIT Hoops

This platform was designed with GRIT Hoops Westwood Basketball as the inaugural organization. Your mission to support the Westwood High School girls basketball program inspired this entire project.

### GRIT-Specific Features
- Transparent donation tracking
- Equipment purchase planning
- Travel expense visibility
- Donor recognition (opt-in)
- Annual reporting for IRS compliance

---

**Built with ❤️ for charitable organizations everywhere**

*RadBooks — Making financial transparency the norm, not the exception.*
