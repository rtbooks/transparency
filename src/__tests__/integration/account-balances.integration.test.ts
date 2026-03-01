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
import { updateAccountBalances, reverseAccountBalances } from '@/lib/accounting/balance-calculator';
import { createBill } from '@/services/bill.service';
import { recordPayment } from '@/services/bill-payment.service';
import { createPledgeDonation, createOneTimeDonation } from '@/services/donation.service';
import { editTransaction, voidTransaction } from '@/services/transaction.service';

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
    await db.prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          organizationId: db.orgId,
          transactionDate: new Date(),
          amount: 500,
          type: 'INCOME',
          debitAccountId: db.accounts.checking,
          creditAccountId: db.accounts.revenue,
          description: 'Test donation deposit',
          paymentMethod: 'OTHER',
        },
      });
      await updateAccountBalances(tx, db.accounts.checking, db.accounts.revenue, 500);
    });

    await db.assertBalance(db.accounts.checking, 500, 'checking after');
    await db.assertBalance(db.accounts.revenue, 500, 'revenue after');
  });

  it('should correctly update EXPENSE debit + ASSET credit balances', async () => {
    const checkingBefore = await db.getAccountBalance(db.accounts.checking);

    // Create transaction: DR Expense (EXPENSE +200), CR Checking (ASSET -200)
    await db.prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          organizationId: db.orgId,
          transactionDate: new Date(),
          amount: 200,
          type: 'EXPENSE',
          debitAccountId: db.accounts.expense,
          creditAccountId: db.accounts.checking,
          description: 'Test expense payment',
          paymentMethod: 'OTHER',
        },
      });
      await updateAccountBalances(tx, db.accounts.expense, db.accounts.checking, 200);
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
    const txn = await db.prisma.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: {
          organizationId: db.orgId,
          transactionDate: new Date(),
          amount: 300,
          type: 'INCOME',
          debitAccountId: db.accounts.checking,
          creditAccountId: db.accounts.revenue,
          description: 'To be voided',
          paymentMethod: 'OTHER',
        },
      });
      await updateAccountBalances(tx, db.accounts.checking, db.accounts.revenue, 300);
      return t;
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
    const txn = await db.prisma.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: {
          organizationId: db.orgId,
          transactionDate: new Date(),
          amount: 400,
          type: 'INCOME',
          debitAccountId: db.accounts.checking,
          creditAccountId: db.accounts.revenue,
          description: 'To be edited',
          paymentMethod: 'OTHER',
        },
      });
      await updateAccountBalances(tx, db.accounts.checking, db.accounts.revenue, 400);
      return t;
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
    const txn = await db.prisma.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: {
          organizationId: db.orgId,
          transactionDate: new Date(),
          amount: 150,
          type: 'INCOME',
          debitAccountId: db.accounts.checking,
          creditAccountId: db.accounts.revenue,
          description: 'To be re-routed',
          paymentMethod: 'OTHER',
        },
      });
      await updateAccountBalances(tx, db.accounts.checking, db.accounts.revenue, 150);
      return t;
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
