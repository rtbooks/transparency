# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for RadBooks.

ADRs document significant architectural decisions, the context behind them, and their consequences. They serve as a record for future developers to understand _why_ the system is designed the way it is.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [001](001-bitemporal-versioning.md) | Bi-Temporal Data Versioning | Accepted |
| [002](002-double-entry-bookkeeping.md) | Double-Entry Bookkeeping | Accepted |
| [003](003-clerk-authentication.md) | Clerk for Authentication | Accepted |
| [004](004-vercel-blob-attachments.md) | Vercel Blob for File Attachments | Accepted |
| [005](005-partial-unique-indexes.md) | Partial Unique Indexes for Soft Constraints | Accepted |

## Template

When adding a new ADR, copy this template:

```markdown
# ADR-NNN: Title

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-NNN

**Date:** YYYY-MM-DD

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or more difficult to do because of this change?
```
