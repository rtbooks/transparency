/**
 * Campaign Service
 * CRUD operations for fundraising campaigns and progress tracking.
 */

import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import type { Campaign } from '@/generated/prisma/client';

export interface CreateCampaignInput {
  organizationId: string;
  accountId: string;
  name: string;
  description?: string | null;
  targetAmount?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  createdBy?: string;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string | null;
  targetAmount?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
}

export interface CampaignWithProgress extends Campaign {
  amountRaised: number;
  progressPercent: number | null;
  donationCount: number;
}

/**
 * Create a new campaign linked to a Revenue account under the org's donations account.
 */
export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  // Verify the account exists, is a Revenue type, and belongs to this org
  const account = await prisma.account.findFirst({
    where: buildCurrentVersionWhere({
      id: input.accountId,
      organizationId: input.organizationId,
      type: 'REVENUE',
    }),
  });

  if (!account) {
    throw new Error('Account not found or is not a Revenue account in this organization');
  }

  // Verify the org has a donations account set and this account is under it
  const org = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ id: input.organizationId }),
  });

  if (org?.donationsAccountId && account.id !== org.donationsAccountId) {
    // Check if the account's parent is the donations account (or nested under it)
    const isUnderDonationsAccount = await isAccountDescendantOf(
      input.organizationId,
      input.accountId,
      org.donationsAccountId
    );
    if (!isUnderDonationsAccount) {
      throw new Error('Campaign account must be under the designated donations account');
    }
  }

  return await prisma.campaign.create({
    data: {
      organizationId: input.organizationId,
      accountId: input.accountId,
      name: input.name,
      description: input.description ?? null,
      targetAmount: input.targetAmount ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      createdBy: input.createdBy ?? null,
    },
  });
}

/**
 * Update an existing campaign.
 */
export async function updateCampaign(
  campaignId: string,
  updates: UpdateCampaignInput
): Promise<Campaign> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  return await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.targetAmount !== undefined && { targetAmount: updates.targetAmount }),
      ...(updates.startDate !== undefined && { startDate: updates.startDate }),
      ...(updates.endDate !== undefined && { endDate: updates.endDate }),
      ...(updates.status !== undefined && { status: updates.status }),
    },
  });
}

/**
 * List all campaigns for an organization with raised amounts.
 */
export async function listCampaigns(
  organizationId: string,
  options: { statusFilter?: string } = {}
): Promise<CampaignWithProgress[]> {
  const where: any = { organizationId };
  if (options.statusFilter) {
    where.status = options.statusFilter;
  }

  const campaigns = await prisma.campaign.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  // Calculate progress for each campaign from RECEIVABLE bills
  return await Promise.all(
    campaigns.map(async (campaign) => {
      const progress = await getCampaignProgress(campaign);
      return { ...campaign, ...progress };
    })
  );
}

/**
 * Get a single campaign with progress.
 */
export async function getCampaignById(
  campaignId: string
): Promise<CampaignWithProgress | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) return null;

  const progress = await getCampaignProgress(campaign);
  return { ...campaign, ...progress };
}

/**
 * Calculate the raised amount for a campaign from RECEIVABLE bills
 * that target the campaign's linked account.
 */
async function getCampaignProgress(
  campaign: Campaign
): Promise<{ amountRaised: number; progressPercent: number | null; donationCount: number }> {
  // Find all RECEIVABLE bills whose accrual transaction credits the campaign's account
  // The bill's accrual transaction for RECEIVABLE: DR AR, CR Revenue (campaign account)
  // We need to find transactions where creditAccountId = campaign.accountId
  const result = await prisma.bill.aggregate({
    where: {
      organizationId: campaign.organizationId,
      direction: 'RECEIVABLE',
      // Match bills whose accrual transaction credits the campaign account
      // Since bills track the contact, we need to look at the linked transaction
      status: { notIn: ['CANCELLED', 'DRAFT'] },
    },
    _sum: { amount: true },
    _count: { id: true },
  });

  // More precise: query transactions that credit this specific account
  const txResult = await prisma.transaction.aggregate({
    where: buildCurrentVersionWhere({
      organizationId: campaign.organizationId,
      creditAccountId: campaign.accountId,
      type: 'INCOME',
    }),
    _sum: { amount: true },
    _count: { id: true },
  });

  const amountRaised = Number(txResult._sum.amount || 0);
  const targetAmount = campaign.targetAmount ? Number(campaign.targetAmount) : null;
  const progressPercent = targetAmount && targetAmount > 0
    ? Math.min(Math.round((amountRaised / targetAmount) * 100), 100)
    : null;

  return {
    amountRaised,
    progressPercent,
    donationCount: txResult._count.id,
  };
}

/**
 * Check if an account is a descendant of another account in the hierarchy.
 */
async function isAccountDescendantOf(
  organizationId: string,
  accountId: string,
  ancestorId: string,
  maxDepth: number = 5
): Promise<boolean> {
  let currentId = accountId;

  for (let i = 0; i < maxDepth; i++) {
    if (currentId === ancestorId) return true;

    const account = await prisma.account.findFirst({
      where: buildCurrentVersionWhere({ id: currentId, organizationId }),
      select: { parentAccountId: true },
    });

    if (!account?.parentAccountId) return false;
    currentId = account.parentAccountId;
  }

  return false;
}
