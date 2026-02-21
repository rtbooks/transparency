/**
 * BillPayment Service
 * Links transactions to bills, manages partial payments
 */

import { prisma } from '@/lib/prisma';
import { recalculateBillStatus } from '@/services/bill.service';
import { updateAccountBalances } from '@/lib/accounting/balance-calculator';
import type { BillPayment } from '@/generated/prisma/client';

export interface RecordPaymentInput {
  billId: string;
  organizationId: string;
  amount: number;
  transactionDate: Date;
  debitAccountId: string;
  creditAccountId: string;
  description?: string;
  referenceNumber?: string | null;
  notes?: string | null;
  createdBy?: string;
}

export interface LinkPaymentInput {
  billId: string;
  transactionId: string;
  amount: number;
  notes?: string | null;
}

/**
 * Record a payment on a bill — creates both a Transaction and a BillPayment atomically
 */
export async function recordPayment(
  input: RecordPaymentInput
): Promise<BillPayment> {
  const bill = await prisma.bill.findFirst({
    where: { id: input.billId, organizationId: input.organizationId },
  });

  if (!bill) {
    throw new Error('Bill not found');
  }

  if (bill.status === 'PAID' || bill.status === 'CANCELLED') {
    throw new Error(`Cannot record payment on ${bill.status.toLowerCase()} bill`);
  }

  const remaining = parseFloat(bill.amount.toString()) - parseFloat(bill.amountPaid.toString());
  if (input.amount > remaining) {
    throw new Error(`Payment amount (${input.amount}) exceeds remaining balance (${remaining})`);
  }

  // Determine transaction type based on bill direction
  const transactionType = bill.direction === 'PAYABLE' ? 'EXPENSE' : 'INCOME';

  return await prisma.$transaction(async (tx) => {
    // Create the transaction
    const transaction = await tx.transaction.create({
      data: {
        organizationId: input.organizationId,
        transactionDate: input.transactionDate,
        amount: input.amount,
        type: transactionType as any,
        debitAccountId: input.debitAccountId,
        creditAccountId: input.creditAccountId,
        description: input.description || `Payment for bill ${bill.id.slice(0, 8)}`,
        referenceNumber: input.referenceNumber ?? null,
        paymentMethod: 'OTHER',
        contactId: bill.contactId,
        createdBy: input.createdBy ?? null,
      },
    });

    // Update account balances
    await updateAccountBalances(
      tx,
      input.debitAccountId,
      input.creditAccountId,
      input.amount
    );

    // Create the bill payment link
    const billPayment = await tx.billPayment.create({
      data: {
        billId: input.billId,
        transactionId: transaction.id,
        amount: input.amount,
        notes: input.notes ?? null,
      },
    });

    return billPayment;
  });
}

/**
 * Link an existing transaction to a bill (for retroactive linking)
 */
export async function linkPayment(
  input: LinkPaymentInput,
  organizationId: string
): Promise<BillPayment> {
  const [bill, transaction] = await Promise.all([
    prisma.bill.findFirst({
      where: { id: input.billId, organizationId },
    }),
    prisma.transaction.findFirst({
      where: { id: input.transactionId, organizationId },
    }),
  ]);

  if (!bill) throw new Error('Bill not found');
  if (!transaction) throw new Error('Transaction not found');

  if (bill.status === 'PAID' || bill.status === 'CANCELLED') {
    throw new Error(`Cannot link payment to ${bill.status.toLowerCase()} bill`);
  }

  const remaining = parseFloat(bill.amount.toString()) - parseFloat(bill.amountPaid.toString());
  if (input.amount > remaining) {
    throw new Error(`Link amount (${input.amount}) exceeds remaining balance (${remaining})`);
  }

  const billPayment = await prisma.billPayment.create({
    data: {
      billId: input.billId,
      transactionId: input.transactionId,
      amount: input.amount,
      notes: input.notes ?? null,
    },
  });

  // Recalculate bill status after adding payment
  await recalculateBillStatus(input.billId);

  return billPayment;
}

/**
 * Remove a bill payment link (e.g., when a transaction is voided)
 * Recalculates bill status afterwards
 */
export async function unlinkPayment(
  billPaymentId: string
): Promise<void> {
  const billPayment = await prisma.billPayment.findUnique({
    where: { id: billPaymentId },
  });

  if (!billPayment) {
    throw new Error('Bill payment not found');
  }

  await prisma.billPayment.delete({
    where: { id: billPaymentId },
  });

  await recalculateBillStatus(billPayment.billId);
}

/**
 * Reverse all bill payments linked to a voided transaction
 */
export async function reversePaymentsForTransaction(
  transactionId: string
): Promise<void> {
  const billPayments = await prisma.billPayment.findMany({
    where: { transactionId },
  });

  if (billPayments.length === 0) return;

  // Delete all bill payment links
  await prisma.billPayment.deleteMany({
    where: { transactionId },
  });

  // Recalculate status for each affected bill
  const billIds = [...new Set(billPayments.map(bp => bp.billId))];
  for (const billId of billIds) {
    await recalculateBillStatus(billId);
  }
}
