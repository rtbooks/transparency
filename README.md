# RadBooks

> Bringing radical transparency to charitable organizations' finances

A modern SaaS platform that enables 501(c)(3) charitable organizations to provide complete financial transparency to donors and the public. Starting with GRIT Hoops Westwood Basketball, Inc.

**Production**: [radbooks.org](https://radbooks.org) — Hosted on Vercel with Neon PostgreSQL

## 🎯 Mission

Make financial transparency the norm for charitable organizations, enabling donors to see exactly how their contributions are used and building trust through radical openness.

## ✨ Key Features

### For the Public
- **Financial Dashboard** - Review organizational financial activity
- **Historical Views** - View supported records as of past dates
- **Audit History** - Review recorded changes to supported records
- **Donor Highlights** - Recognize supporters (with opt-in)
- **Program Spending** - See what organizations plan to buy
- **Completed Purchases Gallery** - Photos of impact
- **Historical Reports** - Fiscal year comparisons and trends

### For Donors
- **Online Donations** - Stripe-powered giving
- **Multi-Organization Tracking** - See giving across all supported orgs
- **Impact Visibility** - Track where your money went
- **Anonymous Options** - Donate privately if desired
- **Donation Receipts** - Downloadable receipts for recorded gifts

### For Organization Admins
- **General Ledger** - Full double-entry bookkeeping
- **Transaction Recording** - Income and expenses
- **Chart of Accounts** - Hierarchical account structure
- **Version History** - Review temporal history for supported records
- **Audit Trail** - Review recorded changes with timestamps
- **Program Spending Management** - Track planned and actual spending
- **Bill Management** - Payables and receivables with payment tracking
- **Bank Reconciliation** - Match statements to ledger transactions
- **Fundraising Campaigns** - Fixed, tiered, and open campaigns
- **File Attachments** - Receipts and invoices on transactions/bills
- **Financial Reports** - Income Statement, Balance Sheet, cash-flow, and analytics reports
- **Time Machine** - View supported temporal data as of a selected date

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
- **Neon** - Serverless PostgreSQL; branching is available when configured
- **Clerk** - Authentication
- **Vercel Blob** - Private file storage (attachments)
- **Resend** - Transactional email

## 📚 Documentation

### Getting Started
- **[DEV_SETUP.md](./DEV_SETUP.md)** - Development environment setup
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Code standards and contribution workflow
- **[Development guide](./docs/development/README.md)** - Code layout, safety, and testing guidance for developers and agents

### Architecture & Design
- **[Bi-temporal versioning](./docs/architecture/bitemporal-versioning.md)** - Temporal data patterns
- **[docs/adr/](./docs/adr/)** - Architecture Decision Records

### Operations & Reference
- **[DEPLOYMENT_SETUP.md](./DEPLOYMENT_SETUP.md)** - Production deployment guide
- **[Preview deployments](./docs/operations/preview-deployments.md)** - Preview environments with Neon branches
- **[Temporal API reference](./docs/api/temporal-endpoints.md)** - Temporal endpoint reference
- **[CHANGELOG.md](./CHANGELOG.md)** - Version history and release notes

## 🚀 Quick Start

### Devcontainer (Recommended)

Clone the repository, open it in VS Code with the Dev Containers extension, and choose
**Reopen in Container**. Once the container is ready, run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See [DEV_SETUP.md](./DEV_SETUP.md)
for manual setup and troubleshooting, or [.devcontainer/README.md](./.devcontainer/README.md)
for container details.

## 🏗️ Project Status

RadBooks is live at [radbooks.org](https://radbooks.org).

For current work, see the [GitHub issues](https://github.com/rtbooks/transparency/issues);
the changelog records released changes.

## 💡 Core Principles

### Radical Transparency
Organizations can publish financial activity to support public transparency while
protecting private account credentials and donor identity choices.

### Temporal Data Architecture
Selected records—including organizations, accounts, transactions, and program spending—
retain temporal history for audit and historical views. See the
[bi-temporal versioning guide](./docs/architecture/bitemporal-versioning.md) for scope
and implementation notes.

### Double-Entry Bookkeeping
Professional accounting standards ensure accuracy and audit-ability. Every transaction affects two accounts.

### Donor-Centric
Donors can track their impact across multiple organizations and see exactly where their money went.

### Cost-Effective
We aim to keep the platform affordable for charitable organizations.

### Privacy-Respecting
Donors control their visibility. Anonymous donations are fully supported and respected.

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

### Unused-code checks

- `npm run type-check` rejects unused local variables, imports, functions, classes,
  and parameters via TypeScript's `noUnusedLocals` and `noUnusedParameters`.
  Required positional parameters (for example, unused Next.js request arguments)
  use an `_` prefix. Remove unnecessary parameters instead of renaming them.
- `npm run check:unused` uses Knip to reject unused files and dependencies.
  Generated Prisma code is excluded; `pg` is retained for the Prisma PostgreSQL
  adapter, and the `stripe` binary is an externally installed developer tool.
- Both checks are enforced in CI; TypeScript also runs during `npm run build`.
  CI runs `npm run lint` separately because Next.js 16 no longer runs lint in builds.

Knip export/type analysis remains an additional review tool:
`npx knip --include exports,types`. It is not currently a CI gate; exported service
helpers and shared UI primitives still need a separate usage review.

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
- Financial summaries to support organizational reporting (not tax or legal advice)

---

**Built with ❤️ for charitable organizations everywhere**

*RadBooks — Making financial transparency the norm, not the exception.*
