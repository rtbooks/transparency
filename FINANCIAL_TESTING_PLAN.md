# Comprehensive Financial Data Testing Plan

## 🎯 Mission: ZERO tolerance for financial data errors

**Current Coverage**: 77 tests passing, but **0% coverage on critical financial logic**

---

## ⚠️ PHASE 1: Core Financial Logic Unit Tests (START HERE)

### 1.1 Balance Calculator Tests ⚠️ CRITICAL
**File**: `src/__tests__/lib/accounting/balance-calculator.test.ts`  
**Status**: ✅ COMPLETE - 31 tests, 100% coverage  
**Time**: 2-3 hours

Test coverage for `src/lib/accounting/balance-calculator.ts`:

- [x] Test `calculateNewBalance()` for all 5 account types
  - [x] ASSET accounts: debits increase, credits decrease  
  - [x] LIABILITY accounts: credits increase, debits decrease
  - [x] EQUITY accounts: credits increase, debits decrease
  - [x] REVENUE accounts: credits increase, debits decrease
  - [x] EXPENSE accounts: debits increase, credits decrease
- [x] Edge cases:
  - [x] Zero amount transactions
  - [x] Large amounts (billions - test precision)
  - [x] Decimal precision (no rounding errors on cents)
  - [x] String vs number inputs (both accepted per code)
  - [x] Prisma Decimal type handling
- [x] Test `updateAccountBalances()`:
  - [x] Both accounts update correctly in single transaction
  - [x] Handles missing debit account (throws error)
  - [x] Handles missing credit account (throws error)
  - [x] Atomic update (both succeed or both fail)

**Target**: 100% line coverage

---

### 1.2 Balance Verification Tests ⚠️ CRITICAL  
**File**: `src/__tests__/lib/accounting/balance-verification.test.ts`  
**Status**: ❌ Not started  
**Time**: 3-4 hours

Test coverage for `src/lib/accounting/balance-verification.ts`:

- [ ] `recalculateAccountBalance()`:
  - [ ] Correct balance from empty transaction history (returns initialBalance)
  - [ ] Correct balance with single transaction
  - [ ] Correct balance with multiple debit transactions
  - [ ] Correct balance with multiple credit transactions
  - [ ] Correct balance with mixed debits/credits
  - [ ] Handles Prisma Decimal amounts correctly
  - [ ] Works for all account types
- [ ] `verifyAccountBalance()`:
  - [ ] Returns isCorrect: true for matching balances
  - [ ] Returns isCorrect: false for mismatched balances
  - [ ] Handles floating point precision (< 1 cent tolerance OK)
  - [ ] Works with Prisma Decimal types
- [ ] `calculateBalanceSummary()`:
  - [ ] Correct totalDebits sum
  - [ ] Correct totalCredits sum
  - [ ] Accurate transactionCount
  - [ ] Works with Prisma Decimal types
- [ ] `verifyDoubleEntryIntegrity()`:
  - [ ] ✅ Returns isValid: true when debits = credits
  - [ ] ❌ Returns isValid: false when imbalanced
  - [ ] Handles floating point precision errors
- [ ] `calculateHierarchicalBalance()`:
  - [ ] Single account with no children returns own balance
  - [ ] Parent + direct children sums correctly
  - [ ] Parent + children + grandchildren (3 levels deep)
  - [ ] Does not double-count

**Target**: 100% line coverage

---

### 1.3 Transaction Utilities Tests
**File**: `src/__tests__/lib/utils/transaction-utils.test.ts`  
**Status**: ❌ Not started  
**Time**: 1-2 hours

Test coverage for `src/lib/utils/transaction-utils.ts`:

- [ ] Review file and identify all exported functions
- [ ] Test transaction filtering functions
- [ ] Test date range filtering  
- [ ] Test amount aggregations
- [ ] Test validation helpers

**Target**: 100% line coverage

---

## ⚠️ PHASE 2: Service Layer Tests

### 2.1 Transaction Service Tests
**File**: `src/__tests__/services/transaction.service.test.ts`  
**Status**: ❌ Not started (may need to create service first)  
**Time**: 5-6 hours

**PREREQUISITE**: Evaluate if we need `src/services/transaction.service.ts`. Currently transactions are created via API routes directly. Consider extracting to service layer for testability.

Test coverage needed:

- [ ] Create transaction:
  - [ ] Valid transaction creates successfully
  - [ ] Debits debit account correctly based on account type
  - [ ] Credits credit account correctly based on account type
  - [ ] Both balances update atomically
  - [ ] Rejects invalid account IDs
  - [ ] Rejects negative/zero amounts
  - [ ] Validates both accounts belong to same organization
  - [ ] Handles Prisma Decimal amounts correctly
- [ ] List transactions:
  - [ ] Returns all transactions for organization
  - [ ] Filters by date range, account, type
  - [ ] Pagination works correctly
  - [ ] Sorting by date (asc/desc)
- [ ] Get single transaction:
  - [ ] Returns transaction with full details
  - [ ] Returns 404 for non-existent
  - [ ] Validates organization access
- [ ] Transaction immutability:
  - [ ] Transactions cannot be edited (no UPDATE)
  - [ ] Transactions cannot be deleted directly
  - [ ] Test reversal transaction creation
- [ ] Temporal queries:
  - [ ] List transactions with as-of-date parameter
  - [ ] Returns historical account names

**Target**: All transaction operations tested, balances verified

---

### 2.2 Enhanced Account Service Tests
**File**: `src/__tests__/services/account.service.test.ts` (extend existing)  
**Status**: ⏳ 77 tests exist, need enhancements  
**Time**: 3-4 hours

Additional test coverage beyond existing 77 tests:

- [ ] **Temporal bulk queries**:
  - [ ] `findManyAsOf()` returns correct versions
  - [ ] Handles accounts that didn't exist yet
  - [ ] Handles deleted accounts
  - [ ] Performance test with 100+ account IDs
- [ ] `findManyCurrent()`:
  - [ ] Returns only current versions
  - [ ] Filters out soft-deleted accounts
  - [ ] Handles empty input array
- [ ] **Account creation**:
  - [ ] Creates with correct temporal fields
  - [ ] Sets previousVersionId = null for first version
  - [ ] Validates account type and code
- [ ] **Account updates creating new versions**:
  - [ ] Old version gets validTo set
  - [ ] New version gets validFrom set
  - [ ] New version has previousVersionId
  - [ ] Account ID remains same across versions
- [ ] **Balance update operations**:
  - [ ] Balance update creates new account version
  - [ ] Can query balance at specific point in time

**Target**: >90% coverage on AccountService

---

## ⚠️ PHASE 3: API Route Integration Tests

### 3.1 Transaction API Tests
**File**: `src/__tests__/api/transactions.route.test.ts`  
**Status**: ❌ Not started  
**Time**: 4-5 hours

Test `src/app/api/organizations/[slug]/transactions/route.ts`:

- [ ] **POST** (if exists):
  - [ ] Creates transaction successfully
  - [ ] Returns 201 with transaction object
  - [ ] Validates required fields
  - [ ] Returns 400 for invalid data
  - [ ] Returns 403 for unauthorized
  - [ ] Updates both account balances atomically
  
- [ ] **GET with pagination**:
  - [ ] Returns paginated transactions
  - [ ] Respects page and limit query params
  - [ ] Returns correct total count
  - [ ] Includes related account data
  
- [ ] **GET with filters**:
  - [ ] Filter by startDate/endDate
  - [ ] Filter by accountId
  - [ ] Filter by type/category
  - [ ] Multiple filters work together
  
- [ ] **GET with asOfDate (temporal)**:
  - [ ] Accepts asOfDate query parameter
  - [ ] Returns transactions with historical account names
  - [ ] Returns temporalContext object
  - [ ] Handles renamed accounts
  - [ ] Handles deleted accounts
  - [ ] Performance: < 500ms with 100 transactions
  
- [ ] **Error handling**:
  - [ ] Returns 404 for non-existent organization
  - [ ] Returns 403 for unauthorized user
  - [ ] Returns 400 for invalid parameters
  - [ ] Returns 500 with sanitized error

**Target**: All endpoints tested, temporal functionality verified

---

### 3.2 Account API Tests
**File**: `src/__tests__/api/accounts.route.test.ts`  
**Status**: ❌ Not started  
**Time**: 4-5 hours

Test account management APIs:

- [ ] **POST /api/organizations/[slug]/accounts**:
  - [ ] Creates account successfully
  - [ ] Creates with temporal fields
  - [ ] Validates account code uniqueness
  - [ ] Validates parent account exists
  - [ ] Requires ORG_ADMIN role
  
- [ ] **GET /api/organizations/[slug]/accounts**:
  - [ ] Returns all current accounts
  - [ ] Excludes deleted accounts
  - [ ] Filters by type
  - [ ] Returns account hierarchy
  
- [ ] **PUT /api/organizations/[slug]/accounts/[id]**:
  - [ ] Updates create new version
  - [ ] Old version closed with validTo
  - [ ] New version has previousVersionId
  - [ ] Preserves account ID
  
- [ ] **GET /api/organizations/[slug]/accounts/[id]/history**:
  - [ ] Returns all versions ordered by validFrom DESC
  - [ ] Each version includes previousVersionId
  
- [ ] **POST /api/organizations/[slug]/accounts/verify-balances**:
  - [ ] Verifies all account balances
  - [ ] Reports discrepancies
  - [ ] Suggests corrections

**Target**: All CRUD + temporal operations tested

---

## ⚠️ PHASE 4: Double-Entry Integrity Tests (CRITICAL)

### 4.1 Double-Entry Validation Tests
**File**: `src/__tests__/integration/double-entry-integrity.test.ts`  
**Status**: ❌ Not started  
**Time**: 4-5 hours

End-to-end integrity tests with real database operations:

- [ ] **Single transaction balance integrity**:
  - [ ] Create transaction
  - [ ] Verify sum(all debits) = sum(all credits)
  - [ ] Verify both account balances updated
  - [ ] Verify balance changes match amount
  
- [ ] **Multiple transactions balance integrity**:
  - [ ] Create 100 random transactions
  - [ ] Verify total debits = total credits
  - [ ] Verify all account balances sum correctly
  - [ ] Verify balance sheet equation: Assets = Liabilities + Equity
  
- [ ] **Transaction reversal maintains balance**:
  - [ ] Create transaction (debit A, credit B, $100)
  - [ ] Create reversal transaction (debit B, credit A, $100)
  - [ ] Verify accounts return to original balances
  
- [ ] **Account balance recalculation**:
  - [ ] Create 20 transactions for an account
  - [ ] Intentionally corrupt account balance
  - [ ] Run recalculation function
  - [ ] Verify balance corrected
  
- [ ] **Balance sheet equation holds**:
  - [ ] Create diverse transactions
  - [ ] After each: Assets = Liabilities + Equity
  - [ ] Test with multiple organizations
  
- [ ] **Temporal balance consistency**:
  - [ ] Account balance at time T matches sum of transactions up to T
  - [ ] Test at multiple points in time
  - [ ] Test with account renames between T1 and T2

**Target**: All double-entry rules enforced, no integrity violations possible

---

## PHASE 5: Temporal Transaction Integration Tests

### 5.1 Temporal Transaction View Tests
**File**: `src/__tests__/integration/temporal-transactions.test.ts`  
**Status**: ❌ Not started  
**Time**: 3-4 hours

Test the as-of-date functionality (PR #5):

- [ ] **Temporal account name lookup**:
  - [ ] Create account "Cash" at T0
  - [ ] Create transaction at T1
  - [ ] Rename account to "Checking" at T2
  - [ ] Query at T1.5: returns "Cash"
  - [ ] Query at T2.5: returns "Checking"
  
- [ ] **Multiple account renames**:
  - [ ] Account has 5 name changes
  - [ ] Query at different times shows correct name
  
- [ ] **Deleted accounts**:
  - [ ] Create account, transaction, then delete
  - [ ] Query before delete: shows account name
  - [ ] Query after delete: shows placeholder
  
- [ ] **Account didn't exist yet**:
  - [ ] Query before account created: shows placeholder
  - [ ] Verify graceful handling
  
- [ ] **Performance**:
  - [ ] 1000 transactions, 100 accounts, 10 versions each
  - [ ] Query with asOfDate should complete in < 500ms

**Target**: All temporal scenarios work, performance acceptable

---

## PHASE 6: Error Handling and Edge Cases

### 6.1 Transaction Error Cases
**File**: `src/__tests__/integration/transaction-errors.test.ts`  
**Status**: ❌ Not started  
**Time**: 3-4 hours

Test error scenarios:

- [ ] **Invalid amounts**:
  - [ ] Negative amount → 400 Bad Request
  - [ ] Zero amount → 400 Bad Request
  - [ ] String that's not a number → 400
  - [ ] Amount >2 decimal places → test behavior
  
- [ ] **Invalid accounts**:
  - [ ] Non-existent account → 400
  - [ ] Account from different org → 403
  - [ ] Deleted account → 400
  
- [ ] **Invalid dates**:
  - [ ] Future transaction date → test if allowed
  - [ ] Date before org created → 400
  - [ ] Invalid ISO format → 400
  
- [ ] **Concurrent transactions**:
  - [ ] Two requests updating same account
  - [ ] Verify atomic balance updates
  - [ ] Verify no race conditions
  
- [ ] **Database failures**:
  - [ ] Simulate failure during transaction
  - [ ] Verify rollback
  - [ ] Verify no partial updates

**Target**: All errors handled gracefully, no data corruption

---

### 6.2 Account Error Cases
**File**: `src/__tests__/integration/account-errors.test.ts`  
**Status**: ❌ Not started  
**Time**: 2-3 hours

Test account error scenarios:

- [ ] **Invalid account codes**:
  - [ ] Duplicate code in same org → 400
  - [ ] Duplicate code in different org → allowed
  
- [ ] **Invalid hierarchy**:
  - [ ] Parent doesn't exist → 400
  - [ ] Circular reference → 400
  - [ ] Self as parent → 400
  
- [ ] **Invalid temporal operations**:
  - [ ] Overlapping versions → detect and prevent
  - [ ] Gap in version history → detect and warn
  
- [ ] **Account deletion**:
  - [ ] Soft delete with transactions → allowed
  - [ ] Verify version chain integrity after deletion

**Target**: All errors handled, integrity maintained

---

## PHASE 7: Performance and Scale Tests

### 7.1 Transaction Performance Tests
**File**: `src/__tests__/performance/transaction-performance.test.ts`  
**Time**: 2 hours

- [ ] **Bulk transaction creation**:
  - [ ] Create 10,000 transactions
  - [ ] Target: < 50ms per transaction
  - [ ] Verify all balances correct
  
- [ ] **Transaction query performance**:
  - [ ] Query 10,000 transactions paginated
  - [ ] Target: < 100ms per page
  - [ ] Test with various filters
  
- [ ] **Temporal query performance**:
  - [ ] 1000 transactions, 50 accounts, 20 versions
  - [ ] Target: < 500ms total

### 7.2 Account Performance Tests  
**File**: `src/__tests__/performance/account-performance.test.ts`  
**Time**: 1-2 hours

- [ ] **Account hierarchy performance**:
  - [ ] 1000 accounts, 5-level hierarchy
  - [ ] Calculate hierarchical balances
  - [ ] Target: < 200ms
  
- [ ] **Bulk temporal account lookup**:
  - [ ] 100 accounts, 10 versions each
  - [ ] findManyAsOf() target: < 100ms
  
- [ ] **Balance verification performance**:
  - [ ] 100 accounts, 10,000 transactions
  - [ ] Target: < 5 seconds

**Target**: All operations meet performance targets

---

## PHASE 8: End-to-End Financial Workflows

### 8.1 Complete Donation Flow Test
**File**: `src/__tests__/e2e/donation-flow.test.ts`  
**Time**: 2-3 hours

Simulate complete donor journey:

- [ ] User initiates donation via Stripe
- [ ] Mock Stripe webhook
- [ ] Webhook creates transaction (debit checking, credit revenue)
- [ ] Both balances update
- [ ] Donor sees transaction
- [ ] Admin sees transaction
- [ ] Balance sheet remains balanced
- [ ] Can query historically

**Target**: Complete flow tested end-to-end

---

### 8.2 Complete Expense Flow Test
**File**: `src/__tests__/e2e/expense-flow.test.ts`  
**Time**: 1-2 hours

Simulate expense recording:

- [ ] Admin records equipment purchase
- [ ] Debit: Equipment (asset increases)
- [ ] Credit: Cash (asset decreases)
- [ ] Balances update correctly
- [ ] Transaction categorized properly
- [ ] Balance sheet remains balanced

**Target**: Complete expense flow works

---

### 8.3 Complete Monthly Close Test
**File**: `src/__tests__/e2e/monthly-close.test.ts`  
**Time**: 2-3 hours

Simulate month-end procedures:

- [ ] Create various transactions for month
- [ ] Run balance verification
- [ ] Generate reports (balance sheet, income statement)
- [ ] Verify report totals match
- [ ] Verify balance sheet equation holds

**Target**: Complete monthly close workflow tested

---

## PHASE 9: Regression and Mutation Tests

### 9.1 Regression Test Suite
**Time**: 1 hour

- [ ] Set up CI/CD to run tests on every PR
- [ ] Tests must pass before merge
- [ ] Coverage must not decrease
- [ ] Set up test result reporting

### 9.2 Mutation Testing
**Time**: 2-3 hours

- [ ] Install Stryker.js
- [ ] Configure for critical financial logic files
- [ ] Run mutation tests
- [ ] Aim for 80%+ mutation score

---

## Test Data Strategy

### Mock Data Requirements
- [ ] Create realistic organization fixtures
- [ ] Create diverse account hierarchies (5 levels deep)
- [ ] Create realistic transaction history
- [ ] Include edge cases (deleted accounts, renames)
- [ ] Include temporal test data (multiple versions)

### Database Strategy
- [ ] Use PostgreSQL test database (same as production)
- [ ] Reset database before each test suite
- [ ] Seed with consistent test data
- [ ] Use transactions for test isolation
- [ ] Mock external services (Stripe, Clerk)

---

## 📊 Success Criteria

### Coverage Targets
- **Critical Financial Logic**: 100%
  - `balance-calculator.ts`
  - `balance-verification.ts`
  - Transaction service
  - Account service (financial methods)
- **API Routes**: 90%+
- **Overall Project**: 80%+

### Performance Targets
- Transaction creation: < 50ms
- Transaction query (100 items): < 100ms
- Balance verification: < 5 seconds
- Temporal queries: < 500ms
- Account hierarchy: < 200ms

### Quality Gates (Enforce in CI)
- [ ] All tests pass before merge
- [ ] No skipped tests in main branch
- [ ] All critical paths have assertions
- [ ] All error cases tested
- [ ] Coverage does not decrease

---

## 🚀 Implementation Order (CRITICAL PATH)

**Do these first:**

1. ⚠️ **Phase 1.1** - Balance Calculator Tests (2-3 hrs) **← START HERE**
2. ⚠️ **Phase 1.2** - Balance Verification Tests (3-4 hrs)
3. ⚠️ **Phase 4.1** - Double-Entry Integrity (4-5 hrs)
4. ⚠️ **Phase 2.1** - Transaction Service Tests (5-6 hrs)
5. ⚠️ **Phase 3.1** - Transaction API Tests (4-5 hrs)

**Then:**

6. Phase 5.1 - Temporal Transaction Tests (3-4 hrs)
7. Phase 6.1 - Transaction Error Cases (3-4 hrs)
8. Phase 2.2 - Account Service Tests (3-4 hrs)
9. Phase 3.2 - Account API Tests (4-5 hrs)
10. Phase 6.2 - Account Error Cases (2-3 hrs)
11. Phase 8 - E2E Workflows (5-7 hrs)
12. Phase 1.3 - Transaction Utils Tests (1-2 hrs)
13. Phase 7 - Performance Tests (3-4 hrs)
14. Phase 9 - Regression & Mutation (ongoing)

**Total Estimated Time**: 40-55 hours

---

## 🎯 Current Status

- **Tests Passing**: 108 (77 previous + 31 new)
- **Current Coverage**: 
  - balance-calculator.ts: ✅ **100%**
  - Other financial logic: 0%
- **Status**: ✅ Phase 1.1 complete
- **Next Step**: Phase 1.2 (Balance Verification Tests)

---

## Risk Mitigation

### High-Risk Areas ⚠️
1. **Balance calculations** - any error corrupts financial data
2. **Double-entry integrity** - debits must equal credits always
3. **Temporal versioning** - complex queries must be correct
4. **Concurrent transactions** - race conditions could corrupt balances

### Mitigation Strategies
- Start with unit tests (fastest feedback)
- Add integration tests (catch interaction bugs)
- Add E2E tests (verify complete workflows)
- Use property-based testing for financial logic
- Add database constraints where possible
- Implement nightly balance verification job
- Add monitoring/alerts for discrepancies
- Audit logging for all financial operations

---

## Notes

- **Financial calculations require 100% accuracy** - no shortcuts
- Tests should be fast (use mocks where appropriate)
- Tests should be deterministic (no flaky tests)
- Tests should be isolated (no dependencies between tests)
- Tests should be clear (descriptive test names)
- Tests should be maintainable (DRY, but clear)
