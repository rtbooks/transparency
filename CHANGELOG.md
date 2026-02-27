# Changelog

All notable changes to RadBooks are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Security headers (HSTS, X-Frame-Options, CSP, Referrer-Policy) via `next.config.js`
- Dependabot configuration for automated dependency updates
- Jest coverage thresholds for services and lib directories
- npm audit step in CI pipeline
- Dependency review action for pull requests

### Fixed
- npm audit vulnerabilities (minimatch ReDoS, qs DoS) resolved

## [0.9.0] - 2026-02-27

### Added
- Page titles with RadBooks branding across all 43 pages for better bookmarks
- Profile page redesign with donation summary, organization cards, and full donation history
- "Create Organization" button in marketing nav for authenticated users
- Access request history preservation with partial unique index

### Fixed
- Marketing page titles no longer show redundant "RadBooks" suffix
- Access request unique constraint violation when removed users re-register

## [0.8.0] - 2026-02-26

### Added
- Fiscal year-end closing with period management
- Closing transaction badges (purple) with edit/void protections
- Maintenance Hub navigation grouping (Reconciliation + Fiscal Periods)
- Organization settings page redesign with sectioned layout
- Access requests moved to Users management page (admin-only)

### Fixed
- Settings page save functionality for fund balance / net assets account
- Closing transactions now appear when using "All Time" date filter

## [0.7.0] - 2026-02-25

### Added
- Invitation emails with organization logo rendering
- Campaign sharing with seamless donor onboarding
- Bill reimbursement feature
- Campaign active/inactive filtering
- Public organization page improvements

### Fixed
- Organization logo not rendering in invitation emails (API route added to public middleware)
- Reimbursement amounts excluded from expense totals
- Guard against undefined campaign fields on public org page

## [0.6.0] - 2026-02-24

### Added
- Bank reconciliation with statement upload (CSV/OFX/QFX)
- Campaign constraints (FIXED_UNIT, TIERED) for structured fundraisers
- Temporal immutability triggers for bitemporal tables
- Donation payment recording and account management
- Donor pledge management

### Changed
- Renamed "Planned Purchases" to "Program Spending"
- Renamed "Donor" role to "Supporter" across the platform

## [0.5.0] - 2026-02-22

### Added
- File attachments for transactions and bills via Vercel Blob (private store)
- Organization branding — logo upload, theme colors, nav theming
- Favicon — transparent open book with ledger lines
- Vercel Analytics and Speed Insights integration
- User-contact linking for donor identification

### Fixed
- Financial report bugs in temporal-reports (5 fixes)
- Transaction date filter excluding today's transactions
- Inactive accounts filtered from dropdowns

## [0.4.0] - 2026-02-20

### Added
- Donor workflows — access requests, pledges, donations dashboard
- Fundraising campaigns feature
- Overdraft alerts and projected balance
- Collapsible sidebar navigation for org pages
- Invitation email integration via Resend
- Bills and contacts management
- Transaction editing with temporal versioning

### Changed
- Bitemporal balance updates with optimistic locking
- Stable entity IDs for bitemporal data model

### Fixed
- Clerk instance migration fallback to email lookup
- Temporal `systemTo` filter added to all bitemporal queries

## [0.3.0] - 2026-02-18

### Added
- Income Statement, Balance Sheet, and Financial Dashboard reports
- Comprehensive financial data testing and CI enforcement
- As-of-date picker for temporal transaction views
- Temporal data architecture (bitemporal versioning)
- Organization verification workflow
- Landing page redesign

### Fixed
- Transaction refresh after recording
- GENERAL journal entry validation always failing

## [0.2.0] - 2026-02-15

### Added
- Role-based access control system (4-level hierarchy)
- Platform administrative console
- Invitation management and acceptance flow
- Core navigation system for organization pages
- Account templates (44-account nonprofit chart of accounts)
- Transaction recording with double-entry bookkeeping
- Balance calculator and verification

## [0.1.0] - 2026-02-12

### Added
- Initial platform setup with Next.js, Prisma, and Tailwind CSS
- Clerk authentication integration
- Organization creation and settings management
- Chart of accounts with tree view
- Account CRUD with smart code generation
- Terms of Service and Privacy Policy pages
