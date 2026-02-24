/**
 * Bill Service
 * CRUD operations for bills with status lifecycle management
 */

import { prisma } from '@/lib/prisma';
import { updateAccountBalances } from '@/lib/accounting/balance-calculator';
import { MAX_DATE, buildCurrentVersionWhere, buildEntitiesWhere, buildEntityMap } from '@/lib/temporal/temporal-utils';
import type { Bill, BillPayment, Transaction } from '@/generated/prisma/client';

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'],
  PARTIAL: ['PAID', 'OVERDUE', 'CANCELLED'],
  OVERDUE: ['PARTIAL', 'PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

export interface CreateBillInput {
  organizationId: string;
  contactId: string;
  direction: 'PAYABLE' | 'RECEIVABLE';
  amount: number;
  description: string;
  issueDate: Date;
  dueDate?: Date | null;
  notes?: string | null;
  createdBy?: string;
  // Account IDs for the accrual transaction
  liabilityOrAssetAccountId: string; // AP for payables, AR for receivables
  expenseOrRevenueAccountId: string; // Expense for payables, Revenue for receivables
}

export interface UpdateBillInput {
  description?: string;
  issueDate?: Date | null;
  dueDate?: Date | null;
  notes?: string | null;
  status?: 'DRAFT' | 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  fundingAccountId?: string | null;
}

/**
 * Create a new bill with PENDING status and its accrual transaction.
 *
 * PAYABLE:    DR Expense/Asset,      CR Accounts Payable
 * RECEIVABLE: DR Accounts Receivable, CR Revenue
 */
export async function createBill(input: CreateBillInput): Promise<Bill> {
  return await prisma.$transaction(async (tx) => {
    // Determine debit/credit based on direction
    const debitAccountId = input.direction === 'PAYABLE'
      ? input.expenseOrRevenueAccountId  // DR Expense
      : input.liabilityOrAssetAccountId; // DR Accounts Receivable
    const creditAccountId = input.direction === 'PAYABLE'
      ? input.liabilityOrAssetAccountId  // CR Accounts Payable
      : input.expenseOrRevenueAccountId; // CR Revenue

    const now = new Date();
    const txDescription = input.description || 'No description';

    // Create the accrual transaction
    const accrualTransaction = await tx.transaction.create({
      data: {
        organizationId: input.organizationId,
        transactionDate: input.issueDate,
        amount: input.amount,
        type: input.direction === 'PAYABLE' ? 'EXPENSE' : 'INCOME',
        debitAccountId,
        creditAccountId,
        description: txDescription,
        contactId: input.contactId,
        paymentMethod: 'OTHER',
        versionId: crypto.randomUUID(),
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
      },
    });

    // Update account balances
    await updateAccountBalances(tx, debitAccountId, creditAccountId, input.amount);

    // Create the bill linked to the accrual transaction
    const bill = await tx.bill.create({
      data: {
        organizationId: input.organizationId,
        contactId: input.contactId,
        direction: input.direction,
        status: 'PENDING',
        amount: input.amount,
        amountPaid: 0,
        description: input.description,
        issueDate: input.issueDate,
        dueDate: input.dueDate ?? null,
        notes: input.notes ?? null,
        createdBy: input.createdBy ?? null,
        accrualTransactionId: accrualTransaction.id,
      },
    });

    return bill;
  });
}

/**
 * Update bill fields with status transition validation
 */
export async function updateBill(
  id: string,
  orgId: string,
  updates: UpdateBillInput
): Promise<Bill> {
  return await prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!bill) {
      throw new Error('Bill not found');
    }

    if (updates.status) {
      const allowed = VALID_TRANSITIONS[bill.status] ?? [];
      if (!allowed.includes(updates.status)) {
        throw new Error(
          `Invalid status transition from ${bill.status} to ${updates.status}`
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.issueDate !== undefined) data.issueDate = updates.issueDate;
    if (updates.dueDate !== undefined) data.dueDate = updates.dueDate;
    if (updates.notes !== undefined) data.notes = updates.notes;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.fundingAccountId !== undefined) data.fundingAccountId = updates.fundingAccountId;

    return await tx.bill.update({
      where: { id },
      data,
    });
  });
}

/**
 * Get a bill with its payments and their transactions
 */
export async function getBill(
  id: string,
  orgId: string
): Promise<(Bill & { contact: { id: string; name: string; email: string | null } | null; payments: (BillPayment & { transaction: Transaction | null })[] }) | null> {
  const bill = await prisma.bill.findFirst({
    where: { id, organizationId: orgId },
    include: { payments: true },
  });

  if (!bill) return null;

  // Resolve contact (bitemporal entity)
  let contact: { id: string; name: string; email: string | null } | null = null;
  if (bill.contactId) {
    const contactEntity = await prisma.contact.findFirst({
      where: buildCurrentVersionWhere({ id: bill.contactId }),
      select: { id: true, name: true, email: true },
    });
    contact = contactEntity ?? null;
  }

  // Resolve transactions for each payment (bitemporal entities)
  const txnIds = bill.payments.map(p => p.transactionId);
  const transactions = txnIds.length > 0
    ? await prisma.transaction.findMany({ where: buildEntitiesWhere(txnIds) })
    : [];
  const txnMap = buildEntityMap(transactions);

  const paymentsWithTxn = bill.payments.map(p => ({
    ...p,
    transaction: txnMap.get(p.transactionId) ?? null,
  }));

  return { ...bill, contact, payments: paymentsWithTxn };
}

/**
 * List bills with filtering and pagination
 */
export async function listBills(
  orgId: string,
  options?: {
    direction?: string;
    status?: string;
    contactId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ bills: Bill[]; totalCount: number }> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    organizationId: orgId,
    ...(options?.direction && { direction: options.direction }),
    ...(options?.status && { status: options.status }),
    ...(options?.contactId && { contactId: options.contactId }),
    ...(options?.search && {
      description: { contains: options.search, mode: 'insensitive' },
    }),
  };

  const [bills, totalCount] = await Promise.all([
    prisma.bill.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.bill.count({ where }),
  ]);

  // Resolve contacts (bitemporal entities)
  const contactIds = [...new Set(bills.map(b => b.contactId))];
  const contacts = contactIds.length > 0
    ? await prisma.contact.findMany({ where: buildEntitiesWhere(contactIds) })
    : [];
  const contactMap = buildEntityMap(contacts);

  const billsWithContacts = bills.map(b => ({
    ...b,
    contact: contactMap.get(b.contactId) ?? null,
  }));

  return { bills: billsWithContacts, totalCount };
}

/**
 * Recalculate bill status from linked transaction amounts.
 * Sets PAID (with paidInFullDate) if fully paid, PARTIAL if partially paid.
 */
export async function recalculateBillStatus(billId: string): Promise<Bill> {
  return await prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: billId } });

    // Derive total paid from linked transactions (not a separate amount column)
    const payments = await tx.billPayment.findMany({
      where: { billId },
    });

    // Resolve transaction amounts (bitemporal entities)
    let totalPaid = 0;
    if (payments.length > 0) {
      const txnIds = payments.map(p => p.transactionId);
      const transactions = await tx.transaction.findMany({
        where: buildEntitiesWhere(txnIds),
        select: { id: true, amount: true },
      });
      const txnMap = new Map(transactions.map(t => [t.id, t]));
      totalPaid = payments.reduce((sum, p) => {
        const txn = txnMap.get(p.transactionId);
        return sum + (txn ? parseFloat(txn.amount.toString()) : 0);
      }, 0);
    }

    const amountNum = Number(bill.amount);

    let newStatus = bill.status;
    let paidInFullDate = bill.paidInFullDate;

    if (totalPaid >= amountNum) {
      newStatus = 'PAID';
      paidInFullDate = paidInFullDate ?? new Date();
    } else if (totalPaid > 0) {
      newStatus = 'PARTIAL';
      paidInFullDate = null;
    }

    return await tx.bill.update({
      where: { id: billId },
      data: {
        amountPaid: totalPaid,
        status: newStatus,
        paidInFullDate,
      },
    });
  });
}

/**
 * Cancel a bill. Throws if the bill is already PAID.
 */
export async function cancelBill(id: string, orgId: string): Promise<Bill> {
  return await prisma.$transaction(async (tx) => {
    const bill = await tx.bill.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status === 'PAID') {
      throw new Error('Cannot cancel a bill that is already PAID');
    }

    if (bill.status === 'CANCELLED') {
      throw new Error('Bill is already cancelled');
    }

    return await tx.bill.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  });
}
