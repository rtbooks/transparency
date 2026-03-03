/**
 * Campaign Service
 * CRUD operations for fundraising campaigns and progress tracking.
 */

import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { getCampaignDonationSummary } from '@/services/donation.service';
import type { Campaign, CampaignItem } from '@/generated/prisma/client';

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
  campaignType?: 'OPEN' | 'FIXED_UNIT' | 'TIERED' | 'EVENT';
  unitPrice?: number | null;
  maxUnits?: number | null;
  unitLabel?: string | null;
  allowMultiUnit?: boolean;
  items?: CreateCampaignItemInput[];
}

export interface CreateCampaignItemInput {
  name: string;
  description?: string | null;
  category?: string | null;
  price: number;
  maxQuantity?: number | null;
  minPerOrder?: number;
  maxPerOrder?: number | null;
  isRequired?: boolean;
  sortOrder?: number;
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
  if (campaignType === 'EVENT') {
    if (!input.items || input.items.length === 0) {
      throw new Error('EVENT campaigns require at least one item');
    }
    for (const item of input.items) {
      if (!item.name || item.price <= 0) {
        throw new Error('Each campaign item must have a name and positive price');
      }
    }
  }

  // For FIXED_UNIT with maxUnits, auto-calculate targetAmount
  // For EVENT, auto-calculate from items if all have maxQuantity
  let targetAmount = input.targetAmount ?? null;
  if (campaignType === 'FIXED_UNIT' && input.unitPrice && input.maxUnits) {
    targetAmount = input.unitPrice * input.maxUnits;
  } else if (campaignType === 'EVENT' && input.items) {
    const allHaveMax = input.items.every(i => i.maxQuantity != null);
    if (allHaveMax) {
      targetAmount = input.items.reduce(
        (sum, i) => sum + i.price * (i.maxQuantity ?? 0), 0
      );
    }
  }

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
      ...(campaignType === 'EVENT' && input.items && {
        items: {
          create: input.items.map((item, idx) => ({
            name: item.name,
            description: item.description ?? null,
            category: item.category ?? null,
            price: item.price,
            maxQuantity: item.maxQuantity ?? null,
            minPerOrder: item.minPerOrder ?? 0,
            maxPerOrder: item.maxPerOrder ?? null,
            isRequired: item.isRequired ?? false,
            sortOrder: item.sortOrder ?? idx,
          })),
        },
      }),
    },
    include: campaignType === 'EVENT' ? { items: { orderBy: { sortOrder: 'asc' } } } : undefined,
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
    include: {
      tiers: { orderBy: { sortOrder: 'asc' } },
      items: { orderBy: { sortOrder: 'asc' } },
    },
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
    include: {
      tiers: { orderBy: { sortOrder: 'asc' } },
      items: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
    },
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

export interface EventLineItemInput {
  campaignItemId: string;
  quantity: number;
}

/**
 * Validate a donation against campaign constraints.
 * Throws if the donation violates any campaign rules.
 */
export async function validateDonationAgainstCampaign(
  campaignId: string,
  amount: number,
  unitCount?: number | null,
  tierId?: string | null,
  lineItems?: EventLineItemInput[]
): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { tiers: true, items: { where: { isActive: true } } },
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
    case 'EVENT': {
      if (!lineItems || lineItems.length === 0) {
        throw new Error('EVENT campaigns require selecting at least one item');
      }
      await validateEventLineItems(campaign, lineItems, amount);
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
      const checks = await Promise.all(
        tiersWithCaps.map(async (t) => {
          const filled = await getTierSlotsFilled(t.id);
          return filled >= t.maxSlots!;
        })
      );
      shouldComplete = checks.every(Boolean);
    }
  } else if (campaign.campaignType === 'EVENT') {
    const items = await prisma.campaignItem.findMany({
      where: { campaignId, isActive: true, maxQuantity: { not: null } },
    });
    if (items.length > 0) {
      const checks = await Promise.all(
        items.map(async (item) => {
          const sold = await getItemQuantitySold(item.id);
          return sold >= item.maxQuantity!;
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

/**
 * Get total quantity sold for a specific campaign item.
 */
export async function getItemQuantitySold(campaignItemId: string): Promise<number> {
  const result = await prisma.donationLineItem.aggregate({
    where: {
      campaignItemId,
      donation: { status: { notIn: ['CANCELLED'] } },
    },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

/**
 * Validate EVENT line items against campaign item constraints.
 */
async function validateEventLineItems(
  campaign: Campaign & { items: CampaignItem[] },
  lineItems: EventLineItemInput[],
  amount: number
): Promise<void> {
  const itemMap = new Map(campaign.items.map(i => [i.id, i]));

  // Check all line items reference valid active items in this campaign
  let expectedTotal = 0;
  for (const li of lineItems) {
    const item = itemMap.get(li.campaignItemId);
    if (!item) {
      throw new Error(`Campaign item not found or inactive: ${li.campaignItemId}`);
    }
    if (li.quantity < 1) {
      throw new Error(`Quantity must be at least 1 for "${item.name}"`);
    }
    if (item.maxPerOrder != null && li.quantity > item.maxPerOrder) {
      throw new Error(`Maximum ${item.maxPerOrder} of "${item.name}" per order`);
    }
    if (item.minPerOrder > 0 && li.quantity < item.minPerOrder) {
      throw new Error(`Minimum ${item.minPerOrder} of "${item.name}" per order`);
    }
    // Check total capacity
    if (item.maxQuantity != null) {
      const sold = await getItemQuantitySold(item.id);
      if (sold + li.quantity > item.maxQuantity) {
        const remaining = item.maxQuantity - sold;
        throw new Error(`Only ${remaining} of "${item.name}" remaining (requested ${li.quantity})`);
      }
    }
    expectedTotal += Number(item.price) * li.quantity;
  }

  // Check required items are present
  for (const item of campaign.items) {
    if (item.isRequired) {
      const selected = lineItems.find(li => li.campaignItemId === item.id);
      if (!selected || selected.quantity < 1) {
        throw new Error(`"${item.name}" is required`);
      }
    }
  }

  // Verify total amount matches
  if (Math.abs(amount - expectedTotal) > 0.01) {
    throw new Error(
      `Donation amount ($${amount.toFixed(2)}) does not match item total ($${expectedTotal.toFixed(2)})`
    );
  }
}

// ============================================
// CAMPAIGN ITEM CRUD
// ============================================

/**
 * Add an item to an EVENT campaign.
 */
export async function addCampaignItem(
  campaignId: string,
  input: CreateCampaignItemInput
): Promise<CampaignItem> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.campaignType !== 'EVENT') {
    throw new Error('Items can only be added to EVENT campaigns');
  }

  return await prisma.campaignItem.create({
    data: {
      campaignId,
      name: input.name,
      description: input.description ?? null,
      category: input.category ?? null,
      price: input.price,
      maxQuantity: input.maxQuantity ?? null,
      minPerOrder: input.minPerOrder ?? 0,
      maxPerOrder: input.maxPerOrder ?? null,
      isRequired: input.isRequired ?? false,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

/**
 * Update a campaign item.
 */
export async function updateCampaignItem(
  itemId: string,
  updates: Partial<CreateCampaignItemInput> & { isActive?: boolean }
): Promise<CampaignItem> {
  return await prisma.campaignItem.update({
    where: { id: itemId },
    data: {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.category !== undefined && { category: updates.category }),
      ...(updates.price !== undefined && { price: updates.price }),
      ...(updates.maxQuantity !== undefined && { maxQuantity: updates.maxQuantity }),
      ...(updates.minPerOrder !== undefined && { minPerOrder: updates.minPerOrder }),
      ...(updates.maxPerOrder !== undefined && { maxPerOrder: updates.maxPerOrder }),
      ...(updates.isRequired !== undefined && { isRequired: updates.isRequired }),
      ...(updates.sortOrder !== undefined && { sortOrder: updates.sortOrder }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
    },
  });
}

/**
 * Delete (deactivate) a campaign item. Soft-delete to preserve line item references.
 */
export async function deleteCampaignItem(itemId: string): Promise<CampaignItem> {
  return await prisma.campaignItem.update({
    where: { id: itemId },
    data: { isActive: false },
  });
}

/**
 * List items for a campaign.
 */
export async function listCampaignItems(
  campaignId: string,
  includeInactive = false
): Promise<CampaignItem[]> {
  return await prisma.campaignItem.findMany({
    where: {
      campaignId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: { sortOrder: 'asc' },
  });
}
