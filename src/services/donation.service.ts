/**
 * Donation Service
 * First-class domain operations for donations (one-time and pledges).
 * Each donation creates proper accounting entries and optionally a Bill for A/R tracking.
 */

import { prisma } from '@/lib/prisma';
import { updateAccountBalances } from '@/lib/accounting/balance-calculator';
import { MAX_DATE, buildCurrentVersionWhere, buildEntitiesWhere, buildEntityMap } from '@/lib/temporal/temporal-utils';
import type { Donation, Bill } from '@/generated/prisma/client';
import type { Prisma } from '@/generated/prisma/client';

// ── Inputs ──────────────────────────────────────────────────────────────

export interface CreateDonationInput {
  organizationId: string;
  contactId: string;
  type: 'ONE_TIME' | 'PLEDGE';
  amount: number;
  description?: string;
  donorMessage?: string;
  isAnonymous?: boolean;
  isTaxDeductible?: boolean;
  donationDate: Date;
  dueDate?: Date | null;
  campaignId?: string | null;
  // Account IDs for the accounting entry
  arAccountId: string;       // Accounts Receivable (for pledges)
  revenueAccountId: string;  // Revenue / campaign account
  cashAccountId?: string;    // Cash/Bank account (for one-time donations)
  createdBy?: string;
}

export interface UpdateDonationInput {
  amount?: number;
  description?: string;
  donorMessage?: string;
  dueDate?: Date | null;
  isAdmin?: boolean;
}

export interface DonationWithDetails extends Donation {
  contactName: string;
  campaignName?: string | null;
  payments: Array<{
    id: string;
    amount: number;
    date: Date | string;
    notes?: string | null;
  }>;
}

// ── Create ──────────────────────────────────────────────────────────────

/**
 * Create a pledge donation: Donation + Bill (RECEIVABLE) + accrual Transaction.
 * Accounting: DR Accounts Receivable, CR Revenue
 */
export async function createPledgeDonation(input: CreateDonationInput): Promise<Donation> {
  return await prisma.$transaction(async (tx) => {
    const now = new Date();
    const desc = input.description || 'Pledge donation';

    // Create accrual transaction: DR AR, CR Revenue
    const transaction = await tx.transaction.create({
      data: {
        organizationId: input.organizationId,
        transactionDate: input.donationDate,
        amount: input.amount,
        type: 'INCOME',
        debitAccountId: input.arAccountId,
        creditAccountId: input.revenueAccountId,
        description: desc,
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
    await updateAccountBalances(tx, input.arAccountId, input.revenueAccountId, input.amount);

    // Create the bill for A/R lifecycle
    const bill = await tx.bill.create({
      data: {
        organizationId: input.organizationId,
        contactId: input.contactId,
        direction: 'RECEIVABLE',
        status: 'PENDING',
        amount: input.amount,
        amountPaid: 0,
        description: desc,
        issueDate: input.donationDate,
        dueDate: input.dueDate ?? null,
        createdBy: input.createdBy ?? null,
        accrualTransactionId: transaction.id,
      },
    });

    // Create the donation record
    const donation = await tx.donation.create({
      data: {
        organizationId: input.organizationId,
        contactId: input.contactId,
        type: 'PLEDGE',
        status: 'PLEDGED',
        amount: input.amount,
        amountReceived: 0,
        description: input.description ?? null,
        donorMessage: input.donorMessage ?? null,
        isAnonymous: input.isAnonymous ?? false,
        isTaxDeductible: input.isTaxDeductible ?? true,
        donationDate: input.donationDate,
        dueDate: input.dueDate ?? null,
        campaignId: input.campaignId ?? null,
        transactionId: transaction.id,
        billId: bill.id,
        createdBy: input.createdBy ?? null,
      },
    });

    return donation;
  });
}

/**
 * Create a one-time (cash) donation: Donation + cash Transaction. No Bill.
 * Accounting: DR Cash/Bank, CR Revenue
 */
export async function createOneTimeDonation(input: CreateDonationInput): Promise<Donation> {
  if (!input.cashAccountId) {
    throw new Error('Cash account ID is required for one-time donations');
  }

  return await prisma.$transaction(async (tx) => {
    const now = new Date();
    const desc = input.description || 'One-time donation';

    // Create cash receipt transaction: DR Cash, CR Revenue
    const transaction = await tx.transaction.create({
      data: {
        organizationId: input.organizationId,
        transactionDate: input.donationDate,
        amount: input.amount,
        type: 'INCOME',
        debitAccountId: input.cashAccountId!,
        creditAccountId: input.revenueAccountId,
        description: desc,
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
    await updateAccountBalances(tx, input.cashAccountId!, input.revenueAccountId, input.amount);

    // Create the donation record (immediately received)
    const donation = await tx.donation.create({
      data: {
        organizationId: input.organizationId,
        contactId: input.contactId,
        type: 'ONE_TIME',
        status: 'RECEIVED',
        amount: input.amount,
        amountReceived: input.amount,
        description: input.description ?? null,
        donorMessage: input.donorMessage ?? null,
        isAnonymous: input.isAnonymous ?? false,
        isTaxDeductible: input.isTaxDeductible ?? true,
        donationDate: input.donationDate,
        receivedDate: input.donationDate,
        campaignId: input.campaignId ?? null,
        transactionId: transaction.id,
        billId: null,
        createdBy: input.createdBy ?? null,
      },
    });

    return donation;
  });
}

// ── Update ──────────────────────────────────────────────────────────────

/**
 * Update an unpaid donation's details (amount, description, dueDate, message).
 * Only allowed when status is PLEDGED and no payments have been received.
 */
export async function updateDonation(
  donationId: string,
  organizationId: string,
  updates: UpdateDonationInput
): Promise<Donation> {
  const donation = await prisma.donation.findFirst({
    where: { id: donationId, organizationId },
  });

  if (!donation) {
    throw new Error('Donation not found');
  }

  if (donation.status === 'RECEIVED' || donation.status === 'CANCELLED') {
    throw new Error(`Cannot modify a donation that is ${donation.status.toLowerCase()}`);
  }

  if (!updates.isAdmin && Number(donation.amountReceived) > 0) {
    throw new Error('Cannot modify a donation that has received payments');
  }

  return await prisma.$transaction(async (tx) => {
    const data: Record<string, unknown> = {};

    if (updates.description !== undefined) {
      data.description = updates.description;
    }
    if (updates.donorMessage !== undefined) {
      data.donorMessage = updates.donorMessage;
    }
    if (updates.dueDate !== undefined) {
      data.dueDate = updates.dueDate;
    }

    if (updates.amount !== undefined && updates.amount !== Number(donation.amount)) {
      data.amount = updates.amount as unknown as Prisma.Decimal;

      // Update the linked accrual transaction
      if (donation.transactionId) {
        const accrualTx = await tx.transaction.findFirst({
          where: buildCurrentVersionWhere({ id: donation.transactionId }),
        });
        if (accrualTx) {
          await tx.transaction.update({
            where: { versionId: accrualTx.versionId },
            data: { amount: updates.amount as unknown as Prisma.Decimal },
          });
        }
      }

      // Update the linked bill amount
      if (donation.billId) {
        await tx.bill.update({
          where: { id: donation.billId },
          data: { amount: updates.amount as unknown as Prisma.Decimal },
        });
      }
    }

    if (Object.keys(data).length === 0) {
      return donation;
    }

    // Update bill description/dueDate too
    if (donation.billId && (updates.description !== undefined || updates.dueDate !== undefined)) {
      const billData: Record<string, unknown> = {};
      if (updates.description !== undefined) billData.description = updates.description;
      if (updates.dueDate !== undefined) billData.dueDate = updates.dueDate;
      await tx.bill.update({ where: { id: donation.billId }, data: billData });
    }

    return await tx.donation.update({
      where: { id: donationId },
      data,
    });
  });
}

// ── Cancel ──────────────────────────────────────────────────────────────

/**
 * Cancel a donation. Reverses the accounting entry and cancels the linked bill.
 */
export async function cancelDonation(
  donationId: string,
  organizationId: string,
  cancelledBy: string,
  isAdmin: boolean = false
): Promise<Donation> {
  const donation = await prisma.donation.findFirst({
    where: { id: donationId, organizationId },
  });

  if (!donation) {
    throw new Error('Donation not found');
  }

  if (donation.status === 'RECEIVED' || donation.status === 'CANCELLED') {
    throw new Error(`Cannot cancel a donation that is ${donation.status.toLowerCase()}`);
  }

  if (!isAdmin && Number(donation.amountReceived) > 0) {
    throw new Error('Cannot cancel a donation that has received payments. Contact the organization admin for assistance.');
  }

  return await prisma.$transaction(async (tx) => {
    // Soft-delete the accrual transaction
    if (donation.transactionId) {
      const accrualTx = await tx.transaction.findFirst({
        where: buildCurrentVersionWhere({ id: donation.transactionId }),
      });
      if (accrualTx) {
        await tx.transaction.update({
          where: { versionId: accrualTx.versionId },
          data: { isDeleted: true, deletedAt: new Date(), deletedBy: cancelledBy },
        });
      }
    }

    // Cancel the linked bill
    if (donation.billId) {
      await tx.bill.update({
        where: { id: donation.billId },
        data: { status: 'CANCELLED' },
      });
    }

    return await tx.donation.update({
      where: { id: donationId },
      data: { status: 'CANCELLED' },
    });
  });
}

// ── Payment ─────────────────────────────────────────────────────────────

/**
 * Record a payment received against a pledge donation.
 * Updates amountReceived and status on the Donation; delegates bill payment to bill-payment service.
 */
export async function recordDonationPayment(
  donationId: string,
  organizationId: string,
  paymentAmount: number
): Promise<Donation> {
  const donation = await prisma.donation.findFirst({
    where: { id: donationId, organizationId },
  });

  if (!donation) {
    throw new Error('Donation not found');
  }

  if (donation.type !== 'PLEDGE') {
    throw new Error('Only pledge donations accept payments');
  }

  const newReceived = Number(donation.amountReceived) + paymentAmount;
  const totalAmount = Number(donation.amount);
  const isFullyPaid = newReceived >= totalAmount;

  return await prisma.donation.update({
    where: { id: donationId },
    data: {
      amountReceived: newReceived as unknown as Prisma.Decimal,
      status: isFullyPaid ? 'RECEIVED' : 'PARTIAL',
      receivedDate: isFullyPaid ? new Date() : undefined,
    },
  });
}

/**
 * Sync a Donation's status from its linked Bill after a bill payment is recorded.
 * Called from the bills payment API to keep donation status in sync.
 * No-op if the bill has no linked donation.
 */
export async function syncDonationFromBill(billId: string): Promise<void> {
  const donation = await prisma.donation.findFirst({
    where: { billId },
  });

  if (!donation) return; // Bill has no linked donation — nothing to sync

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
  });

  if (!bill) return;

  const amountPaid = Number(bill.amountPaid);
  const totalAmount = Number(donation.amount);
  const isFullyPaid = amountPaid >= totalAmount;

  let newStatus: string = donation.status;
  if (bill.status === 'CANCELLED') {
    newStatus = 'CANCELLED';
  } else if (isFullyPaid) {
    newStatus = 'RECEIVED';
  } else if (amountPaid > 0) {
    newStatus = 'PARTIAL';
  }

  // Only update if something changed
  if (
    newStatus !== donation.status ||
    amountPaid !== Number(donation.amountReceived)
  ) {
    await prisma.donation.update({
      where: { id: donation.id },
      data: {
        amountReceived: amountPaid as unknown as Prisma.Decimal,
        status: newStatus as any,
        receivedDate: isFullyPaid ? (donation.receivedDate ?? new Date()) : null,
      },
    });
  }
}

// ── Queries ─────────────────────────────────────────────────────────────

/**
 * List all donations for an organization with optional filters.
 */
export async function listDonations(
  organizationId: string,
  options: {
    statusFilter?: string;
    typeFilter?: string;
    campaignId?: string;
    contactIds?: string[];
  } = {}
): Promise<DonationWithDetails[]> {
  const where: any = { organizationId };

  if (options.statusFilter && options.statusFilter !== 'ALL') {
    if (options.statusFilter === 'ACTIVE') {
      where.status = { in: ['PLEDGED', 'PARTIAL'] };
    } else {
      where.status = options.statusFilter;
    }
  }
  if (options.typeFilter && options.typeFilter !== 'ALL') {
    where.type = options.typeFilter;
  }
  if (options.campaignId) {
    where.campaignId = options.campaignId;
  }
  if (options.contactIds && options.contactIds.length > 0) {
    where.contactId = { in: options.contactIds };
  }

  const donations = await prisma.donation.findMany({
    where,
    include: { campaign: true },
    orderBy: { createdAt: 'desc' },
  });

  // Resolve contact names (bitemporal)
  const contactIds = [...new Set(donations.map(d => d.contactId))];
  const contacts = contactIds.length > 0
    ? await prisma.contact.findMany({ where: buildEntitiesWhere(contactIds) })
    : [];
  const contactMap = buildEntityMap(contacts);

  // Resolve payments from linked bills
  const billIds = donations.map(d => d.billId).filter(Boolean) as string[];
  const billPayments = billIds.length > 0
    ? await prisma.billPayment.findMany({ where: { billId: { in: billIds } } })
    : [];

  // Resolve payment transaction amounts
  const txIds = [...new Set(billPayments.map(bp => bp.transactionId))];
  const transactions = txIds.length > 0
    ? await prisma.transaction.findMany({ where: buildEntitiesWhere(txIds) })
    : [];
  const txMap = buildEntityMap(transactions);

  const paymentsByBill = new Map<string, typeof billPayments>();
  for (const bp of billPayments) {
    const existing = paymentsByBill.get(bp.billId) || [];
    existing.push(bp);
    paymentsByBill.set(bp.billId, existing);
  }

  return donations.map(donation => {
    const contact = contactMap.get(donation.contactId);
    const payments = donation.billId
      ? (paymentsByBill.get(donation.billId) || []).map(bp => {
          const tx = txMap.get(bp.transactionId);
          return {
            id: bp.id,
            amount: tx ? Number(tx.amount) : 0,
            date: tx?.transactionDate ?? bp.createdAt,
            notes: bp.notes,
          };
        })
      : [];

    return {
      ...donation,
      amount: Number(donation.amount) as any,
      amountReceived: Number(donation.amountReceived) as any,
      contactName: contact?.name ?? 'Unknown',
      campaignName: donation.campaign?.name ?? null,
      payments,
    };
  });
}

/**
 * Get donations for the current user (by their contact IDs).
 */
export async function getMyDonations(
  organizationId: string,
  userContactIds: string[]
): Promise<DonationWithDetails[]> {
  if (userContactIds.length === 0) return [];
  return listDonations(organizationId, { contactIds: userContactIds });
}

/**
 * Get a single donation by ID with full details.
 */
export async function getDonationById(
  donationId: string,
  organizationId: string
): Promise<DonationWithDetails | null> {
  const results = await listDonations(organizationId, {});
  return results.find(d => d.id === donationId) ?? null;
}

/**
 * Get campaign donation summary directly from the Donation table.
 */
export async function getCampaignDonationSummary(
  campaignId: string
): Promise<{ totalPledged: number; totalReceived: number; donationCount: number }> {
  const result = await prisma.donation.aggregate({
    where: {
      campaignId,
      status: { not: 'CANCELLED' },
    },
    _sum: { amount: true, amountReceived: true },
    _count: { id: true },
  });

  return {
    totalPledged: Number(result._sum.amount || 0),
    totalReceived: Number(result._sum.amountReceived || 0),
    donationCount: result._count.id,
  };
}
