/**
 * Temporal Analytics Utilities
 * Track changes and trends over time
 */

import { prisma } from '@/lib/prisma';

interface AccountEvolutionPoint {
  date: Date;
  versionId: string;
  name: string;
  code: string;
  balance: number;
  isActive: boolean;
}

interface MembershipChange {
  date: Date;
  userId: string;
  userName?: string;
  action: 'added' | 'removed' | 'role_changed';
  oldRole?: string;
  newRole?: string;
  changedBy?: string;
}

interface PurchaseTimeline {
  id: string;
  description: string;
  events: Array<{
    date: Date;
    status: string;
    estimatedAmount?: number;
    actualAmount?: number;
    changedBy?: string;
  }>;
}

/**
 * Get account evolution over time
 */
export async function getAccountEvolution(
  accountId: string,
  startDate: Date,
  endDate: Date
): Promise<AccountEvolutionPoint[]> {
  const versions = await prisma.account.findMany({
    where: {
      id: accountId,
      systemFrom: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { systemFrom: 'asc' },
  });

  return versions.map((version) => ({
    date: version.systemFrom,
    versionId: version.versionId,
    name: version.name,
    code: version.code,
    balance: Number(version.currentBalance),
    isActive: version.isActive,
  }));
}

/**
 * Get chart of accounts evolution (number of accounts over time)
 */
export async function getChartEvolution(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ date: Date; accountCount: number; activeCount: number }>> {
  // Get all account versions in the period
  const versions = await prisma.account.findMany({
    where: {
      organizationId,
      systemFrom: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { systemFrom: 'asc' },
  });

  // Group by date
  const dateMap = new Map<string, { total: Set<string>; active: Set<string> }>();

  versions.forEach((version) => {
    const dateKey = version.systemFrom.toISOString().split('T')[0];
    
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, { total: new Set(), active: new Set() });
    }

    const entry = dateMap.get(dateKey)!;
    if (!version.isDeleted) {
      entry.total.add(version.id);
      if (version.isActive) {
        entry.active.add(version.id);
      }
    }
  });

  return Array.from(dateMap.entries()).map(([dateStr, data]) => ({
    date: new Date(dateStr),
    accountCount: data.total.size,
    activeCount: data.active.size,
  }));
}

/**
 * Get membership changes over time
 */
export async function getMembershipChanges(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<MembershipChange[]> {
  // Get all organizationUser versions in the period
  const versions = await prisma.organizationUser.findMany({
    where: {
      organizationId,
      systemFrom: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { systemFrom: 'asc' },
  });

  const changes: MembershipChange[] = [];
  const userVersions = new Map<string, typeof versions>();

  // Group versions by userId
  versions.forEach((version) => {
    if (!userVersions.has(version.userId)) {
      userVersions.set(version.userId, []);
    }
    userVersions.get(version.userId)!.push(version);
  });

  // Analyze each user's version history
  userVersions.forEach((userHistory, userId) => {
    userHistory.forEach((version, index) => {
      const previous = index > 0 ? userHistory[index - 1] : null;

      if (!previous) {
        // First version - user added
        changes.push({
          date: version.systemFrom,
          userId: version.userId,
          userName: version.user?.name || version.user?.email,
          action: 'added',
          newRole: version.role,
          changedBy: version.changedBy || undefined,
        });
      } else if (version.isDeleted && !previous.isDeleted) {
        // User removed
        changes.push({
          date: version.systemFrom,
          userId: version.userId,
          userName: version.user?.name || version.user?.email,
          action: 'removed',
          oldRole: previous.role,
          changedBy: version.changedBy || undefined,
        });
      } else if (version.role !== previous.role) {
        // Role changed
        changes.push({
          date: version.systemFrom,
          userId: version.userId,
          userName: version.user?.name || version.user?.email,
          action: 'role_changed',
          oldRole: previous.role,
          newRole: version.role,
          changedBy: version.changedBy || undefined,
        });
      }
    });
  });

  return changes.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Get planned purchase timeline
 */
export async function getPurchaseTimeline(
  purchaseId: string
): Promise<PurchaseTimeline> {
  const versions = await prisma.plannedPurchase.findMany({
    where: { id: purchaseId },
    orderBy: { systemFrom: 'asc' },
  });

  if (versions.length === 0) {
    throw new Error('Planned purchase not found');
  }

  const firstVersion = versions[0];

  return {
    id: purchaseId,
    description: firstVersion.description,
    events: versions.map((version) => ({
      date: version.systemFrom,
      status: version.status,
      estimatedAmount: version.estimatedAmount ? Number(version.estimatedAmount) : undefined,
      actualAmount: version.actualAmount ? Number(version.actualAmount) : undefined,
      changedBy: version.changedBy || undefined,
    })),
  };
}

/**
 * Get purchase statistics over time
 */
export async function getPurchaseStatisticsOverTime(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{
  date: Date;
  planned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  totalEstimated: number;
}>> {
  const versions = await prisma.plannedPurchase.findMany({
    where: {
      organizationId,
      systemFrom: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { systemFrom: 'asc' },
  });

  // Group by date
  const dateMap = new Map<string, Array<typeof versions[0]>>();

  versions.forEach((version) => {
    const dateKey = version.systemFrom.toISOString().split('T')[0];
    
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, []);
    }

    dateMap.get(dateKey)!.push(version);
  });

  return Array.from(dateMap.entries()).map(([dateStr, dayVersions]) => {
    const counts = {
      planned: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      totalEstimated: 0,
    };

    dayVersions.forEach((version) => {
      if (version.isDeleted) return;

      switch (version.status) {
        case 'PLANNED':
          counts.planned++;
          counts.totalEstimated += Number(version.estimatedAmount);
          break;
        case 'IN_PROGRESS':
          counts.inProgress++;
          counts.totalEstimated += Number(version.estimatedAmount);
          break;
        case 'COMPLETED':
          counts.completed++;
          break;
        case 'CANCELLED':
          counts.cancelled++;
          break;
      }
    });

    return {
      date: new Date(dateStr),
      ...counts,
    };
  });
}

/**
 * Get organization growth metrics
 */
export async function getOrganizationGrowthMetrics(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  accountGrowth: number;
  membershipGrowth: number;
  transactionGrowth: number;
  revenueGrowth: number;
}> {
  // Get counts at start and end dates
  const [startAccounts, endAccounts] = await Promise.all([
    prisma.account.count({
      where: {
        organizationId,
        validFrom: { lte: startDate },
        validTo: { gt: startDate },
        isDeleted: false,
      },
    }),
    prisma.account.count({
      where: {
        organizationId,
        validFrom: { lte: endDate },
        validTo: { gt: endDate },
        isDeleted: false,
      },
    }),
  ]);

  const [startMembers, endMembers] = await Promise.all([
    prisma.organizationUser.count({
      where: {
        organizationId,
        validFrom: { lte: startDate },
        validTo: { gt: startDate },
        isDeleted: false,
      },
    }),
    prisma.organizationUser.count({
      where: {
        organizationId,
        validFrom: { lte: endDate },
        validTo: { gt: endDate },
        isDeleted: false,
      },
    }),
  ]);

  const [startTransactions, endTransactions] = await Promise.all([
    prisma.transaction.count({
      where: {
        organizationId,
        transactionDate: { lte: startDate },
      },
    }),
    prisma.transaction.count({
      where: {
        organizationId,
        transactionDate: { lte: endDate },
      },
    }),
  ]);

  // Calculate revenue growth
  const [startRevenue, endRevenue] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        organizationId,
        transactionDate: { lte: startDate },
        creditAccount: { type: 'REVENUE' },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        organizationId,
        transactionDate: { lte: endDate },
        creditAccount: { type: 'REVENUE' },
      },
      _sum: { amount: true },
    }),
  ]);

  const startRevenueTotal = Number(startRevenue._sum?.amount || 0);
  const endRevenueTotal = Number(endRevenue._sum?.amount || 0);

  return {
    accountGrowth: endAccounts - startAccounts,
    membershipGrowth: endMembers - startMembers,
    transactionGrowth: endTransactions - startTransactions,
    revenueGrowth: endRevenueTotal - startRevenueTotal,
  };
}
