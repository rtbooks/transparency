/**
 * Transaction Service
 * Business logic for editing and voiding transactions with bi-temporal versioning.
 */

import { prisma } from '@/lib/prisma';
import { updateAccountBalances, reverseAccountBalances } from '@/lib/accounting/balance-calculator';
import { MAX_DATE, closeVersion } from '@/lib/temporal/temporal-utils';
import { recalculateBillStatus } from '@/services/bill.service';
import { isDateInClosedPeriod } from '@/services/fiscal-period.service';

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
        donorUserId: current.donorUserId,
        donorName: current.donorName,
        isAnonymous: current.isAnonymous,
        receiptUrl: current.receiptUrl,
        notes: input.notes !== undefined ? input.notes : current.notes,
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
        await recalculateBillStatus(billId);
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
        await recalculateBillStatus(billId);
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
