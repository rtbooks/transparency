/**
 * ProgramSpending Service
 * Business logic for program spending operations with temporal versioning
 */

import { prisma } from '@/lib/prisma';
import { TemporalRepository } from '@/lib/temporal/temporal-repository';
import { buildCurrentVersionWhere, MAX_DATE } from '@/lib/temporal/temporal-utils';
import type { ProgramSpending, SpendingStatus, Prisma } from '@/generated/prisma/client';

const spendingRepo = new TemporalRepository<ProgramSpending>(prisma, 'programSpending');

export interface CreateProgramSpendingInput {
  organizationId: string;
  title: string;
  description: string;
  estimatedAmount: Prisma.Decimal;
  targetDate?: Date | null;
  createdByUserId: string;
}

export interface UpdateProgramSpendingInput {
  title?: string;
  description?: string;
  estimatedAmount?: Prisma.Decimal;
  targetDate?: Date | null;
  status?: SpendingStatus;
  completedAt?: Date | null;
}

/**
 * Create a new program spending item (initial version)
 */
export async function createProgramSpending(
  input: CreateProgramSpendingInput
): Promise<ProgramSpending> {
  const now = new Date();

  return await prisma.programSpending.create({
    data: {
      organizationId: input.organizationId,
      title: input.title,
      description: input.description,
      estimatedAmount: input.estimatedAmount,
      targetDate: input.targetDate,
      status: 'PLANNED',
      createdBy: input.createdByUserId,
      
      // Temporal fields (initial version)
      versionId: crypto.randomUUID(),
      previousVersionId: null,
      validFrom: now,
      validTo: MAX_DATE,
      systemFrom: now,
      systemTo: MAX_DATE,
      isDeleted: false,
      changedBy: input.createdByUserId,
    },
  });
}

/**
 * Find current version of program spending by ID
 */
export async function findProgramSpendingById(
  id: string
): Promise<ProgramSpending | null> {
  return await spendingRepo.findCurrentById(id);
}

/**
 * Find all current program spending for an organization
 */
export async function findProgramSpendingByOrganization(
  organizationId: string
): Promise<ProgramSpending[]> {
  return await spendingRepo.findAllCurrent({ organizationId });
}

/**
 * Find program spending by status
 */
export async function findProgramSpendingByStatus(
  organizationId: string,
  status: SpendingStatus
): Promise<ProgramSpending[]> {
  return await prisma.programSpending.findMany({
    where: buildCurrentVersionWhere({
      organizationId,
      status,
    }),
    orderBy: [
      { targetDate: 'asc' },
    ],
  });
}

/**
 * Find active (planned) spending items
 */
export async function findActiveProgramSpending(
  organizationId: string
): Promise<ProgramSpending[]> {
  return await prisma.programSpending.findMany({
    where: buildCurrentVersionWhere({
      organizationId,
      status: 'PLANNED',
    }),
    orderBy: [
      { targetDate: 'asc' },
    ],
  });
}

/**
 * Update program spending (creates new version)
 */
export async function updateProgramSpending(
  id: string,
  updates: UpdateProgramSpendingInput,
  userId: string
): Promise<ProgramSpending> {
  return await spendingRepo.update(id, updates, userId);
}

/**
 * Update spending status (creates new version)
 */
export async function updateSpendingStatus(
  id: string,
  status: SpendingStatus,
  userId: string
): Promise<ProgramSpending> {
  const updates: UpdateProgramSpendingInput = { status };
  
  if (status === 'PURCHASED') {
    updates.completedAt = new Date();
  }
  
  return await spendingRepo.update(id, updates, userId);
}

/**
 * Cancel program spending (update status)
 */
export async function cancelProgramSpending(
  id: string,
  userId: string
): Promise<ProgramSpending> {
  return await updateSpendingStatus(id, 'CANCELLED', userId);
}

/**
 * Soft delete program spending
 */
export async function deleteProgramSpending(
  id: string,
  userId: string
): Promise<ProgramSpending> {
  return await spendingRepo.softDelete(id, userId);
}

/**
 * Get program spending version history
 */
export async function getProgramSpendingHistory(
  id: string
): Promise<ProgramSpending[]> {
  return await spendingRepo.findHistory(id);
}

/**
 * Get program spending as it was at a specific date
 */
export async function getProgramSpendingAsOf(
  id: string,
  asOfDate: Date
): Promise<ProgramSpending | null> {
  return await spendingRepo.findAsOf(id, asOfDate);
}

// --- Transaction linking ---

/**
 * Link a transaction to a program spending item
 */
export async function linkTransaction(
  programSpendingId: string,
  transactionId: string,
  amount: Prisma.Decimal,
  userId: string
) {
  return await prisma.programSpendingTransaction.create({
    data: {
      programSpendingId,
      transactionId,
      amount,
      linkedBy: userId,
    },
  });
}

/**
 * Unlink a transaction from a program spending item
 */
export async function unlinkTransaction(
  programSpendingId: string,
  transactionId: string
) {
  return await prisma.programSpendingTransaction.delete({
    where: {
      programSpendingId_transactionId: {
        programSpendingId,
        transactionId,
      },
    },
  });
}

/**
 * Get all linked transactions for a spending item
 */
export async function getLinkedTransactions(programSpendingId: string) {
  return await prisma.programSpendingTransaction.findMany({
    where: { programSpendingId },
    orderBy: { linkedAt: 'desc' },
  });
}

/**
 * Get actual total spent (sum of linked transaction amounts)
 */
export async function getActualTotal(programSpendingId: string): Promise<number> {
  const result = await prisma.programSpendingTransaction.aggregate({
    where: { programSpendingId },
    _sum: { amount: true },
  });
  return Number(result._sum.amount || 0);
}

/**
 * Get spending statistics for organization
 */
export async function getSpendingStatistics(organizationId: string) {
  const items = await findProgramSpendingByOrganization(organizationId);
  
  // Get actual totals for completed items
  const completedIds = items
    .filter(p => p.status === 'PURCHASED')
    .map(p => p.id);
  
  let totalActual = 0;
  if (completedIds.length > 0) {
    const result = await prisma.programSpendingTransaction.aggregate({
      where: { programSpendingId: { in: completedIds } },
      _sum: { amount: true },
    });
    totalActual = Number(result._sum.amount || 0);
  }

  return {
    total: items.length,
    planned: items.filter(p => p.status === 'PLANNED').length,
    purchased: items.filter(p => p.status === 'PURCHASED').length,
    cancelled: items.filter(p => p.status === 'CANCELLED').length,
    totalEstimated: items
      .filter(p => p.status === 'PLANNED')
      .reduce((sum, p) => sum + Number(p.estimatedAmount), 0),
    totalActual,
  };
}

export const ProgramSpendingService = {
  create: createProgramSpending,
  findById: findProgramSpendingById,
  findByOrganization: findProgramSpendingByOrganization,
  findByStatus: findProgramSpendingByStatus,
  findActive: findActiveProgramSpending,
  update: updateProgramSpending,
  updateStatus: updateSpendingStatus,
  cancel: cancelProgramSpending,
  delete: deleteProgramSpending,
  linkTransaction,
  unlinkTransaction,
  getLinkedTransactions,
  getActualTotal,
  
  // Temporal queries
  findHistory: getProgramSpendingHistory,
  
  findAsOf: async (organizationId: string, asOfDate: Date): Promise<ProgramSpending[]> => {
    return await prisma.programSpending.findMany({
      where: {
        organizationId,
        validFrom: { lte: asOfDate },
        validTo: { gt: asOfDate },
        isDeleted: false,
      },
      orderBy: { targetDate: 'asc' },
    });
  },
  
  getStatistics: getSpendingStatistics,
};
