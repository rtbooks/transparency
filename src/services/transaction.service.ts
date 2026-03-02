/**
 * Transaction Service
 * Business logic for creating, editing, and voiding transactions with bi-temporal versioning.
 *
 * ARCHITECTURE: All transaction creation flows MUST go through createTransactionRecord()
 * to ensure consistent temporal fields, balance updates, and fiscal period checks.
 * - createTransaction() — high-level API for manual recording (validates accounts, classifies type)
 * - createTransactionRecord() — low-level API for service-to-service use (accepts tx client)
 */

import { prisma } from '@/lib/prisma';
import { updateAccountBalances, reverseAccountBalances } from '@/lib/accounting/balance-calculator';
import { MAX_DATE, closeVersion, buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { recalculateBillStatus } from '@/services/bill.service';
import { isDateInClosedPeriod } from '@/services/fiscal-period.service';
import type { PaymentMethod, TransactionType, Transaction } from '@/generated/prisma/client';

export interface CreateTransactionInput {
  organizationId: string;
  transactionDate: Date;
  amount: number;
  description: string;
  debitAccountId: string;
  creditAccountId: string;
  referenceNumber?: string | null;
  contactId?: string | null;
  paymentMethod?: PaymentMethod;
}

/**
 * Low-level input for createTransactionRecord().
 * All fields that a transaction record needs — callers must supply type explicitly.
 */
export interface CreateTransactionRecordInput {
  organizationId: string;
  transactionDate: Date;
  amount: number;
  type: TransactionType;
  debitAccountId: string;
  creditAccountId: string;
  description: string;
  referenceNumber?: string | null;
  contactId?: string | null;
  paymentMethod?: PaymentMethod;
  createdBy?: string | null;
  category?: string | null;
  stripeSessionId?: string | null;
  stripePaymentId?: string | null;
  donorName?: string | null;
  isAnonymous?: boolean;
  skipFiscalPeriodCheck?: boolean;
}

/**
 * Create a transaction record AND update account balances atomically.
 * This is the single source of truth for creating transactions — all services
 * (bill, donation, payment, webhook, fiscal period) MUST use this function.
 *
 * Must be called within a Prisma $transaction context (the caller's tx client).
 * Handles: temporal field setup, balance updates, and fiscal period validation.
 */
export async function createTransactionRecord(
  tx: any,
  input: CreateTransactionRecordInput
): Promise<Transaction> {
  // Check fiscal period (skippable for closing entries)
  if (!input.skipFiscalPeriodCheck) {
    const closedCheck = await isDateInClosedPeriod(input.organizationId, input.transactionDate);
    if (closedCheck.closed) {
      throw new Error(`Cannot create transaction in closed fiscal period "${closedCheck.periodName}"`);
    }
  }

  const now = new Date();

  const transaction = await tx.transaction.create({
    data: {
      organizationId: input.organizationId,
      transactionDate: input.transactionDate,
      amount: input.amount,
      type: input.type,
      debitAccountId: input.debitAccountId,
      creditAccountId: input.creditAccountId,
      description: input.description,
      referenceNumber: input.referenceNumber ?? null,
      contactId: input.contactId ?? null,
      paymentMethod: input.paymentMethod ?? 'OTHER',
      createdBy: input.createdBy ?? null,
      category: input.category ?? null,
      stripeSessionId: input.stripeSessionId ?? null,
      stripePaymentId: input.stripePaymentId ?? null,
      donorName: input.donorName ?? null,
      isAnonymous: input.isAnonymous ?? false,
      // Temporal fields — explicit for clarity even though schema has defaults
      versionId: crypto.randomUUID(),
      validFrom: now,
      validTo: MAX_DATE,
      systemFrom: now,
      systemTo: MAX_DATE,
    },
  });

  await updateAccountBalances(tx, input.debitAccountId, input.creditAccountId, input.amount);

  return transaction;
}

/**
 * Create a new transaction with double-entry balance updates.
 * High-level API: validates accounts, checks fiscal period, determines transaction type,
 * and atomically creates the record + updates account balances.
 *
 * Use this for manually-recorded transactions (the "Record Transaction" UI).
 * For service-to-service use (bills, donations, etc.), use createTransactionRecord() directly.
 */
export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  // Verify both accounts exist and belong to the organization
  const [debitAccount, creditAccount] = await Promise.all([
    prisma.account.findFirst({
      where: buildCurrentVersionWhere({ id: input.debitAccountId }),
    }),
    prisma.account.findFirst({
      where: buildCurrentVersionWhere({ id: input.creditAccountId }),
    }),
  ]);

  if (
    !debitAccount ||
    !creditAccount ||
    debitAccount.organizationId !== input.organizationId ||
    creditAccount.organizationId !== input.organizationId
  ) {
    throw new Error('Invalid account selection');
  }

  if (!debitAccount.isActive || !creditAccount.isActive) {
    throw new Error('Cannot use inactive accounts for transactions');
  }

  // Determine transaction type based on account types
  let transactionType: TransactionType;
  if (debitAccount.type === 'ASSET' && creditAccount.type === 'REVENUE') {
    transactionType = 'INCOME';
  } else if (debitAccount.type === 'EXPENSE' && creditAccount.type === 'ASSET') {
    transactionType = 'EXPENSE';
  } else if (debitAccount.type === 'ASSET' && creditAccount.type === 'ASSET') {
    transactionType = 'TRANSFER';
  } else {
    transactionType = 'INCOME'; // Default for general entries
  }

  return prisma.$transaction(async (tx) => {
    return createTransactionRecord(tx, {
      organizationId: input.organizationId,
      transactionDate: input.transactionDate,
      amount: input.amount,
      type: transactionType,
      debitAccountId: input.debitAccountId,
      creditAccountId: input.creditAccountId,
      description: input.description,
      referenceNumber: input.referenceNumber,
      contactId: input.contactId,
      paymentMethod: input.paymentMethod,
    });
  });
}

export interface EditTransactionInput {
  transactionDate?: string;
  amount?: number;
  description?: string;
  debitAccountId?: string;
  creditAccountId?: string;
  referenceNumber?: string | null;
  contactId?: string | null;
  category?: string | null;
  notes?: string | null;
  donorUserId?: string | null;
  donorName?: string | null;
  isAnonymous?: boolean;
  receiptUrl?: string | null;
  changeReason: string;
}

export interface VoidTransactionInput {
  voidReason: string;
}

/**
 * Edit an existing transaction by creating a new bi-temporal version.
 * Closes the old version, reverses its balance effects, creates a new version,
 * and applies updated balance effects.
 */
export async function editTransaction(
  transactionId: string,
  organizationId: string,
  input: EditTransactionInput,
  userId: string
) {
  const current = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      validTo: MAX_DATE,
      isVoided: false,
      isDeleted: false,
    },
  });

  if (!current) {
    throw new Error('Transaction not found or already voided');
  }

  if (current.organizationId !== organizationId) {
    throw new Error('Transaction not found or already voided');
  }

  // Prevent edits to transactions in closed fiscal periods
  const closedCheck = await isDateInClosedPeriod(organizationId, current.transactionDate);
  if (closedCheck.closed) {
    throw new Error(`Cannot edit transaction in closed fiscal period "${closedCheck.periodName}"`);
  }

  const now = new Date();
  const newAmount = input.amount ?? parseFloat(current.amount.toString());
  const newDebitAccountId = input.debitAccountId ?? current.debitAccountId;
  const newCreditAccountId = input.creditAccountId ?? current.creditAccountId;

  return prisma.$transaction(async (tx) => {
    // Close the old version with optimistic lock
    await closeVersion(tx.transaction, current.versionId, now, 'Transaction');

    await reverseAccountBalances(
      tx,
      current.debitAccountId,
      current.creditAccountId,
      parseFloat(current.amount.toString())
    );

    // Create new version with updated fields — preserves stable entity id
    const newTransaction = await tx.transaction.create({
      data: {
        id: current.id, // Stable entity ID — never changes across versions
        organizationId: current.organizationId,
        transactionDate: input.transactionDate ? new Date(input.transactionDate) : current.transactionDate,
        amount: newAmount,
        type: current.type,
        debitAccountId: newDebitAccountId,
        creditAccountId: newCreditAccountId,
        description: input.description ?? current.description,
        category: input.category !== undefined ? input.category : current.category,
        paymentMethod: current.paymentMethod,
        referenceNumber: input.referenceNumber !== undefined ? input.referenceNumber : current.referenceNumber,
        contactId: input.contactId !== undefined ? input.contactId : current.contactId,
        donorUserId: input.donorUserId !== undefined ? input.donorUserId : current.donorUserId,
        donorName: input.donorName !== undefined ? input.donorName : current.donorName,
        isAnonymous: input.isAnonymous !== undefined ? input.isAnonymous : current.isAnonymous,
        receiptUrl: input.receiptUrl !== undefined ? input.receiptUrl : current.receiptUrl,
        notes: input.notes !== undefined ? input.notes : current.notes,
        bankTransactionId: current.bankTransactionId,
        reconciled: current.reconciled,
        reconciledAt: current.reconciledAt,
        stripeSessionId: current.stripeSessionId,
        stripePaymentId: current.stripePaymentId,
        createdAt: current.createdAt,
        createdBy: current.createdBy,
        // Temporal fields
        versionId: crypto.randomUUID(),
        previousVersionId: current.versionId,
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        changedBy: userId,
        isVoided: false,
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
        changeReason: input.changeReason,
      },
    });

    // Apply new balance effects
    await updateAccountBalances(tx, newDebitAccountId, newCreditAccountId, newAmount);

    // With stable entity IDs, BillPayment.transactionId still points to the same entity.
    // No FK migration needed. Just recalculate bill statuses if amount changed.
    if (newAmount !== parseFloat(current.amount.toString())) {
      const billPayments = await tx.billPayment.findMany({
        where: { transactionId: current.id },
      });
      const billIds = [...new Set(billPayments.map(bp => bp.billId))];
      for (const billId of billIds) {
        await recalculateBillStatus(billId, tx);
      }
    }

    return newTransaction;
  });
}

/**
 * Void a transaction by creating a new voided version.
 * Closes the current version and reverses its balance effects.
 */
export async function voidTransaction(
  transactionId: string,
  organizationId: string,
  input: VoidTransactionInput,
  userId: string
) {
  const current = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      validTo: MAX_DATE,
      isVoided: false,
      isDeleted: false,
    },
  });

  if (!current) {
    throw new Error('Transaction not found or already voided');
  }

  if (current.organizationId !== organizationId) {
    throw new Error('Transaction not found or already voided');
  }

  // Prevent voiding transactions in closed fiscal periods
  const closedCheck = await isDateInClosedPeriod(organizationId, current.transactionDate);
  if (closedCheck.closed) {
    throw new Error(`Cannot void transaction in closed fiscal period "${closedCheck.periodName}"`);
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // Close the old version with optimistic lock
    await closeVersion(tx.transaction, current.versionId, now, 'Transaction');

    // Create new voided version — preserves stable entity id
    const voidedTransaction = await tx.transaction.create({
      data: {
        id: current.id, // Stable entity ID — never changes across versions
        organizationId: current.organizationId,
        transactionDate: current.transactionDate,
        amount: parseFloat(current.amount.toString()),
        type: current.type,
        debitAccountId: current.debitAccountId,
        creditAccountId: current.creditAccountId,
        description: current.description,
        category: current.category,
        paymentMethod: current.paymentMethod,
        referenceNumber: current.referenceNumber,
        donorUserId: current.donorUserId,
        donorName: current.donorName,
        isAnonymous: current.isAnonymous,
        receiptUrl: current.receiptUrl,
        notes: current.notes,
        bankTransactionId: null,
        reconciled: current.reconciled,
        reconciledAt: current.reconciledAt,
        stripeSessionId: null,
        stripePaymentId: null,
        createdAt: current.createdAt,
        createdBy: current.createdBy,
        // Temporal fields
        versionId: crypto.randomUUID(),
        previousVersionId: current.versionId,
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        changedBy: userId,
        // Void fields
        isVoided: true,
        voidedAt: now,
        voidedBy: userId,
        voidReason: input.voidReason,
        changeReason: null,
      },
    });

    // Reverse balance effects
    await reverseAccountBalances(
      tx,
      current.debitAccountId,
      current.creditAccountId,
      parseFloat(current.amount.toString())
    );

    // Remove BillPayment links for voided transaction and recalculate bills
    const billPayments = await tx.billPayment.findMany({
      where: { transactionId: current.id },
    });
    if (billPayments.length > 0) {
      await tx.billPayment.deleteMany({
        where: { transactionId: current.id },
      });
      const billIds = [...new Set(billPayments.map(bp => bp.billId))];
      for (const billId of billIds) {
        await recalculateBillStatus(billId, tx);
      }
    }

    // If this transaction is a bill's accrual, cancel the bill
    const accrualBill = await tx.bill.findFirst({
      where: { accrualTransactionId: current.id },
    });
    if (accrualBill && accrualBill.status !== 'CANCELLED') {
      await tx.bill.update({
        where: { id: accrualBill.id },
        data: { status: 'CANCELLED' },
      });
    }

    return voidedTransaction;
  });
}

/**
 * Get the full version history of a transaction.
 * With stable entity IDs, all versions share the same id.
 * Returns versions ordered most recent first.
 */
export async function getTransactionHistory(
  transactionId: string,
  organizationId: string
) {
  return prisma.transaction.findMany({
    where: { id: transactionId, organizationId },
    orderBy: { validFrom: 'desc' },
  });
}
