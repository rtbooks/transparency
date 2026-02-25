/**
 * Campaign Service
 * CRUD operations for fundraising campaigns and progress tracking.
 */

import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { getCampaignDonationSummary } from '@/services/donation.service';
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
  // Campaign constraint fields
  campaignType?: 'OPEN' | 'FIXED_UNIT' | 'TIERED';
  unitPrice?: number | null;
  maxUnits?: number | null;
  unitLabel?: string | null;
  allowMultiUnit?: boolean;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string | null;
  targetAmount?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  status?: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  // Campaign constraint fields
  unitPrice?: number | null;
  maxUnits?: number | null;
  unitLabel?: string | null;
  allowMultiUnit?: boolean;
}

export interface CampaignWithProgress extends Campaign {
  amountRaised: number;
  progressPercent: number | null;
  donationCount: number;
  unitsSold?: number;
  unitsRemaining?: number | null;
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

  // Validate campaign type constraints
  const campaignType = input.campaignType || 'OPEN';
  if (campaignType === 'FIXED_UNIT') {
    if (!input.unitPrice || input.unitPrice <= 0) {
      throw new Error('FIXED_UNIT campaigns require a positive unit price');
    }
  }

  // For FIXED_UNIT with maxUnits, auto-calculate targetAmount
  const targetAmount = campaignType === 'FIXED_UNIT' && input.unitPrice && input.maxUnits
    ? input.unitPrice * input.maxUnits
    : input.targetAmount ?? null;

  return await prisma.campaign.create({
    data: {
      organizationId: input.organizationId,
      accountId: input.accountId,
      name: input.name,
      description: input.description ?? null,
      targetAmount,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      createdBy: input.createdBy ?? null,
      campaignType,
      unitPrice: input.unitPrice ?? null,
      maxUnits: input.maxUnits ?? null,
      unitLabel: input.unitLabel ?? null,
      allowMultiUnit: input.allowMultiUnit ?? true,
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
      ...(updates.unitPrice !== undefined && { unitPrice: updates.unitPrice }),
      ...(updates.maxUnits !== undefined && { maxUnits: updates.maxUnits }),
      ...(updates.unitLabel !== undefined && { unitLabel: updates.unitLabel }),
      ...(updates.allowMultiUnit !== undefined && { allowMultiUnit: updates.allowMultiUnit }),
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
    include: { tiers: { orderBy: { sortOrder: 'asc' } } },
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
    include: { tiers: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!campaign) return null;

  const progress = await getCampaignProgress(campaign);
  return { ...campaign, ...progress };
}

/**
 * Calculate the raised amount for a campaign from the Donation table.
 */
async function getCampaignProgress(
  campaign: Campaign
): Promise<{ amountRaised: number; progressPercent: number | null; donationCount: number; unitsSold?: number; unitsRemaining?: number | null }> {
  const summary = await getCampaignDonationSummary(campaign.id);

  const targetAmount = campaign.targetAmount ? Number(campaign.targetAmount) : null;
  const progressPercent = targetAmount && targetAmount > 0
    ? Math.min(Math.round((summary.totalPledged / targetAmount) * 100), 100)
    : null;

  const result: { amountRaised: number; progressPercent: number | null; donationCount: number; unitsSold?: number; unitsRemaining?: number | null } = {
    amountRaised: summary.totalPledged,
    progressPercent,
    donationCount: summary.donationCount,
  };

  // For FIXED_UNIT campaigns, calculate units sold
  if (campaign.campaignType === 'FIXED_UNIT') {
    const unitsSold = await getUnitsSold(campaign.id);
    result.unitsSold = unitsSold;
    result.unitsRemaining = campaign.maxUnits ? campaign.maxUnits - unitsSold : null;
  }

  return result;
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

/**
 * Get the total units sold for a FIXED_UNIT campaign.
 */
export async function getUnitsSold(campaignId: string): Promise<number> {
  const result = await prisma.donation.aggregate({
    where: {
      campaignId,
      status: { notIn: ['CANCELLED'] },
      unitCount: { not: null },
    },
    _sum: { unitCount: true },
  });
  return result._sum.unitCount ?? 0;
}

/**
 * Get the number of donations for a specific tier.
 */
export async function getTierSlotsFilled(tierId: string): Promise<number> {
  return prisma.donation.count({
    where: {
      tierId,
      status: { notIn: ['CANCELLED'] },
    },
  });
}

/**
 * Validate a donation against campaign constraints.
 * Throws if the donation violates any campaign rules.
 */
export async function validateDonationAgainstCampaign(
  campaignId: string,
  amount: number,
  unitCount?: number | null,
  tierId?: string | null
): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { tiers: true },
  });
  if (!campaign) throw new Error('Campaign not found');

  if (campaign.status !== 'ACTIVE') {
    throw new Error('Campaign is not accepting donations');
  }

  switch (campaign.campaignType) {
    case 'FIXED_UNIT': {
      if (!unitCount || unitCount < 1) {
        throw new Error(`This campaign requires selecting at least 1 ${campaign.unitLabel || 'unit'}`);
      }
      if (!campaign.allowMultiUnit && unitCount > 1) {
        throw new Error(`This campaign only allows 1 ${campaign.unitLabel || 'unit'} per donation`);
      }
      const expectedAmount = Number(campaign.unitPrice!) * unitCount;
      if (Math.abs(amount - expectedAmount) > 0.01) {
        throw new Error(
          `Donation amount must be $${expectedAmount.toFixed(2)} (${unitCount} × $${Number(campaign.unitPrice!).toFixed(2)})`
        );
      }
      if (campaign.maxUnits) {
        const sold = await getUnitsSold(campaignId);
        if (sold + unitCount > campaign.maxUnits) {
          const remaining = campaign.maxUnits - sold;
          throw new Error(
            `Only ${remaining} ${campaign.unitLabel || 'unit'}(s) remaining (requested ${unitCount})`
          );
        }
      }
      break;
    }
    case 'TIERED': {
      if (!tierId) {
        throw new Error('A tier must be selected for this campaign');
      }
      const tier = campaign.tiers.find(t => t.id === tierId);
      if (!tier) {
        throw new Error('Invalid tier selected');
      }
      if (Math.abs(amount - Number(tier.amount)) > 0.01) {
        throw new Error(`Donation amount must be $${Number(tier.amount).toFixed(2)} for the "${tier.name}" tier`);
      }
      if (tier.maxSlots) {
        const filled = await getTierSlotsFilled(tierId);
        if (filled >= tier.maxSlots) {
          throw new Error(`The "${tier.name}" tier is full (${tier.maxSlots} slots)`);
        }
      }
      break;
    }
    // OPEN: no constraints
  }
}

/**
 * Auto-complete a campaign if capacity is reached.
 */
export async function checkAndAutoCompleteCampaign(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { tiers: true },
  });
  if (!campaign || campaign.status !== 'ACTIVE') return;

  let shouldComplete = false;

  if (campaign.campaignType === 'FIXED_UNIT' && campaign.maxUnits) {
    const sold = await getUnitsSold(campaignId);
    shouldComplete = sold >= campaign.maxUnits;
  } else if (campaign.campaignType === 'TIERED') {
    const tiersWithCaps = campaign.tiers.filter(t => t.maxSlots != null);
    if (tiersWithCaps.length > 0 && tiersWithCaps.length === campaign.tiers.length) {
      // All tiers have caps — check if all are full
      const checks = await Promise.all(
        tiersWithCaps.map(async (t) => {
          const filled = await getTierSlotsFilled(t.id);
          return filled >= t.maxSlots!;
        })
      );
      shouldComplete = checks.every(Boolean);
    }
  }

  if (shouldComplete) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED' },
    });
  }
}
