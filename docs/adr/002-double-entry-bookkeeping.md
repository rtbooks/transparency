# ADR-002: Double-Entry Bookkeeping

**Status:** Accepted

**Date:** 2026-02-15

## Context

RadBooks manages financial transactions for nonprofit organizations. We needed a data model that:

1. Ensures every financial movement is balanced (money doesn't appear or disappear)
2. Supports standard accounting reports (Balance Sheet, Income Statement)
3. Is familiar to accountants and auditors
4. Catches data integrity issues automatically

## Decision

We adopted **double-entry bookkeeping** where every transaction has both a `debitAccountId` and a `creditAccountId`. Account balances are updated atomically when transactions are recorded.

Key design choices:
- **Transaction model** has `debitAccountId` + `creditAccountId` + `amount` — always balanced by definition
- **Account balances** are denormalized on the Account model and updated via `updateAccountBalances()` in the balance calculator
- **Balance verification** endpoint can detect and correct drift between transaction history and stored balances
- **Account types** follow standard accounting: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
- Normal balance conventions: ASSET/EXPENSE accounts increase with debits; LIABILITY/EQUITY/REVENUE increase with credits

## Consequences

### Positive
- Every transaction is inherently balanced — data integrity enforced by the model
- Standard accounting reports can be generated directly from the ledger
- Accountants understand the system immediately
- Balance verification catches any corruption or bugs
- Integration tests validate double-entry integrity

### Negative
- Simple "add money" operations require identifying both accounts (debit and credit)
- More complex transaction form UX — users must understand accounts
- Reversals require creating offsetting entries rather than simple deletion
- Account balance denormalization adds complexity to update logic
