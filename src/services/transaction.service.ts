/**
 * Transaction Service
 * Business logic for editing and voiding transactions with bi-temporal versioning.
 */

import { prisma } from '@/lib/prisma';
import { updateAccountBalances, reverseAccountBalances } from '@/lib/accounting/balance-calculator';
import { MAX_DATE } from '@/lib/temporal/temporal-utils';

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

  const now = new Date();
  const newAmount = input.amount ?? parseFloat(current.amount.toString());
  const newDebitAccountId = input.debitAccountId ?? current.debitAccountId;
  const newCreditAccountId = input.creditAccountId ?? current.creditAccountId;

  return prisma.$transaction(async (tx) => {
    // Close the old version
    await tx.transaction.update({
      where: { versionId: current.versionId },
      data: {
        validTo: now,
        systemTo: now,
      },
    });

    // Reverse old balance effects
    await reverseAccountBalances(
      tx,
      current.debitAccountId,
      current.creditAccountId,
      parseFloat(current.amount.toString())
    );

    // Create new version with updated fields
    // Note: each version gets its own id (PK). Versions are linked via previousVersionId → versionId.
    const newTransaction = await tx.transaction.create({
      data: {
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

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // Close the old version
    await tx.transaction.update({
      where: { versionId: current.versionId },
      data: {
        validTo: now,
        systemTo: now,
      },
    });

    // Create new voided version
    // Note: each version gets its own id (PK). Versions are linked via previousVersionId → versionId.
    const voidedTransaction = await tx.transaction.create({
      data: {
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

    return voidedTransaction;
  });
}

/**
 * Get the full version history of a transaction by following the previousVersionId chain.
 * Each version has its own id (PK); versions are linked via previousVersionId → versionId.
 * Returns versions ordered most recent first.
 */
export async function getTransactionHistory(
  transactionId: string,
  organizationId: string
) {
  type TxRecord = Awaited<ReturnType<typeof prisma.transaction.findFirst>>;
  const versions: NonNullable<TxRecord>[] = [];

  // Start with the given transaction
  let current: TxRecord = await prisma.transaction.findFirst({
    where: { id: transactionId, organizationId },
  });

  if (!current) return versions;
  versions.push(current);

  // Follow previousVersionId chain backwards
  while (current?.previousVersionId) {
    const previous: TxRecord = await prisma.transaction.findFirst({
      where: { versionId: current.previousVersionId, organizationId },
    });
    if (!previous) break;
    versions.push(previous);
    current = previous;
  }

  return versions;
}
