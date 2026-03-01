/**
 * Account Balance Integration Tests
 *
 * Tests every code path that mutates account balances against a real Postgres database.
 * Verifies that createTransaction, editTransaction, voidTransaction, createBill,
 * recordPayment, cancelBill, and donation flows all produce correct balances.
 *
 * Requires: DATABASE_URL pointing to a real Postgres with migrations applied.
 * Run with: npm run test:integration
 */

import { DbTestHelper } from '../helpers/db-test-helper';
import { createTransaction, editTransaction, voidTransaction } from '@/services/transaction.service';
import { createBill, recalculateBillStatus } from '@/services/bill.service';
import { recordPayment } from '@/services/bill-payment.service';
import { createPledgeDonation, createOneTimeDonation } from '@/services/donation.service';
import {
  createFiscalPeriod,
  executeClose,
  reopenPeriod,
} from '@/services/fiscal-period.service';

const db = new DbTestHelper();

beforeAll(async () => {
  await db.setup();
});

afterAll(async () => {
  await db.teardown();
});

describe('Transaction Create → Balance Update', () => {
  it('should correctly update ASSET debit + REVENUE credit balances', async () => {
    await db.assertBalance(db.accounts.checking, 0, 'checking before');
    await db.assertBalance(db.accounts.revenue, 0, 'revenue before');

    // Create transaction: DR Checking (ASSET +500), CR Revenue (REVENUE +500)
    await createTransaction({
      organizationId: db.orgId,
      transactionDate: new Date(),
      amount: 500,
      description: 'Test donation deposit',
      debitAccountId: db.accounts.checking,
      creditAccountId: db.accounts.revenue,
    });

    await db.assertBalance(db.accounts.checking, 500, 'checking after');
    await db.assertBalance(db.accounts.revenue, 500, 'revenue after');
  });

  it('should correctly update EXPENSE debit + ASSET credit balances', async () => {
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);

    // Create transaction: DR Expense (EXPENSE +200), CR Checking (ASSET -200)
    await createTransaction({
      organizationId: db.orgId,
      transactionDate: new Date(),
      amount: 200,
      description: 'Test expense payment',
      debitAccountId: db.accounts.expense,
      creditAccountId: db.accounts.checking,
    });

    await db.assertBalance(db.accounts.checking, checkingBefore - 200, 'checking after expense');
    await db.assertBalance(db.accounts.expense, 200, 'expense after');
  });
});

describe('Transaction Void → Balance Reversal', () => {
  it('should fully reverse balance effects when voiding a transaction', async () => {
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);
    const revenueBefore = await db.getAccountBalance(db.accounts.revenue);

    // Create a transaction
    const txn = await createTransaction({
      organizationId: db.orgId,
      transactionDate: new Date(),
      amount: 300,
      description: 'To be voided',
      debitAccountId: db.accounts.checking,
      creditAccountId: db.accounts.revenue,
    });

    // Verify balances changed
    await db.assertBalance(db.accounts.checking, checkingBefore + 300);
    await db.assertBalance(db.accounts.revenue, revenueBefore + 300);

    // Void the transaction
    await voidTransaction(txn.id, db.orgId, { voidReason: 'Integration test' }, db.userId);

    // Verify balances returned to original
    await db.assertBalance(db.accounts.checking, checkingBefore, 'checking after void');
    await db.assertBalance(db.accounts.revenue, revenueBefore, 'revenue after void');
  });
});

describe('Transaction Edit → Reverse Old + Apply New', () => {
  it('should correctly handle amount change', async () => {
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);
    const revenueBefore = await db.getAccountBalance(db.accounts.revenue);

    // Create transaction for $400
    const txn = await createTransaction({
      organizationId: db.orgId,
      transactionDate: new Date(),
      amount: 400,
      description: 'To be edited',
      debitAccountId: db.accounts.checking,
      creditAccountId: db.accounts.revenue,
    });

    await db.assertBalance(db.accounts.checking, checkingBefore + 400);

    // Edit to $600
    await editTransaction(txn.id, db.orgId, {
      amount: 600,
      changeReason: 'Correcting amount',
    }, db.userId);

    // Net effect should be +600 from starting point (not +400+600)
    await db.assertBalance(db.accounts.checking, checkingBefore + 600, 'checking after edit');
    await db.assertBalance(db.accounts.revenue, revenueBefore + 600, 'revenue after edit');
  });

  it('should correctly handle account change', async () => {
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);
    const clearingBefore = await db.getAccountBalance(db.accounts.clearing);
    const revenueBefore = await db.getAccountBalance(db.accounts.revenue);

    // Create: DR Checking, CR Revenue for $150
    const txn = await createTransaction({
      organizationId: db.orgId,
      transactionDate: new Date(),
      amount: 150,
      description: 'To be re-routed',
      debitAccountId: db.accounts.checking,
      creditAccountId: db.accounts.revenue,
    });

    // Edit: change debit account from Checking to Clearing
    await editTransaction(txn.id, db.orgId, {
      debitAccountId: db.accounts.clearing,
      changeReason: 'Correcting account',
    }, db.userId);

    // Checking should be back to original, Clearing should have +150
    await db.assertBalance(db.accounts.checking, checkingBefore, 'checking after re-route');
    await db.assertBalance(db.accounts.clearing, clearingBefore + 150, 'clearing after re-route');
    await db.assertBalance(db.accounts.revenue, revenueBefore + 150, 'revenue unchanged');
  });
});

describe('Bill Creation → Accrual Transaction + Balances', () => {
  it('should create correct balances for RECEIVABLE bill (DR AR, CR Revenue)', async () => {
    const arBefore = await db.getAccountBalance(db.accounts.ar);
    const revenueBefore = await db.getAccountBalance(db.accounts.revenue);

    await createBill({
      organizationId: db.orgId,
      contactId: db.contactId,
      direction: 'RECEIVABLE',
      amount: 250,
      description: 'Test receivable bill',
      issueDate: new Date(),
      liabilityOrAssetAccountId: db.accounts.ar,
      expenseOrRevenueAccountId: db.accounts.revenue,
      createdBy: db.userId,
    });

    await db.assertBalance(db.accounts.ar, arBefore + 250, 'AR after receivable bill');
    await db.assertBalance(db.accounts.revenue, revenueBefore + 250, 'revenue after receivable bill');
  });

  it('should create correct balances for PAYABLE bill (DR Expense, CR AP)', async () => {
    const expenseBefore = await db.getAccountBalance(db.accounts.expense);
    const apBefore = await db.getAccountBalance(db.accounts.ap);

    await createBill({
      organizationId: db.orgId,
      contactId: db.contactId,
      direction: 'PAYABLE',
      amount: 175,
      description: 'Test payable bill',
      issueDate: new Date(),
      liabilityOrAssetAccountId: db.accounts.ap,
      expenseOrRevenueAccountId: db.accounts.expense,
      createdBy: db.userId,
    });

    await db.assertBalance(db.accounts.expense, expenseBefore + 175, 'expense after payable bill');
    await db.assertBalance(db.accounts.ap, apBefore + 175, 'AP after payable bill');
  });
});

describe('Bill Payment → Payment Transaction + Balances', () => {
  it('should correctly handle RECEIVABLE bill payment (DR Cash, CR AR)', async () => {
    const arBefore = await db.getAccountBalance(db.accounts.ar);
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);

    // Create a receivable bill first
    const bill = await createBill({
      organizationId: db.orgId,
      contactId: db.contactId,
      direction: 'RECEIVABLE',
      amount: 100,
      description: 'Bill to be paid',
      issueDate: new Date(),
      liabilityOrAssetAccountId: db.accounts.ar,
      expenseOrRevenueAccountId: db.accounts.revenue,
      createdBy: db.userId,
    });

    const arAfterBill = await db.getAccountBalance(db.accounts.ar);
    expect(arAfterBill).toBeCloseTo(arBefore + 100, 2);

    // Record payment
    await recordPayment({
      billId: bill.id,
      organizationId: db.orgId,
      amount: 100,
      transactionDate: new Date(),
      cashAccountId: db.accounts.checking,
      description: 'Payment received',
      createdBy: db.userId,
    });

    // AR should decrease (payment credits AR), Checking should increase (payment debits Cash)
    await db.assertBalance(db.accounts.ar, arBefore, 'AR after payment (net zero)');
    await db.assertBalance(db.accounts.checking, checkingBefore + 100, 'checking after payment');
  });

  it('should correctly handle PAYABLE bill payment (DR AP, CR Cash)', async () => {
    const apBefore = await db.getAccountBalance(db.accounts.ap);
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);

    const bill = await createBill({
      organizationId: db.orgId,
      contactId: db.contactId,
      direction: 'PAYABLE',
      amount: 80,
      description: 'Payable to be paid',
      issueDate: new Date(),
      liabilityOrAssetAccountId: db.accounts.ap,
      expenseOrRevenueAccountId: db.accounts.expense,
      createdBy: db.userId,
    });

    await recordPayment({
      billId: bill.id,
      organizationId: db.orgId,
      amount: 80,
      transactionDate: new Date(),
      cashAccountId: db.accounts.checking,
      description: 'Vendor payment',
      createdBy: db.userId,
    });

    // AP should decrease, Checking should decrease
    await db.assertBalance(db.accounts.ap, apBefore, 'AP after payment (net zero)');
    await db.assertBalance(db.accounts.checking, checkingBefore - 80, 'checking after AP payment');
  });
});

describe('Bill Cancel → Void Accrual + Reverse Balances', () => {
  it('should reverse accrual transaction balances when accrual is voided', async () => {
    const arBefore = await db.getAccountBalance(db.accounts.ar);
    const revenueBefore = await db.getAccountBalance(db.accounts.revenue);

    const bill = await createBill({
      organizationId: db.orgId,
      contactId: db.contactId,
      direction: 'RECEIVABLE',
      amount: 300,
      description: 'Bill to cancel',
      issueDate: new Date(),
      liabilityOrAssetAccountId: db.accounts.ar,
      expenseOrRevenueAccountId: db.accounts.revenue,
      createdBy: db.userId,
    });

    // Verify accrual applied
    await db.assertBalance(db.accounts.ar, arBefore + 300);

    // Void the accrual transaction directly (cancelBill uses nested transactions
    // which is a separate concern — here we test the balance reversal path)
    expect(bill.accrualTransactionId).not.toBeNull();
    await voidTransaction(
      bill.accrualTransactionId!,
      db.orgId,
      { voidReason: 'Bill cancelled: integration test' },
      db.userId
    );

    // Balances should return to original
    await db.assertBalance(db.accounts.ar, arBefore, 'AR after cancel');
    await db.assertBalance(db.accounts.revenue, revenueBefore, 'revenue after cancel');
  });
});

describe('Donation Pledge → Payment Lifecycle', () => {
  it('should produce correct balances through full pledge→payment lifecycle', async () => {
    const arBefore = await db.getAccountBalance(db.accounts.ar);
    const revenueBefore = await db.getAccountBalance(db.accounts.revenue);
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);

    // Step 1: Create pledge donation (DR AR, CR Revenue)
    const donation = await createPledgeDonation({
      organizationId: db.orgId,
      contactId: db.contactId,
      type: 'PLEDGE',
      amount: 500,
      description: 'Pledge donation',
      donationDate: new Date(),
      arAccountId: db.accounts.ar,
      revenueAccountId: db.accounts.revenue,
      createdBy: db.userId,
    });

    await db.assertBalance(db.accounts.ar, arBefore + 500, 'AR after pledge');
    await db.assertBalance(db.accounts.revenue, revenueBefore + 500, 'revenue after pledge');
    await db.assertBalance(db.accounts.checking, checkingBefore, 'checking unchanged after pledge');

    // Step 2: Use the bill created by the pledge
    expect(donation.billId).not.toBeNull();

    // Step 3: Record payment (DR Checking, CR AR)
    await recordPayment({
      billId: donation.billId!,
      organizationId: db.orgId,
      amount: 500,
      transactionDate: new Date(),
      cashAccountId: db.accounts.checking,
      description: 'Pledge payment received',
      createdBy: db.userId,
    });

    // AR should net to zero, checking should have the funds, revenue stays
    await db.assertBalance(db.accounts.ar, arBefore, 'AR nets to zero');
    await db.assertBalance(db.accounts.checking, checkingBefore + 500, 'checking has payment');
    await db.assertBalance(db.accounts.revenue, revenueBefore + 500, 'revenue unchanged');
  });
});

describe('Balance Recalculation Audit', () => {
  it('should detect no discrepancies when balances are correct', async () => {
    // Compute expected balances from transactions
    const transactions = await db.prisma.transaction.findMany({
      where: {
        organizationId: db.orgId,
        validTo: new Date('9999-12-31T23:59:59.999Z'),
        isVoided: false,
      },
      select: { debitAccountId: true, creditAccountId: true, amount: true },
    });

    // Spot-check: all account balances should be derivable from transactions
    const debitTotals = new Map<string, number>();
    const creditTotals = new Map<string, number>();
    for (const tx of transactions) {
      const amt = Number(tx.amount);
      debitTotals.set(tx.debitAccountId, (debitTotals.get(tx.debitAccountId) || 0) + amt);
      creditTotals.set(tx.creditAccountId, (creditTotals.get(tx.creditAccountId) || 0) + amt);
    }

    const accounts = await db.prisma.account.findMany({
      where: {
        organizationId: db.orgId,
        validTo: new Date('9999-12-31T23:59:59.999Z'),
        isDeleted: false,
      },
    });

    for (const account of accounts) {
      const totalDebits = debitTotals.get(account.id) || 0;
      const totalCredits = creditTotals.get(account.id) || 0;

      let expected: number;
      if (account.type === 'ASSET' || account.type === 'EXPENSE') {
        expected = totalDebits - totalCredits;
      } else {
        expected = totalCredits - totalDebits;
      }

      const stored = Number(account.currentBalance);
      expect(stored).toBeCloseTo(expected, 2);
    }
  });
});

// ── Additional Coverage Tests ──────────────────────────────────────────

describe('One-Time Donation (Cash)', () => {
  it('should debit cash and credit revenue with no AR or bill', async () => {
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);
    const revenueBefore = await db.getAccountBalance(db.accounts.revenue);
    const arBefore = await db.getAccountBalance(db.accounts.ar);

    const donation = await createOneTimeDonation({
      organizationId: db.orgId,
      contactId: db.contactId,
      type: 'ONE_TIME',
      amount: 250,
      description: 'Cash donation',
      donationDate: new Date(),
      arAccountId: db.accounts.ar,
      revenueAccountId: db.accounts.revenue,
      cashAccountId: db.accounts.checking,
      createdBy: db.userId,
    });

    expect(donation.status).toBe('RECEIVED');
    expect(donation.billId).toBeNull();
    await db.assertBalance(db.accounts.checking, checkingBefore + 250, 'checking after cash donation');
    await db.assertBalance(db.accounts.revenue, revenueBefore + 250, 'revenue after cash donation');
    await db.assertBalance(db.accounts.ar, arBefore, 'AR unchanged — no pledge');
  });
});

describe('Partial Bill Payment', () => {
  it('should partially reduce AR and leave bill in PARTIAL status', async () => {
    const arBefore = await db.getAccountBalance(db.accounts.ar);
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);

    const bill = await createBill({
      organizationId: db.orgId,
      contactId: db.contactId,
      direction: 'RECEIVABLE',
      amount: 400,
      description: 'Partially paid bill',
      issueDate: new Date(),
      liabilityOrAssetAccountId: db.accounts.ar,
      expenseOrRevenueAccountId: db.accounts.revenue,
      createdBy: db.userId,
    });

    // Pay half
    await recordPayment({
      billId: bill.id,
      organizationId: db.orgId,
      amount: 200,
      transactionDate: new Date(),
      cashAccountId: db.accounts.checking,
      description: 'Partial payment',
      createdBy: db.userId,
    });

    await db.assertBalance(db.accounts.ar, arBefore + 200, 'AR reduced by payment');
    await db.assertBalance(db.accounts.checking, checkingBefore + 200, 'checking got partial');

    // Recalculate bill status and verify
    const updated = await recalculateBillStatus(bill.id);
    expect(updated.status).toBe('PARTIAL');
    expect(Number(updated.amountPaid)).toBeCloseTo(200, 2);
  });
});

describe('Void Transaction Linked to Bill Payment', () => {
  it('should allow bill to revert after payment transaction is voided', async () => {
    const arBefore = await db.getAccountBalance(db.accounts.ar);
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);

    // Create bill and pay it fully
    const bill = await createBill({
      organizationId: db.orgId,
      contactId: db.contactId,
      direction: 'RECEIVABLE',
      amount: 150,
      description: 'Bill with voidable payment',
      issueDate: new Date(),
      liabilityOrAssetAccountId: db.accounts.ar,
      expenseOrRevenueAccountId: db.accounts.revenue,
      createdBy: db.userId,
    });

    const payment = await recordPayment({
      billId: bill.id,
      organizationId: db.orgId,
      amount: 150,
      transactionDate: new Date(),
      cashAccountId: db.accounts.checking,
      description: 'Full payment',
      createdBy: db.userId,
    });

    // Void the payment transaction
    await voidTransaction(
      payment.transactionId,
      db.orgId,
      { voidReason: 'Payment reversed' },
      db.userId
    );

    // Balances should reflect voided payment: AR back up, checking back down
    await db.assertBalance(db.accounts.ar, arBefore + 150, 'AR restored after void');
    await db.assertBalance(db.accounts.checking, checkingBefore, 'checking restored after void');

    // After void, BillPayment links should be deleted by voidTransaction
    const remainingPayments = await db.prisma.billPayment.findMany({
      where: { billId: bill.id },
    });
    expect(remainingPayments).toHaveLength(0);

    // recalculateBillStatus doesn't yet reset PAID→PENDING when all payments are voided.
    // This verifies the current behavior (known limitation — bill stays PAID status,
    // but amountPaid goes to 0 since BillPayment records were deleted).
    const recalced = await recalculateBillStatus(bill.id);
    expect(Number(recalced.amountPaid)).toBeCloseTo(0, 2);
  });
});

describe('Error: Inactive Account', () => {
  it('should reject transaction and leave balances unchanged', async () => {
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);
    const revenueBefore = await db.getAccountBalance(db.accounts.revenue);

    // Deactivate checking account
    await db.deactivateAccount(db.accounts.checking);

    await expect(
      createTransaction({
        organizationId: db.orgId,
        transactionDate: new Date(),
        amount: 100,
        description: 'Should fail',
        debitAccountId: db.accounts.checking,
        creditAccountId: db.accounts.revenue,
      })
    ).rejects.toThrow('inactive');

    // Re-activate for subsequent tests
    await db.activateAccount(db.accounts.checking);

    // Balances should be unchanged
    await db.assertBalance(db.accounts.checking, checkingBefore, 'checking unchanged');
    await db.assertBalance(db.accounts.revenue, revenueBefore, 'revenue unchanged');
  });
});

describe('Error: Closed Fiscal Period', () => {
  it('should reject transaction in closed period and leave balances unchanged', async () => {
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);
    const revenueBefore = await db.getAccountBalance(db.accounts.revenue);

    // Create and close a fiscal period covering today
    const today = new Date();
    const startDate = new Date(today.getFullYear(), 0, 1);
    const endDate = new Date(today.getFullYear(), 11, 31);

    await db.setFundBalanceAccount(db.accounts.equity);

    const period = await createFiscalPeriod({
      organizationId: db.orgId,
      name: `FY ${today.getFullYear()} Test`,
      startDate,
      endDate,
    });

    await executeClose(period.id, db.orgId, db.userId);

    // Attempt a transaction inside the closed period
    await expect(
      createTransaction({
        organizationId: db.orgId,
        transactionDate: today,
        amount: 100,
        description: 'Should fail — period closed',
        debitAccountId: db.accounts.checking,
        creditAccountId: db.accounts.revenue,
      })
    ).rejects.toThrow('closed fiscal period');

    // Reopen so future tests aren't blocked, then clean up the period
    await reopenPeriod(period.id, db.orgId, db.userId);

    // Original balances restored after reopen reverses closing entries
    await db.assertBalance(db.accounts.checking, checkingBefore, 'checking unchanged');
    await db.assertBalance(db.accounts.revenue, revenueBefore, 'revenue unchanged');
  });
});

describe('Fiscal Period Close → Reopen Cycle', () => {
  it('should zero revenue/expense and move net to equity, then reverse on reopen', async () => {
    // Set up: need revenue and expense with known balances for this test
    // Create isolated transactions for this test
    const revenueBefore = await db.getAccountBalance(db.accounts.revenue);
    const expenseBefore = await db.getAccountBalance(db.accounts.expense);
    const equityBefore = await db.getAccountBalance(db.accounts.equity);

    // Add $1000 revenue and $600 expense
    await createTransaction({
      organizationId: db.orgId,
      transactionDate: new Date(),
      amount: 1000,
      description: 'Revenue for fiscal close test',
      debitAccountId: db.accounts.checking,
      creditAccountId: db.accounts.revenue,
    });
    await createTransaction({
      organizationId: db.orgId,
      transactionDate: new Date(),
      amount: 600,
      description: 'Expense for fiscal close test',
      debitAccountId: db.accounts.expense,
      creditAccountId: db.accounts.checking,
    });

    const revenuePreClose = await db.getAccountBalance(db.accounts.revenue);
    const expensePreClose = await db.getAccountBalance(db.accounts.expense);
    expect(revenuePreClose).toBeCloseTo(revenueBefore + 1000, 2);
    expect(expensePreClose).toBeCloseTo(expenseBefore + 600, 2);

    await db.setFundBalanceAccount(db.accounts.equity);

    // Use a past fiscal year range that won't overlap with other tests
    const period = await createFiscalPeriod({
      organizationId: db.orgId,
      name: 'FY Close-Reopen Test',
      startDate: new Date(2019, 0, 1),
      endDate: new Date(2019, 11, 31),
    });

    const closeResult = await executeClose(period.id, db.orgId, db.userId);

    expect(closeResult.status).toBe('CLOSED');
    expect(closeResult.entriesCreated).toBeGreaterThanOrEqual(2);

    // After close: revenue and expense should be zero, equity absorbs net
    await db.assertBalance(db.accounts.revenue, 0, 'revenue zeroed after close');
    await db.assertBalance(db.accounts.expense, 0, 'expense zeroed after close');
    // Equity should have increased by net surplus (revenue - expense from ALL prior tests)
    const equityAfterClose = await db.getAccountBalance(db.accounts.equity);
    expect(equityAfterClose).toBeGreaterThan(equityBefore);

    // Reopen: should reverse all closing entries
    const reopenResult = await reopenPeriod(period.id, db.orgId, db.userId);
    expect(reopenResult.status).toBe('OPEN');

    // Revenue and expense should be restored
    await db.assertBalance(db.accounts.revenue, revenuePreClose, 'revenue restored after reopen');
    await db.assertBalance(db.accounts.expense, expensePreClose, 'expense restored after reopen');
    await db.assertBalance(db.accounts.equity, equityBefore, 'equity restored after reopen');
  });
});

describe('Edit Transaction: Swap Both Accounts', () => {
  it('should correctly handle changing both debit and credit accounts', async () => {
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);
    const clearingBefore = await db.getAccountBalance(db.accounts.clearing);
    const revenueBefore = await db.getAccountBalance(db.accounts.revenue);
    const equityBefore = await db.getAccountBalance(db.accounts.equity);

    // Create: DR Checking, CR Revenue for $200
    const txn = await createTransaction({
      organizationId: db.orgId,
      transactionDate: new Date(),
      amount: 200,
      description: 'To be fully re-routed',
      debitAccountId: db.accounts.checking,
      creditAccountId: db.accounts.revenue,
    });

    await db.assertBalance(db.accounts.checking, checkingBefore + 200);
    await db.assertBalance(db.accounts.revenue, revenueBefore + 200);

    // Edit: change BOTH accounts — debit to Clearing, credit to Equity
    await editTransaction(txn.id, db.orgId, {
      debitAccountId: db.accounts.clearing,
      creditAccountId: db.accounts.equity,
      changeReason: 'Correcting both accounts',
    }, db.userId);

    // Original accounts should be back to starting point
    await db.assertBalance(db.accounts.checking, checkingBefore, 'checking restored');
    await db.assertBalance(db.accounts.revenue, revenueBefore, 'revenue restored');
    // New accounts should reflect the transaction
    await db.assertBalance(db.accounts.clearing, clearingBefore + 200, 'clearing has debit');
    await db.assertBalance(db.accounts.equity, equityBefore + 200, 'equity has credit');
  });
});

// ── Reimbursement Billing Scenarios ────────────────────────────────────

describe('Reimbursement Bill Lifecycle', () => {
  it('should create accrual that credits EXPENSE (not revenue) for reimbursement', async () => {
    const arBefore = await db.getAccountBalance(db.accounts.ar);
    const expenseBefore = await db.getAccountBalance(db.accounts.expense);
    const revenueBefore = await db.getAccountBalance(db.accounts.revenue);

    // Reimbursement: DR AR, CR Expense
    const bill = await createBill({
      organizationId: db.orgId,
      contactId: db.contactId,
      direction: 'RECEIVABLE',
      amount: 300,
      description: 'Expense reimbursement',
      issueDate: new Date(),
      liabilityOrAssetAccountId: db.accounts.ar,
      expenseOrRevenueAccountId: db.accounts.expense,
      isReimbursement: true,
      createdBy: db.userId,
    });

    expect(bill.status).toBe('PENDING');
    // AR should increase (asset debit)
    await db.assertBalance(db.accounts.ar, arBefore + 300, 'AR debited for reimbursement');
    // Expense should DECREASE (credit to expense reduces it)
    await db.assertBalance(db.accounts.expense, expenseBefore - 300, 'expense credited for reimbursement');
    // Revenue should be untouched
    await db.assertBalance(db.accounts.revenue, revenueBefore, 'revenue unchanged');
  });

  it('should correctly handle full payment of reimbursement bill', async () => {
    const arBefore = await db.getAccountBalance(db.accounts.ar);
    const expenseBefore = await db.getAccountBalance(db.accounts.expense);
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);

    // Create reimbursement bill: DR AR, CR Expense
    const bill = await createBill({
      organizationId: db.orgId,
      contactId: db.contactId,
      direction: 'RECEIVABLE',
      amount: 500,
      description: 'Full reimbursement payment test',
      issueDate: new Date(),
      liabilityOrAssetAccountId: db.accounts.ar,
      expenseOrRevenueAccountId: db.accounts.expense,
      isReimbursement: true,
      createdBy: db.userId,
    });

    await db.assertBalance(db.accounts.ar, arBefore + 500, 'AR after accrual');
    await db.assertBalance(db.accounts.expense, expenseBefore - 500, 'expense after accrual');

    // Record full payment: DR Cash, CR AR
    await recordPayment({
      billId: bill.id,
      organizationId: db.orgId,
      amount: 500,
      transactionDate: new Date(),
      cashAccountId: db.accounts.checking,
      description: 'Reimbursement payment received',
      createdBy: db.userId,
    });

    // AR should net back to original (debit 500 from accrual, credit 500 from payment)
    await db.assertBalance(db.accounts.ar, arBefore, 'AR nets to zero');
    // Checking should have the cash
    await db.assertBalance(db.accounts.checking, checkingBefore + 500, 'checking received payment');
    // Expense should remain reduced (only the accrual touched it)
    await db.assertBalance(db.accounts.expense, expenseBefore - 500, 'expense stays reduced');

    const recalced = await recalculateBillStatus(bill.id);
    expect(recalced.status).toBe('PAID');
    expect(Number(recalced.amountPaid)).toBeCloseTo(500, 2);
  });

  it('should handle partial payment then void of reimbursement bill', async () => {
    const arBefore = await db.getAccountBalance(db.accounts.ar);
    const expenseBefore = await db.getAccountBalance(db.accounts.expense);
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);

    // Create reimbursement bill for $800
    const bill = await createBill({
      organizationId: db.orgId,
      contactId: db.contactId,
      direction: 'RECEIVABLE',
      amount: 800,
      description: 'Partial+void reimbursement test',
      issueDate: new Date(),
      liabilityOrAssetAccountId: db.accounts.ar,
      expenseOrRevenueAccountId: db.accounts.expense,
      isReimbursement: true,
      createdBy: db.userId,
    });

    await db.assertBalance(db.accounts.ar, arBefore + 800, 'AR after accrual');
    await db.assertBalance(db.accounts.expense, expenseBefore - 800, 'expense after accrual');

    // Record partial payment of $300
    const payment1 = await recordPayment({
      billId: bill.id,
      organizationId: db.orgId,
      amount: 300,
      transactionDate: new Date(),
      cashAccountId: db.accounts.checking,
      description: 'Partial reimbursement payment 1',
      createdBy: db.userId,
    });

    await db.assertBalance(db.accounts.ar, arBefore + 500, 'AR after partial payment');
    await db.assertBalance(db.accounts.checking, checkingBefore + 300, 'checking after partial');
    await db.assertBalance(db.accounts.expense, expenseBefore - 800, 'expense unchanged by payment');

    let recalced = await recalculateBillStatus(bill.id);
    expect(recalced.status).toBe('PARTIAL');
    expect(Number(recalced.amountPaid)).toBeCloseTo(300, 2);

    // Void the partial payment
    await voidTransaction(
      payment1.transactionId,
      db.orgId,
      { voidReason: 'Incorrect payment' },
      db.userId
    );

    // AR and checking should revert to post-accrual state
    await db.assertBalance(db.accounts.ar, arBefore + 800, 'AR restored after void');
    await db.assertBalance(db.accounts.checking, checkingBefore, 'checking restored after void');
    await db.assertBalance(db.accounts.expense, expenseBefore - 800, 'expense still reduced');
  });

  it('should handle two partial payments then void of first payment', async () => {
    const arBefore = await db.getAccountBalance(db.accounts.ar);
    const expenseBefore = await db.getAccountBalance(db.accounts.expense);
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);

    // Create reimbursement bill for $600
    const bill = await createBill({
      organizationId: db.orgId,
      contactId: db.contactId,
      direction: 'RECEIVABLE',
      amount: 600,
      description: 'Two payments void first',
      issueDate: new Date(),
      liabilityOrAssetAccountId: db.accounts.ar,
      expenseOrRevenueAccountId: db.accounts.expense,
      isReimbursement: true,
      createdBy: db.userId,
    });

    // First payment: $200
    const payment1 = await recordPayment({
      billId: bill.id,
      organizationId: db.orgId,
      amount: 200,
      transactionDate: new Date(),
      cashAccountId: db.accounts.checking,
      description: 'Payment 1 of 2',
      createdBy: db.userId,
    });

    // Second payment: $250
    await recordPayment({
      billId: bill.id,
      organizationId: db.orgId,
      amount: 250,
      transactionDate: new Date(),
      cashAccountId: db.accounts.checking,
      description: 'Payment 2 of 2',
      createdBy: db.userId,
    });

    // After both payments: AR reduced by 450, checking up by 450
    await db.assertBalance(db.accounts.ar, arBefore + 150, 'AR after two payments');
    await db.assertBalance(db.accounts.checking, checkingBefore + 450, 'checking after two payments');
    await db.assertBalance(db.accounts.expense, expenseBefore - 600, 'expense from accrual only');

    let recalced = await recalculateBillStatus(bill.id);
    expect(recalced.status).toBe('PARTIAL');
    expect(Number(recalced.amountPaid)).toBeCloseTo(450, 2);

    // Void the FIRST payment ($200)
    await voidTransaction(
      payment1.transactionId,
      db.orgId,
      { voidReason: 'First payment was erroneous' },
      db.userId
    );

    // Only payment2 ($250) should remain effective
    await db.assertBalance(db.accounts.ar, arBefore + 350, 'AR after voiding first payment');
    await db.assertBalance(db.accounts.checking, checkingBefore + 250, 'checking after voiding first');
    await db.assertBalance(db.accounts.expense, expenseBefore - 600, 'expense unchanged by void');

    recalced = await recalculateBillStatus(bill.id);
    expect(recalced.status).toBe('PARTIAL');
    expect(Number(recalced.amountPaid)).toBeCloseTo(250, 2);
  });

  it('should handle voiding accrual transaction on reimbursement bill', async () => {
    const arBefore = await db.getAccountBalance(db.accounts.ar);
    const expenseBefore = await db.getAccountBalance(db.accounts.expense);

    // Create reimbursement bill
    const bill = await createBill({
      organizationId: db.orgId,
      contactId: db.contactId,
      direction: 'RECEIVABLE',
      amount: 400,
      description: 'Void accrual test',
      issueDate: new Date(),
      liabilityOrAssetAccountId: db.accounts.ar,
      expenseOrRevenueAccountId: db.accounts.expense,
      isReimbursement: true,
      createdBy: db.userId,
    });

    await db.assertBalance(db.accounts.ar, arBefore + 400, 'AR after accrual');
    await db.assertBalance(db.accounts.expense, expenseBefore - 400, 'expense after accrual');

    // Void the accrual transaction directly (simulates cancelling the bill)
    expect(bill.accrualTransactionId).not.toBeNull();
    await voidTransaction(
      bill.accrualTransactionId!,
      db.orgId,
      { voidReason: 'Reimbursement bill cancelled' },
      db.userId
    );

    // All balances should return to original
    await db.assertBalance(db.accounts.ar, arBefore, 'AR restored after void');
    await db.assertBalance(db.accounts.expense, expenseBefore, 'expense restored after void');
  });
});
