# Implementation Checklist

Track your progress as you build the RadBooks platform.

**Last Updated**: February 24, 2026
**Current Phase**: Phase 15 — Program Spending ✅, Campaigns, Attachments

## Phase 1: Foundation ✅ (Complete!)

### Project Setup

- [x] Create Next.js project with TypeScript
- [x] Install and configure Tailwind CSS
- [x] Set up Shadcn/ui components
- [x] Initialize Git repository
- [ ] Create GitHub repository (optional)

### Database Setup

- [x] Install and configure PostgreSQL
- [x] Set up Prisma
- [x] Create database schema (schema.prisma)
- [x] Generate Prisma Client
- [x] Push schema to database
- [x] Create seed script
- [x] Run seed script with GRIT data

### Authentication

- [x] Sign up for Clerk (or Supabase Auth)
- [x] Install auth library
- [x] Configure auth middleware
- [x] Create login page
- [x] Create registration page
- [x] Test authentication flow

### Project Structure

- [x] Create folder structure per PROJECT_STRUCTURE.md
- [x] Set up route groups
- [x] Create basic layout components
- [x] Configure environment variables

### Development Tools

- [x] Set up ESLint
- [x] Configure Prettier
- [ ] Install VS Code extensions (user-dependent)
- [ ] Set up Git hooks (optional)

**Milestone**: Basic app runs with auth and database ✅ **COMPLETE!**

---

## Phase 2: Core Ledger (Weeks 4-6)

### Chart of Accounts

- [x] Create Account model UI components
- [x] Build account tree view component
- [x] Implement create account form (with auto-generated codes)
- [x] Implement edit account form
- [x] Add account activation/deactivation
- [x] Create standard account templates
- [x] Test hierarchical relationships

### Transaction Recording

- [x] Design transaction form UI
- [x] Create transaction model types
- [x] Implement double-entry logic
- [x] Build income recording form
- [x] Build expense recording form
- [x] Add transfer between accounts
- [x] Implement transaction validation

### Balance Calculations

- [x] Write balance calculation function
- [x] Test asset account balances
- [x] Test revenue account balances
- [x] Test expense account balances
- [x] Create balance caching strategy
- [x] Add balance recalculation triggers

### Transaction List

- [x] Create transaction table component
- [x] Add pagination
- [x] Implement filters (date, type, account)
- [x] Add search functionality
- [x] Create transaction detail view
- [x] Add export to CSV

### Transaction Editing & Voiding

- [x] Add bi-temporal versioning fields to Transaction model
- [x] Create balance reversal utility (reverseAccountBalances)
- [x] Create editTransaction service (atomic: close old version → reverse balances → create new version → apply new balances)
- [x] Create voidTransaction service (atomic: close version → mark voided → reverse balances)
- [x] Add PATCH API endpoint for editing transactions
- [x] Add POST API endpoint for voiding transactions
- [x] Update GET API to filter voided/temporal versions
- [x] Create EditTransactionForm component (pre-populated, requires change reason)
- [x] Create VoidTransactionDialog component (confirmation with required reason)
- [x] Update TransactionList with Edit/Void buttons, voided styling, show-voided toggle
- [x] Write comprehensive tests (10 service tests, balance integrity)

**Milestone**: Working general ledger with transaction recording

---

## Phase 3: Organization & User Management (Weeks 7-8)

### Organization Setup

- [x] Create organization creation form
- [x] Build organization settings page
- [x] Add logo upload
- [x] Add organization theming (primary/accent colors)
- [x] Configure fiscal year settings
- [x] Create organization slug/URL

### User Roles

- [x] Implement role-based middleware
- [x] Create role assignment UI
- [x] Build org admin permissions
- [x] Test permission boundaries
- [x] Add audit logging

### Organization Users

- [x] Create user invitation system
- [x] Build user management UI
- [x] Add role assignment form
- [x] Implement user removal
- [ ] Test multi-org access

### Platform Admin

- [x] Create platform admin dashboard
- [x] Build organization list view
- [x] Move organization routes to /org/[slug] (fix routing conflict)
- [x] Add organization creation (admin)
- [x] Create user management interface
- [x] Add system-wide analytics
- [x] **Refactor platform admin to system-wide flag**
  - [x] Add isPlatformAdmin field to User model
  - [x] Migrate existing PLATFORM_ADMIN users
  - [x] Update authentication checks
  - [x] Update navigation components
  - [x] Update API routes (invitations, settings, role assignment)
  - [x] Build verification passed

**Milestone**: Multi-organization support with roles ✅

---

## Phase 4: Public Transparency Features (Weeks 9-10)

### Public Dashboard Design

- [ ] Design organization landing page
- [ ] Create financial overview cards
- [ ] Build responsive layout
- [ ] Add organization branding

### Financial Overview

- [ ] Calculate current balance
- [ ] Display total revenue (fiscal year)
- [ ] Display total expenses (fiscal year)
- [ ] Create fiscal year selector

### Transaction Feed

- [ ] Build public transaction list
- [ ] Filter anonymous donor names
- [ ] Add date range filter
- [ ] Implement pagination
- [ ] Create transaction categories view

### Charts & Visualizations

- [ ] Revenue vs. expense chart (monthly)
- [ ] Fiscal year comparison chart
- [ ] Expense breakdown by category (pie chart)
- [ ] Revenue sources breakdown
- [ ] Trend line (cumulative balance)

### Export & Reports

- [x] Implement CSV export
- [x] Create PDF report generation (via browser print)
- [x] Build fiscal year summary report
- [x] Add expense detail report (Income Statement)
- [x] Generate revenue report (Income Statement)
- [x] Build Income Statement page with comparative periods
- [x] Build Balance Sheet page with comparative periods
- [x] Create Reports landing page
- [x] Create Financial Dashboard with charts (recharts)
- [x] Add fiscal period utilities (year/quarter/month)
- [x] Add period selector component (Year/Quarter/Month granularity)
- [x] Add Reports link to navigation (all roles - transparency-first)
- [x] Add comparative prior-period support to report APIs
- [x] Write fiscal period unit tests (18 tests)

**Milestone**: Public transparency dashboard live

---

## Phase 5: Donation Processing (Weeks 11-12)

### Stripe Setup

- [ ] Create Stripe account
- [ ] Install Stripe SDK
- [ ] Configure Stripe keys
- [ ] Test Stripe in test mode

### Donation Form

- [ ] Design donation page UI
- [ ] Create donation amount selector
- [ ] Add custom amount input
- [ ] Implement anonymous donation toggle
- [ ] Add donor message field

### Stripe Checkout

- [ ] Create checkout session endpoint
- [ ] Build success page
- [ ] Build cancellation page
- [ ] Handle redirect flow
- [ ] Test full donation flow

### Webhook Handler

- [ ] Create webhook endpoint
- [ ] Implement signature verification
- [ ] Handle checkout.session.completed
- [ ] Record donation transaction
- [ ] Update donor totals
- [ ] Test webhook locally (Stripe CLI)

### Manual Donations

- [ ] Create manual donation form (admin)
- [ ] Add Venmo payment recording
- [ ] Add check payment recording
- [ ] Add cash payment recording
- [ ] Implement reference number field

### Receipts

- [ ] Design receipt template
- [ ] Generate receipt PDF
- [ ] Send receipt email
- [ ] Add receipt download
- [ ] Store receipt history

**Milestone**: End-to-end donation processing

---

## Phase 6: Program Spending ✅ (Complete!)

_Renamed from "Planned Purchases" to align with IRS 990 terminology_

### Program Spending CRUD
- [x] Create ProgramSpending model with bi-temporal versioning
- [x] Create program-spending.service.ts with CRUD + temporal versioning
- [x] Create API routes (GET list, POST, GET/PATCH/DELETE single)
- [x] Build ProgramSpendingList component with summary cards, filters, progress bars
- [x] Build ProgramSpendingForm component (create/edit)
- [x] Build ProgramSpendingDetail modal with inline editing
- [x] Simplified workflow: Planned → Purchased / Cancelled (no priority)
- [x] Create migration to rename PlannedPurchase → ProgramSpending
- [x] Create migration to simplify SpendingStatus enum

### Multi-Transaction Linking
- [x] Create ProgramSpendingTransaction junction table
- [x] Implement linkTransaction / unlinkTransaction service functions
- [x] Create transaction link/unlink API routes
- [x] Build LinkTransactionDialog with transaction search
- [x] Compute actualTotal as SUM of linked transaction amounts
- [x] Show funding progress bars (actual vs estimated)

### Image Upload & Gallery
- [x] Set up Vercel Blob for file storage (private access)
- [x] Create attachment.service.ts with upload/download/delete
- [x] Create attachment API routes with authenticated proxy for private blobs
- [x] Build ImageGallery component with thumbnail grid and lightbox viewer
- [x] Display image attachments as photo gallery in detail view
- [x] Display non-image attachments as file list

### Statistics & Reporting
- [x] Create spending statistics API endpoint
- [x] Build summary cards (Total, Planned, Purchased, Budget, Actual Spent)
- [x] Add spending statistics to temporal analytics
- [x] Create getSpendingStatisticsOverTime function

### Navigation & Access
- [x] Add Program Spending to sidebar for all roles (including DONOR)
- [x] Enforce ORG_ADMIN/PLATFORM_ADMIN for create/edit/delete at API level
- [x] Add Megaphone icon for Campaigns navigation link

### Testing
- [x] Create service unit tests (program-spending.service.test.ts)
- [x] Create API contract tests (program-spending-api-contract.test.ts)
- [x] All 414 tests passing

**Milestone**: Program spending tracking complete ✅

---

## Phase 7: Donor Features (Weeks 15-16)

### Donor Profile

- [ ] Create donor dashboard
- [ ] Display lifetime giving total
- [ ] Show recent donations
- [ ] Build donation history table

### Cross-Organization Tracking

- [ ] Aggregate donations across orgs
- [ ] Create org-specific breakdowns
- [ ] Calculate total impact
- [ ] Display organizations supported

### Privacy Controls

- [ ] Add anonymous donation toggle
- [ ] Create donor highlight opt-in/out
- [ ] Update privacy settings page
- [ ] Retroactive privacy changes

### Donor Recognition

- [ ] Build donor highlights section
- [ ] Create top donors list (opt-in)
- [ ] Display recent donors
- [ ] Add "thank you" messages

### Reports & Documents

- [ ] Generate annual giving statement
- [ ] Create tax documentation
- [ ] Export donation history CSV
- [ ] Download individual receipts

**Milestone**: Complete donor experience

---

## Phase 8: Polish & Testing (Weeks 17-18)

### UI/UX Refinement

- [ ] Review all pages for consistency
- [ ] Improve loading states
- [ ] Add skeleton loaders
- [ ] Enhance error messages
- [ ] Improve success feedback

### Mobile Responsiveness

- [ ] Test all pages on mobile
- [ ] Fix mobile layout issues
- [ ] Optimize touch targets
- [ ] Test on different screen sizes

### Performance Optimization

- [ ] Optimize database queries
- [ ] Add database indexes
- [ ] Implement caching strategy
- [ ] Optimize images
- [ ] Code splitting
- [ ] Run Lighthouse audit

### SEO

- [ ] Add meta tags
- [ ] Create sitemap
- [ ] Implement Open Graph tags
- [ ] Add structured data (JSON-LD)
- [ ] Test social sharing

### Accessibility

- [ ] Run accessibility audit
- [ ] Add ARIA labels
- [ ] Test keyboard navigation
- [ ] Check color contrast
- [ ] Test with screen reader

### Security Audit

- [ ] Review authentication flow
- [ ] Check authorization rules
- [ ] Test input validation
- [ ] Verify CSRF protection
- [ ] Check for XSS vulnerabilities
- [ ] Review sensitive data handling

### Testing

- [ ] Write unit tests (>80% coverage)
- [ ] Create integration tests
- [ ] Build E2E test suite
- [ ] Test edge cases
- [ ] Perform load testing

**Milestone**: Production-ready application

---

## Phase 9: Deployment (Week 19)

### Pre-Deployment

- [x] Review environment variables
- [x] Set up production database (Neon)
- [ ] Configure production Stripe account
- [x] Set up production auth (Clerk)
- [x] Test production credentials

### Vercel Deployment

- [x] Create Vercel account
- [x] Connect GitHub repository
- [x] Configure build settings
- [x] Add environment variables
- [x] Set up custom domain (radbooks.org)

### Database Migration

- [x] Run production migrations
- [x] Seed initial data
- [x] Test database connection
- [ ] Set up automated backups

### Monitoring

- [ ] Set up error tracking (Sentry)
- [ ] Configure uptime monitoring
- [ ] Add analytics (optional)
- [ ] Set up logging
- [ ] Create status page

### Testing in Production

- [x] Test registration flow
- [ ] Make test donation
- [x] Record test transaction
- [ ] Verify webhook delivery
- [ ] Check email delivery

### Documentation

- [x] Create user guide
- [ ] Write admin documentation
- [x] Document API endpoints
- [ ] Create FAQ
- [ ] Write troubleshooting guide

**Milestone**: ✅ Live in production at radbooks.org!

---

## Phase 10: Beta Testing (Week 20)

### GRIT Onboarding

- [ ] Create GRIT organization
- [ ] Set up chart of accounts
- [ ] Add board members as admins
- [ ] Import historical transactions
- [ ] Configure organization settings

### User Training

- [ ] Train board members on system
- [ ] Create video tutorials
- [ ] Provide documentation
- [ ] Schedule Q&A session

### Feedback Collection

- [ ] Set up feedback form
- [ ] Schedule weekly check-ins
- [ ] Track issues and requests
- [ ] Monitor user behavior
- [ ] Gather testimonials

### Iteration

- [ ] Fix reported bugs
- [ ] Improve confusing workflows
- [ ] Add requested features
- [ ] Optimize performance
- [ ] Improve documentation

### Marketing Materials

- [ ] Create landing page
- [ ] Design promotional graphics
- [ ] Write case study (GRIT)
- [ ] Prepare launch announcement
- [ ] Create demo video

**Milestone**: Validated MVP with real users

---

## Post-MVP: Future Enhancements

### Bank Account Sync (Phase 11)

- [ ] Sign up for Plaid
- [ ] Implement Plaid Link
- [ ] Build bank connection flow
- [ ] Auto-import transactions
- [ ] Create reconciliation UI
- [ ] Match imported transactions
- [ ] Handle sync errors

### Budget Management (Phase 12)

- [ ] Create budget model
- [ ] Build budget creation UI
- [ ] Add budget categories
- [ ] Track budget vs. actual
- [ ] Generate variance reports
- [ ] Add budget alerts

### Recurring Donations (Phase 13)

- [ ] Implement Stripe subscriptions
- [ ] Create recurring donation form
- [ ] Build subscription management
- [ ] Handle failed payments
- [ ] Add donor subscription portal

### Mobile App (Phase 14)

- [ ] Choose framework (React Native/Flutter)
- [ ] Design mobile UI
- [ ] Implement core features
- [ ] Add push notifications
- [ ] Submit to app stores

### QuickBooks Integration (Phase 15)

- [ ] Sign up for QuickBooks API
- [ ] Implement OAuth flow
- [ ] Build sync settings
- [ ] Map accounts to QuickBooks
- [ ] Sync transactions
- [ ] Handle sync conflicts

---

## Continuous Improvements

### Regular Maintenance

- [ ] Update dependencies monthly
- [ ] Review and fix security issues
- [ ] Monitor error logs
- [ ] Optimize slow queries
- [ ] Review user feedback

### Feature Requests

- [ ] Triage incoming requests
- [ ] Prioritize by impact
- [ ] Create roadmap
- [ ] Communicate timeline

### Community Building

- [ ] Share updates with users
- [ ] Highlight success stories
- [ ] Engage on social media
- [ ] Build user community
- [ ] Recognize contributors

---

## Progress Tracking

### Overall Progress
- **Phase 1 (Foundation)**: ✅ 100% Complete
- **Phase 2 (Core Ledger)**: ✅ 100% Complete
- **Phase 3 (Transparency)**: ✅ ~90% Complete (Org users, platform admin, logo upload, theming done)
- **Phase 4 (Public Features)**: ✅ Reports & exports complete
- **Phase 6 (Program Spending)**: ✅ 100% Complete (renamed from Planned Purchases)
- **Phase 9 (Deployment)**: ✅ Live at radbooks.org (Vercel + Neon)
- **Phase 11 (Temporal Architecture)**: ✅ 100% Complete

### Recent Achievements
- ✅ **Program Spending** — Full feature replacing Planned Purchases
  - Renamed model/table/enums to align with IRS 990 terminology
  - Simplified workflow: Planned → Purchased / Cancelled (removed priority)
  - Multi-transaction linking with junction table
  - Image gallery with lightbox for uploaded attachments
  - Summary cards, progress bars, statistics endpoint
  - 33 new tests (service + API contract), all 414 tests passing
- ✅ **Attachments System** — Vercel Blob private store integration
  - Upload/download/delete with authenticated proxy endpoints
  - Support for TRANSACTION, BILL, PROGRAM_SPENDING entity types
  - Private blob access with Bearer token authentication
- ✅ **Campaigns Feature** — Fundraising campaigns for organizations
  - Campaign CRUD with goal tracking and progress display
  - Default account configuration for automated accounting
  - Visible to all organization roles including DONOR
- ✅ **Organization Theming** — Custom branding per organization
  - Logo upload via Vercel Blob (private store)
  - Primary and accent color customization
  - Theme applied to navigation and UI elements
- ✅ **Dashboard Redesign** — Improved organization dashboard
  - Current assets/liabilities display instead of account counts
  - Last 30-day revenue/expenses summary
  - Recent transactions with account names (not codes)
  - Correct debit/credit arrow direction for transfers
- ✅ **Bills Improvements** — UX and workflow refinements
  - Default filter to outstanding bills (excludes Paid/Cancelled)
  - Type filter changed from toggle buttons to dropdown
  - Header simplified to "Bills"
  - Bill payment transaction descriptions cleaned up

### Current Focus
- 🎯 **Production**: Live at radbooks.org — monitoring and stabilizing
- **Recent**: Program Spending feature, Campaigns, Dashboard redesign, Bills UX
- **Next Tasks**: Stripe donation processing, Donor features, GRIT Hoops onboarding

### Git Branches
- `main` - Production-ready code deployed to radbooks.org
- Feature branches via PR workflow (main is protected)

### What You Can Do Now
- Visit https://radbooks.org — Production application
- Visit /org/[slug]/reports — Financial reports (Income Statement, Balance Sheet)
- Visit /org/[slug]/reports/dashboard — Charts and visualizations
- Visit /org/[slug]/audit-trail — View complete change log
- Visit /org/[slug]/time-machine — Browse historical states
- Run tests: `npm test` (414 tests passing)

**Last Updated**: February 24, 2026

---

## Phase 11: Temporal Data Architecture ✅ (Complete!)

### Schema Design & Migration
- [x] Design bi-temporal versioning pattern
- [x] Add temporal fields to Organization model
- [x] Add temporal fields to Account model
- [x] Add temporal fields to OrganizationUser model
- [x] Add temporal fields to ProgramSpending model
- [x] Create migration with backfill logic
- [x] Add temporal indexes for performance
- [x] Apply migration to development database
- [x] Verify existing data migrated correctly

### Utility Functions & Repository Pattern
- [x] Create temporal-utils.ts with query builders
- [x] Create MAX_DATE and MIN_DATE constants
- [x] Build buildCurrentVersionWhere() helper
- [x] Build buildAsOfDateWhere() helper
- [x] Create TemporalRepository generic class
- [x] Implement findCurrentById method
- [x] Implement findAllCurrent method
- [x] Implement findAsOf method
- [x] Implement findHistory method
- [x] Implement create method
- [x] Implement update method (close old, create new)
- [x] Implement softDelete method
- [x] Implement restore method

### Service Layer with Versioning
- [x] Create organization.service.ts
- [x] Create account.service.ts
- [x] Create organization-user.service.ts
- [x] Create program-spending.service.ts
- [x] Update API routes to use services
- [x] Ensure all updates create versions
- [x] Add audit trail tracking (changedBy)
- [x] Test version chain integrity

### Temporal Query APIs
- [x] Create GET /organizations/[slug]/history endpoint
- [x] Create GET /organizations/[slug]/as-of/[date] endpoint
- [x] Create GET /organizations/[slug]/changes endpoint
- [x] Create GET /accounts/[id]/history endpoint
- [x] Add query parameter validation
- [x] Add error handling for invalid dates
- [x] Test all temporal endpoints

### UI Components
- [x] Create AsOfDatePicker component
- [x] Create VersionHistory component
- [x] Create ChangeIndicator component
- [x] Create VersionComparison component
- [x] Build /org/[slug]/audit-trail page
- [x] Build /org/[slug]/time-machine page
- [x] Add version history to account pages
- [x] Test UI components

### Financial Reporting with Temporal Support
- [x] Create generateBalanceSheet(asOfDate)
- [x] Create generateIncomeStatement(period)
- [x] Create generateCashFlow(period)
- [x] Add balance sheet API endpoint
- [x] Add income statement API endpoint
- [x] Add cash flow API endpoint
- [x] Test reports with historical dates

### Analytics with Change Tracking
- [x] Create getAccountEvolution()
- [x] Create getChartEvolution()
- [x] Create getMembershipChanges()
- [x] Create getPurchaseTimeline()
- [x] Create getOrganizationGrowthMetrics()
- [x] Add membership analytics endpoint
- [x] Test analytics functions

### Testing & Validation
- [x] Create unit tests for temporal-utils (14 tests)
- [x] Create unit tests for reporting logic (20 tests)
- [x] Create unit tests for analytics (15 tests)
- [x] Create unit tests for organization service (13 tests)
- [x] Create unit tests for account service (15 tests)
- [x] Run all tests (77 tests passing)
- [x] Generate coverage report (94% on temporal-utils)
- [ ] Integration tests (optional - deferred)
- [ ] Performance tests (optional - post-deployment)

### Documentation
- [x] Create TEMPORAL_SCHEMA_DESIGN.md
- [x] Update TEMPORAL_IMPLEMENTATION_STATUS.md
- [x] Create API_REFERENCE.md
- [x] Update README.md with temporal features
- [x] Update IMPLEMENTATION_CHECKLIST.md
- [x] Document query patterns and examples
- [x] Add migration notes

### Deployment Readiness
- [x] All code committed to feature branch
- [x] All tests passing
- [x] Documentation complete
- [x] Migration script tested
- [ ] Create Pull Request
- [ ] Code review
- [ ] Merge to main
- [ ] Production deployment

**Status**: ✅ All phases complete - Production ready!

## Phase 12: Financial Reports UI ✅ (Complete!)

### Report Infrastructure
- [x] Create fiscal period utilities (year/quarter/month)
- [x] Build PeriodSelector component
- [x] Build ReportTable component
- [x] Build ExportButtons component (CSV/JSON)

### Income Statement
- [x] Create Income Statement API with period filtering
- [x] Build Income Statement page with revenue/expense breakdown
- [x] Support year, quarter, and month granularity

### Balance Sheet
- [x] Create Balance Sheet API with period filtering
- [x] Build Balance Sheet page with assets/liabilities/equity sections
- [x] Support year, quarter, and month granularity

### Financial Dashboard
- [x] Build Reports landing page with navigation cards
- [x] Create Financial Dashboard with recharts visualizations
- [x] Add revenue vs expense trends chart
- [x] Add navigation to reports from sidebar

## Phase 13: Transaction Editing ✅ (Complete!)

### Bi-Temporal Versioning
- [x] Add temporal versioning fields to Transaction model
- [x] Add void/edit support fields (isVoided, voidedAt, voidReason)
- [x] Create migration scripts

### Transaction Service
- [x] Create editTransaction with version chain (previousVersionId → versionId)
- [x] Create voidTransaction with balance reversal
- [x] Create getTransactionHistory to follow version chain
- [x] Fix P2002 unique constraint bug (don't set id on new versions)

### Transaction Editing UI
- [x] Build EditTransactionForm component
- [x] Build VoidTransactionDialog component
- [x] Update TransactionList with edit/void actions
- [x] Show version status badges (Edited/Voided)

### Bi-Temporal Filtering
- [x] Fix as-of-date filter to use system time (systemFrom/systemTo)
- [x] Add buildBitemporalAsOfWhere() helper to temporal-utils
- [x] Add default current-version filter (systemTo = MAX_DATE)
- [x] Add temporal context banner for historical views

### Testing
- [x] Add P2002 regression test
- [x] Add version chain history tests
- [x] Add bi-temporal as-of-date filtering tests
- [x] All 288 tests passing

## Phase 14: Contacts, Bills & Pledges ✅ (Complete!)

### Schema & Database
- [x] Add Contact model with bi-temporal versioning
- [x] Add Bill model with status lifecycle
- [x] Add BillPayment join model (Bill ↔ Transaction)
- [x] Add ContactType, ContactRole, BillDirection, BillStatus enums
- [x] Add optional contactId to Transaction model
- [x] Create migration script

### Contact Management
- [x] Create contact.service.ts with CRUD + temporal versioning
- [x] Implement findOrCreateForUser() for User ↔ Contact linking
- [x] Create contact API routes (GET list, POST, GET single, PATCH, DELETE)
- [x] Build ContactList component with search/filter
- [x] Build ContactForm component (create/edit)
- [x] Build ContactSelector autocomplete component
- [x] Add Contacts to org sidebar navigation

### Bill Management
- [x] Create bill.service.ts with status lifecycle management
- [x] Implement status transitions (DRAFT→PENDING→PARTIAL→PAID, CANCELLED)
- [x] Create bill API routes (GET list, POST, GET single, PATCH)
- [x] Build BillList component with direction tabs and status filters
- [x] Build BillForm component with contact selector
- [x] Build BillDetail component with payment history and progress bar
- [x] Add Bills to org sidebar navigation

### Payment Linking
- [x] Create bill-payment.service.ts (record, link, unlink, reverse)
- [x] Create payment API route (POST payment on bill → creates Transaction + BillPayment atomically)
- [x] Handle void: reverse BillPayments and recalculate bill status

### Contact on Transactions
- [x] Add ContactSelector to RecordTransactionForm
- [x] Add ContactSelector to EditTransactionForm
- [x] Accept contactId in POST/PATCH transaction APIs
- [x] Show Contact column in TransactionList
- [x] Include contact data in transaction list API response

### Dashboard & Reporting
- [x] Create aging summary API (Current/1-30/31-60/61-90/90+ buckets)
- [x] Build AgingSummary component (payables + receivables)
- [x] Build OutstandingBillsWidget dashboard component
- [x] Create contact transaction history API
- [x] Build ContactTransactionHistory component
- [x] Add transaction history to contact detail dialog

---

- Visit http://localhost:3000/login - Log in with Clerk
- Visit http://localhost:3000/profile - View your profile after login
- Protected routes redirect to login when not authenticated

**Ready for Phase 2**: Core Ledger Implementation 🚀

**Next Steps**:

1. Build account tree view component
2. Implement transaction recording forms
3. Create transaction list with filters
4. Add balance calculation views

---

## Notes

- Mark items with `[x]` when completed
- Update dates as you progress
- Adjust timeline based on your pace
- Don't skip testing!
- Celebrate milestones 🎉

## Need Help?

Refer back to:

- [APPROACH.md](./APPROACH.md) - Technical details
- [QUICKSTART.md](./QUICKSTART.md) - Setup instructions
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - File organization
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guidelines
- [API_REFERENCE.md](./API_REFERENCE.md) - API documentation for temporal endpoints

Good luck building! 🚀


