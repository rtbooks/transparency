/**
 * PlannedPurchase Service
 * Business logic for planned purchase operations with temporal versioning
 */

import { prisma } from '@/lib/prisma';
import { TemporalRepository } from '@/lib/temporal/temporal-repository';
import { buildCurrentVersionWhere, MAX_DATE } from '@/lib/temporal/temporal-utils';
import type { PlannedPurchase, PurchaseStatus, PurchasePriority, Prisma } from '@/generated/prisma/client';

const purchaseRepo = new TemporalRepository<PlannedPurchase>(prisma, 'plannedPurchase');

export interface CreatePlannedPurchaseInput {
  organizationId: string;
  title: string;
  description: string;
  estimatedAmount: Prisma.Decimal;
  targetDate?: Date | null;
  category?: string | null;
  priority?: PurchasePriority;
  createdByUserId: string;
}

export interface UpdatePlannedPurchaseInput {
  title?: string;
  description?: string;
  estimatedAmount?: Prisma.Decimal;
  targetDate?: Date | null;
  category?: string | null;
  status?: PurchaseStatus;
  priority?: PurchasePriority;
  actualTransactionId?: string | null;
  actualAmount?: Prisma.Decimal | null;
  completedAt?: Date | null;
}

/**
 * Create a new planned purchase (initial version)
 */
export async function createPlannedPurchase(
  input: CreatePlannedPurchaseInput
): Promise<PlannedPurchase> {
  const now = new Date();

  return await prisma.plannedPurchase.create({
    data: {
      organizationId: input.organizationId,
      title: input.title,
      description: input.description,
      estimatedAmount: input.estimatedAmount,
      targetDate: input.targetDate,
      category: input.category,
      priority: input.priority || 'MEDIUM',
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
 * Find current version of planned purchase by ID
 */
export async function findPlannedPurchaseById(
  id: string
): Promise<PlannedPurchase | null> {
  return await purchaseRepo.findCurrentById(id);
}

/**
 * Find all current planned purchases for an organization
 */
export async function findPlannedPurchasesByOrganization(
  organizationId: string
): Promise<PlannedPurchase[]> {
  return await purchaseRepo.findAllCurrent({ organizationId });
}

/**
 * Find planned purchases by status
 */
export async function findPlannedPurchasesByStatus(
  organizationId: string,
  status: PurchaseStatus
): Promise<PlannedPurchase[]> {
  return await prisma.plannedPurchase.findMany({
    where: buildCurrentVersionWhere({
      organizationId,
      status,
    }),
    orderBy: [
      { priority: 'desc' },
      { targetDate: 'asc' },
    ],
  });
}

/**
 * Find active (planned or in-progress) purchases
 */
export async function findActivePlannedPurchases(
  organizationId: string
): Promise<PlannedPurchase[]> {
  return await prisma.plannedPurchase.findMany({
    where: buildCurrentVersionWhere({
      organizationId,
      status: {
        in: ['PLANNED', 'IN_PROGRESS'],
      },
    }),
    orderBy: [
      { priority: 'desc' },
      { targetDate: 'asc' },
    ],
  });
}

/**
 * Update planned purchase (creates new version)
 */
export async function updatePlannedPurchase(
  id: string,
  updates: UpdatePlannedPurchaseInput,
  userId: string
): Promise<PlannedPurchase> {
  return await purchaseRepo.update(id, updates, userId);
}

/**
 * Update purchase status (creates new version)
 */
export async function updatePurchaseStatus(
  id: string,
  status: PurchaseStatus,
  userId: string
): Promise<PlannedPurchase> {
  const updates: UpdatePlannedPurchaseInput = { status };
  
  // If completing, set completedAt
  if (status === 'COMPLETED') {
    updates.completedAt = new Date();
  }
  
  return await purchaseRepo.update(id, updates, userId);
}

/**
 * Mark purchase as completed and link to transaction
 */
export async function completePlannedPurchase(
  id: string,
  transactionId: string,
  actualAmount: Prisma.Decimal,
  userId: string
): Promise<PlannedPurchase> {
  return await purchaseRepo.update(
    id,
    {
      status: 'COMPLETED',
      actualTransactionId: transactionId,
      actualAmount,
      completedAt: new Date(),
    },
    userId
  );
}

/**
 * Cancel planned purchase (update status)
 */
export async function cancelPlannedPurchase(
  id: string,
  userId: string
): Promise<PlannedPurchase> {
  return await updatePurchaseStatus(id, 'CANCELLED', userId);
}

/**
 * Soft delete planned purchase
 */
export async function deletePlannedPurchase(
  id: string,
  userId: string
): Promise<PlannedPurchase> {
  return await purchaseRepo.softDelete(id, userId);
}

/**
 * Get planned purchase version history
 */
export async function getPlannedPurchaseHistory(
  id: string
): Promise<PlannedPurchase[]> {
  return await purchaseRepo.findHistory(id);
}

/**
 * Get planned purchase as it was at a specific date
 */
export async function getPlannedPurchaseAsOf(
  id: string,
  asOfDate: Date
): Promise<PlannedPurchase | null> {
  return await purchaseRepo.findAsOf(id, asOfDate);
}

/**
 * Get purchase statistics for organization
 */
export async function getPurchaseStatistics(organizationId: string) {
  const purchases = await findPlannedPurchasesByOrganization(organizationId);
  
  return {
    total: purchases.length,
    planned: purchases.filter(p => p.status === 'PLANNED').length,
    inProgress: purchases.filter(p => p.status === 'IN_PROGRESS').length,
    completed: purchases.filter(p => p.status === 'COMPLETED').length,
    cancelled: purchases.filter(p => p.status === 'CANCELLED').length,
    totalEstimated: purchases
      .filter(p => ['PLANNED', 'IN_PROGRESS'].includes(p.status))
      .reduce((sum, p) => sum + Number(p.estimatedAmount), 0),
    totalCompleted: purchases
      .filter(p => p.status === 'COMPLETED' && p.actualAmount)
      .reduce((sum, p) => sum + Number(p.actualAmount), 0),
  };
}

export const PlannedPurchaseService = {
  create: createPlannedPurchase,
  findById: findPlannedPurchaseById,
  findByOrganization: findPlannedPurchasesByOrganization,
  findByStatus: findPlannedPurchasesByStatus,
  update: updatePlannedPurchase,
  updateStatus: updatePurchaseStatus,
  complete: completePlannedPurchase,
  cancel: cancelPlannedPurchase,
  delete: deletePlannedPurchase,
  
  // Temporal queries
  findHistory: getPlannedPurchaseHistory,
  
  findAsOf: async (organizationId: string, asOfDate: Date): Promise<PlannedPurchase[]> => {
    return await prisma.plannedPurchase.findMany({
      where: {
        organizationId,
        validFrom: { lte: asOfDate },
        validTo: { gt: asOfDate },
        isDeleted: false,
      },
      orderBy: { targetDate: 'asc' },
    });
  },
  
  // Utility methods
  getStatistics: getPurchaseStatistics,
};
