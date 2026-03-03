/**
 * Campaign Constraint Tests
 *
 * Tests for campaign type constraints (FIXED_UNIT, TIERED, OPEN):
 *   - Amount enforcement (donation must match unit price × count)
 *   - Capacity limits (maxUnits, tier maxSlots)
 *   - Tier validation
 *   - Auto-completion when capacity reached
 */

import { prisma } from '@/lib/prisma';

// Mock prisma before imports
jest.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    donation: {
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    donationLineItem: {
      aggregate: jest.fn(),
    },
    campaignItem: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/temporal/temporal-utils', () => ({
  buildCurrentVersionWhere: jest.fn((where: any) => where),
  MAX_DATE: new Date('9999-12-31'),
}));

import {
  validateDonationAgainstCampaign,
  checkAndAutoCompleteCampaign,
  getUnitsSold,
  getTierSlotsFilled,
  getItemQuantitySold,
} from '@/services/campaign.service';

describe('Campaign Constraints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── validateDonationAgainstCampaign ─────────────────────────────────

  describe('validateDonationAgainstCampaign', () => {
    describe('OPEN campaigns', () => {
      it('should accept any amount for OPEN campaigns', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
          id: 'camp-1',
          campaignType: 'OPEN',
          status: 'ACTIVE',
          tiers: [],
        });

        await expect(
          validateDonationAgainstCampaign('camp-1', 999.99)
        ).resolves.toBeUndefined();
      });

      it('should reject donations to non-ACTIVE campaigns', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
          id: 'camp-1',
          campaignType: 'OPEN',
          status: 'COMPLETED',
          tiers: [],
        });

        await expect(
          validateDonationAgainstCampaign('camp-1', 100)
        ).rejects.toThrow('Campaign is not accepting donations');
      });

      it('should reject donations to nonexistent campaigns', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(
          validateDonationAgainstCampaign('nonexistent', 100)
        ).rejects.toThrow('Campaign not found');
      });
    });

    describe('FIXED_UNIT campaigns', () => {
      const fixedUnitCampaign = {
        id: 'camp-squares',
        campaignType: 'FIXED_UNIT',
        status: 'ACTIVE',
        unitPrice: 25,
        maxUnits: 100,
        unitLabel: 'square',
        allowMultiUnit: true,
        tiers: [],
      };

      it('should accept valid donation (amount = unitPrice × unitCount)', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(fixedUnitCampaign);
        (prisma.donation.aggregate as jest.Mock).mockResolvedValue({ _sum: { unitCount: 50 } });

        await expect(
          validateDonationAgainstCampaign('camp-squares', 75, 3)
        ).resolves.toBeUndefined();
      });

      it('should reject donation with wrong amount', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(fixedUnitCampaign);

        await expect(
          validateDonationAgainstCampaign('camp-squares', 30, 1)
        ).rejects.toThrow('Donation amount must be $25.00 (1 × $25.00)');
      });

      it('should reject donation without unitCount', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(fixedUnitCampaign);

        await expect(
          validateDonationAgainstCampaign('camp-squares', 25)
        ).rejects.toThrow('requires selecting at least 1 square');
      });

      it('should reject when capacity exceeded', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(fixedUnitCampaign);
        (prisma.donation.aggregate as jest.Mock).mockResolvedValue({ _sum: { unitCount: 98 } });

        await expect(
          validateDonationAgainstCampaign('camp-squares', 75, 3)
        ).rejects.toThrow('Only 2 square(s) remaining (requested 3)');
      });

      it('should reject multi-unit when allowMultiUnit is false', async () => {
        const singleUnitCampaign = { ...fixedUnitCampaign, allowMultiUnit: false };
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(singleUnitCampaign);

        await expect(
          validateDonationAgainstCampaign('camp-squares', 50, 2)
        ).rejects.toThrow('only allows 1 square per donation');
      });

      it('should accept last available unit', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(fixedUnitCampaign);
        (prisma.donation.aggregate as jest.Mock).mockResolvedValue({ _sum: { unitCount: 99 } });

        await expect(
          validateDonationAgainstCampaign('camp-squares', 25, 1)
        ).resolves.toBeUndefined();
      });
    });

    describe('TIERED campaigns', () => {
      const tieredCampaign = {
        id: 'camp-sponsor',
        campaignType: 'TIERED',
        status: 'ACTIVE',
        tiers: [
          { id: 'tier-gold', name: 'Gold', amount: 500, maxSlots: 5 },
          { id: 'tier-silver', name: 'Silver', amount: 250, maxSlots: 10 },
          { id: 'tier-bronze', name: 'Bronze', amount: 100, maxSlots: null },
        ],
      };

      it('should accept valid tier donation', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(tieredCampaign);
        (prisma.donation.count as jest.Mock).mockResolvedValue(2);

        await expect(
          validateDonationAgainstCampaign('camp-sponsor', 500, null, 'tier-gold')
        ).resolves.toBeUndefined();
      });

      it('should reject without tierId', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(tieredCampaign);

        await expect(
          validateDonationAgainstCampaign('camp-sponsor', 500)
        ).rejects.toThrow('A tier must be selected');
      });

      it('should reject wrong amount for tier', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(tieredCampaign);

        await expect(
          validateDonationAgainstCampaign('camp-sponsor', 300, null, 'tier-gold')
        ).rejects.toThrow('Donation amount must be $500.00 for the "Gold" tier');
      });

      it('should reject invalid tierId', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(tieredCampaign);

        await expect(
          validateDonationAgainstCampaign('camp-sponsor', 100, null, 'tier-nonexistent')
        ).rejects.toThrow('Invalid tier selected');
      });

      it('should reject when tier is full', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(tieredCampaign);
        (prisma.donation.count as jest.Mock).mockResolvedValue(5); // gold has maxSlots: 5

        await expect(
          validateDonationAgainstCampaign('camp-sponsor', 500, null, 'tier-gold')
        ).rejects.toThrow('The "Gold" tier is full (5 slots)');
      });

      it('should accept unlimited tier (no maxSlots)', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(tieredCampaign);
        (prisma.donation.count as jest.Mock).mockResolvedValue(0);

        await expect(
          validateDonationAgainstCampaign('camp-sponsor', 100, null, 'tier-bronze')
        ).resolves.toBeUndefined();
      });
    });

    describe('EVENT campaigns', () => {
      const eventCampaign = {
        id: 'camp-dinner',
        campaignType: 'EVENT',
        status: 'ACTIVE',
        tiers: [],
        items: [
          { id: 'item-adult', name: 'Adult Plate', price: 35, maxQuantity: 100, minPerOrder: 0, maxPerOrder: 10, isRequired: false, isActive: true },
          { id: 'item-child', name: 'Child Plate', price: 20, maxQuantity: 50, minPerOrder: 0, maxPerOrder: 5, isRequired: false, isActive: true },
          { id: 'item-gift', name: 'Gift', price: 30, maxQuantity: null, minPerOrder: 0, maxPerOrder: null, isRequired: true, isActive: true },
        ],
      };

      it('should accept valid EVENT donation with line items', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(eventCampaign);
        (prisma.donationLineItem.aggregate as jest.Mock).mockResolvedValue({ _sum: { quantity: 0 } });

        await expect(
          validateDonationAgainstCampaign('camp-dinner', 100, null, null, [
            { campaignItemId: 'item-adult', quantity: 2 }, // 2×35 = 70
            { campaignItemId: 'item-gift', quantity: 1 },  // 1×30 = 30
          ])
        ).resolves.toBeUndefined();
      });

      it('should reject EVENT donation without line items', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(eventCampaign);

        await expect(
          validateDonationAgainstCampaign('camp-dinner', 100)
        ).rejects.toThrow('require selecting at least one item');
      });

      it('should reject EVENT donation with empty line items', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(eventCampaign);

        await expect(
          validateDonationAgainstCampaign('camp-dinner', 100, null, null, [])
        ).rejects.toThrow('require selecting at least one item');
      });

      it('should reject when required item is missing', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(eventCampaign);
        (prisma.donationLineItem.aggregate as jest.Mock).mockResolvedValue({ _sum: { quantity: 0 } });

        await expect(
          validateDonationAgainstCampaign('camp-dinner', 35, null, null, [
            { campaignItemId: 'item-adult', quantity: 1 },
          ])
        ).rejects.toThrow('"Gift" is required');
      });

      it('should reject when amount does not match item total', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(eventCampaign);
        (prisma.donationLineItem.aggregate as jest.Mock).mockResolvedValue({ _sum: { quantity: 0 } });

        await expect(
          validateDonationAgainstCampaign('camp-dinner', 50, null, null, [
            { campaignItemId: 'item-adult', quantity: 1 },
            { campaignItemId: 'item-gift', quantity: 1 },
          ])
        ).rejects.toThrow('does not match item total ($65.00)');
      });

      it('should reject when exceeding maxPerOrder', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(eventCampaign);
        (prisma.donationLineItem.aggregate as jest.Mock).mockResolvedValue({ _sum: { quantity: 0 } });

        await expect(
          validateDonationAgainstCampaign('camp-dinner', 385, null, null, [
            { campaignItemId: 'item-adult', quantity: 11 }, // max is 10
            { campaignItemId: 'item-gift', quantity: 1 },
          ])
        ).rejects.toThrow('Maximum 10 of "Adult Plate" per order');
      });

      it('should reject when capacity exceeded', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(eventCampaign);
        // Adult plate: 98 sold, trying to buy 5 more
        (prisma.donationLineItem.aggregate as jest.Mock)
          .mockResolvedValueOnce({ _sum: { quantity: 98 } });

        await expect(
          validateDonationAgainstCampaign('camp-dinner', 205, null, null, [
            { campaignItemId: 'item-adult', quantity: 5 },
            { campaignItemId: 'item-gift', quantity: 1 },
          ])
        ).rejects.toThrow('Only 2 of "Adult Plate" remaining (requested 5)');
      });

      it('should reject invalid campaign item ID', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(eventCampaign);

        await expect(
          validateDonationAgainstCampaign('camp-dinner', 30, null, null, [
            { campaignItemId: 'item-nonexistent', quantity: 1 },
          ])
        ).rejects.toThrow('Campaign item not found or inactive');
      });

      it('should reject quantity less than 1', async () => {
        (prisma.campaign.findUnique as jest.Mock).mockResolvedValue(eventCampaign);

        await expect(
          validateDonationAgainstCampaign('camp-dinner', 0, null, null, [
            { campaignItemId: 'item-adult', quantity: 0 },
          ])
        ).rejects.toThrow('Quantity must be at least 1');
      });
    });
  });

  // ── getUnitsSold ────────────────────────────────────────────────────

  describe('getUnitsSold', () => {
    it('should sum unitCount for non-cancelled donations', async () => {
      (prisma.donation.aggregate as jest.Mock).mockResolvedValue({
        _sum: { unitCount: 42 },
      });

      const result = await getUnitsSold('camp-1');

      expect(result).toBe(42);
      expect(prisma.donation.aggregate).toHaveBeenCalledWith({
        where: {
          campaignId: 'camp-1',
          status: { notIn: ['CANCELLED'] },
          unitCount: { not: null },
        },
        _sum: { unitCount: true },
      });
    });

    it('should return 0 when no donations', async () => {
      (prisma.donation.aggregate as jest.Mock).mockResolvedValue({
        _sum: { unitCount: null },
      });

      expect(await getUnitsSold('camp-empty')).toBe(0);
    });
  });

  // ── getTierSlotsFilled ──────────────────────────────────────────────

  describe('getTierSlotsFilled', () => {
    it('should count non-cancelled donations for tier', async () => {
      (prisma.donation.count as jest.Mock).mockResolvedValue(3);

      const result = await getTierSlotsFilled('tier-gold');

      expect(result).toBe(3);
      expect(prisma.donation.count).toHaveBeenCalledWith({
        where: {
          tierId: 'tier-gold',
          status: { notIn: ['CANCELLED'] },
        },
      });
    });
  });

  // ── getItemQuantitySold ───────────────────────────────────────────────

  describe('getItemQuantitySold', () => {
    it('should sum quantity for non-cancelled donations', async () => {
      (prisma.donationLineItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: 15 },
      });

      const result = await getItemQuantitySold('item-adult');

      expect(result).toBe(15);
      expect(prisma.donationLineItem.aggregate).toHaveBeenCalledWith({
        where: {
          campaignItemId: 'item-adult',
          donation: { status: { notIn: ['CANCELLED'] } },
        },
        _sum: { quantity: true },
      });
    });

    it('should return 0 when no line items', async () => {
      (prisma.donationLineItem.aggregate as jest.Mock).mockResolvedValue({
        _sum: { quantity: null },
      });

      expect(await getItemQuantitySold('item-empty')).toBe(0);
    });
  });

  // ── checkAndAutoCompleteCampaign ────────────────────────────────────

  describe('checkAndAutoCompleteCampaign', () => {
    it('should auto-complete FIXED_UNIT campaign when all units sold', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'camp-squares',
        campaignType: 'FIXED_UNIT',
        status: 'ACTIVE',
        maxUnits: 100,
        tiers: [],
      });
      (prisma.donation.aggregate as jest.Mock).mockResolvedValue({
        _sum: { unitCount: 100 },
      });

      await checkAndAutoCompleteCampaign('camp-squares');

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'camp-squares' },
        data: { status: 'COMPLETED' },
      });
    });

    it('should NOT auto-complete FIXED_UNIT when units remaining', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'camp-squares',
        campaignType: 'FIXED_UNIT',
        status: 'ACTIVE',
        maxUnits: 100,
        tiers: [],
      });
      (prisma.donation.aggregate as jest.Mock).mockResolvedValue({
        _sum: { unitCount: 95 },
      });

      await checkAndAutoCompleteCampaign('camp-squares');

      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it('should auto-complete TIERED campaign when all tiers full', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'camp-sponsor',
        campaignType: 'TIERED',
        status: 'ACTIVE',
        tiers: [
          { id: 'tier-gold', maxSlots: 5 },
          { id: 'tier-silver', maxSlots: 10 },
        ],
      });
      // Gold: 5/5, Silver: 10/10
      (prisma.donation.count as jest.Mock)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(10);

      await checkAndAutoCompleteCampaign('camp-sponsor');

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'camp-sponsor' },
        data: { status: 'COMPLETED' },
      });
    });

    it('should NOT auto-complete TIERED when some tiers have no cap', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'camp-sponsor',
        campaignType: 'TIERED',
        status: 'ACTIVE',
        tiers: [
          { id: 'tier-gold', maxSlots: 5 },
          { id: 'tier-bronze', maxSlots: null }, // unlimited
        ],
      });
      (prisma.donation.count as jest.Mock).mockResolvedValue(5);

      await checkAndAutoCompleteCampaign('camp-sponsor');

      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it('should not change already-completed campaigns', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'camp-done',
        campaignType: 'FIXED_UNIT',
        status: 'COMPLETED',
        maxUnits: 10,
        tiers: [],
      });

      await checkAndAutoCompleteCampaign('camp-done');

      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it('should auto-complete EVENT campaign when all capped items are sold out', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'camp-dinner',
        campaignType: 'EVENT',
        status: 'ACTIVE',
        tiers: [],
      });
      (prisma.campaignItem.findMany as jest.Mock).mockResolvedValue([
        { id: 'item-adult', maxQuantity: 100 },
        { id: 'item-child', maxQuantity: 50 },
      ]);
      // Both at capacity
      (prisma.donationLineItem.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { quantity: 100 } })
        .mockResolvedValueOnce({ _sum: { quantity: 50 } });

      await checkAndAutoCompleteCampaign('camp-dinner');

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: 'camp-dinner' },
        data: { status: 'COMPLETED' },
      });
    });

    it('should NOT auto-complete EVENT when some items still have capacity', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'camp-dinner',
        campaignType: 'EVENT',
        status: 'ACTIVE',
        tiers: [],
      });
      (prisma.campaignItem.findMany as jest.Mock).mockResolvedValue([
        { id: 'item-adult', maxQuantity: 100 },
        { id: 'item-child', maxQuantity: 50 },
      ]);
      (prisma.donationLineItem.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { quantity: 100 } })
        .mockResolvedValueOnce({ _sum: { quantity: 30 } }); // still 20 remaining

      await checkAndAutoCompleteCampaign('camp-dinner');

      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it('should NOT auto-complete EVENT when no items have capacity limits', async () => {
      (prisma.campaign.findUnique as jest.Mock).mockResolvedValue({
        id: 'camp-dinner',
        campaignType: 'EVENT',
        status: 'ACTIVE',
        tiers: [],
      });
      (prisma.campaignItem.findMany as jest.Mock).mockResolvedValue([]);

      await checkAndAutoCompleteCampaign('camp-dinner');

      expect(prisma.campaign.update).not.toHaveBeenCalled();
    });
  });
});

// ── API Contract Tests ────────────────────────────────────────────────

describe('Campaign API Contract', () => {
  const { z } = require('zod');

  const CampaignResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    targetAmount: z.number().nullable(),
    campaignType: z.string(),
    unitPrice: z.number().nullable(),
    maxUnits: z.number().nullable(),
    unitLabel: z.string().nullable(),
    allowMultiUnit: z.boolean(),
    status: z.string(),
    amountRaised: z.number().optional(),
    unitsSold: z.number().optional(),
    unitsRemaining: z.number().nullable().optional(),
    tiers: z.array(z.object({
      id: z.string(),
      name: z.string(),
      amount: z.number(),
      maxSlots: z.number().nullable(),
    })).optional(),
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
      category: z.string().nullable().optional(),
      maxQuantity: z.number().nullable().optional(),
      isRequired: z.boolean().optional(),
    })).optional(),
  });

  it('should validate OPEN campaign response', () => {
    const response = {
      id: 'camp-1',
      name: 'Annual Fund',
      description: null,
      targetAmount: 10000,
      campaignType: 'OPEN',
      unitPrice: null,
      maxUnits: null,
      unitLabel: null,
      allowMultiUnit: true,
      status: 'ACTIVE',
      amountRaised: 5000,
      tiers: [],
    };
    expect(CampaignResponseSchema.safeParse(response).success).toBe(true);
  });

  it('should validate FIXED_UNIT campaign response', () => {
    const response = {
      id: 'camp-2',
      name: 'Super Bowl Squares',
      description: '$25 per square',
      targetAmount: 2500,
      campaignType: 'FIXED_UNIT',
      unitPrice: 25,
      maxUnits: 100,
      unitLabel: 'square',
      allowMultiUnit: true,
      status: 'ACTIVE',
      amountRaised: 625,
      unitsSold: 25,
      unitsRemaining: 75,
      tiers: [],
    };
    expect(CampaignResponseSchema.safeParse(response).success).toBe(true);
  });

  it('should validate TIERED campaign response', () => {
    const response = {
      id: 'camp-3',
      name: 'Sponsorship Drive',
      description: null,
      targetAmount: null,
      campaignType: 'TIERED',
      unitPrice: null,
      maxUnits: null,
      unitLabel: null,
      allowMultiUnit: true,
      status: 'ACTIVE',
      amountRaised: 1500,
      tiers: [
        { id: 'tier-1', name: 'Gold', amount: 500, maxSlots: 5 },
        { id: 'tier-2', name: 'Silver', amount: 250, maxSlots: null },
      ],
    };
    expect(CampaignResponseSchema.safeParse(response).success).toBe(true);
  });

  it('should validate EVENT campaign response', () => {
    const response = {
      id: 'camp-4',
      name: 'Dinner Event',
      description: 'Annual fundraising dinner',
      targetAmount: 5000,
      campaignType: 'EVENT',
      unitPrice: null,
      maxUnits: null,
      unitLabel: null,
      allowMultiUnit: true,
      status: 'ACTIVE',
      amountRaised: 1200,
      tiers: [],
      items: [
        { id: 'item-1', name: 'Adult Plate', price: 35, category: 'Plates', maxQuantity: 100, isRequired: false },
        { id: 'item-2', name: 'Gift', price: 30, category: 'Extras', maxQuantity: null, isRequired: true },
      ],
    };
    expect(CampaignResponseSchema.safeParse(response).success).toBe(true);
  });

  it('should validate donation creation schema accepts lineItems', () => {
    const CreateDonationSchema = z.object({
      type: z.enum(['ONE_TIME', 'PLEDGE']),
      amount: z.number().positive(),
      description: z.string().optional(),
      campaignId: z.string().uuid().nullable().optional(),
      unitCount: z.number().int().positive().nullable().optional(),
      tierId: z.string().uuid().nullable().optional(),
      lineItems: z.array(z.object({
        campaignItemId: z.string(),
        quantity: z.number().int().positive(),
      })).optional(),
    });

    expect(CreateDonationSchema.safeParse({
      type: 'PLEDGE',
      amount: 75,
      description: '3 squares',
      campaignId: '550e8400-e29b-41d4-a716-446655440000',
      unitCount: 3,
    }).success).toBe(true);

    expect(CreateDonationSchema.safeParse({
      type: 'PLEDGE',
      amount: 500,
      campaignId: '550e8400-e29b-41d4-a716-446655440000',
      tierId: '660e8400-e29b-41d4-a716-446655440000',
    }).success).toBe(true);

    // Without description should also work
    expect(CreateDonationSchema.safeParse({
      type: 'PLEDGE',
      amount: 100,
    }).success).toBe(true);

    // EVENT with lineItems
    expect(CreateDonationSchema.safeParse({
      type: 'PLEDGE',
      amount: 100,
      campaignId: '550e8400-e29b-41d4-a716-446655440000',
      lineItems: [
        { campaignItemId: 'item-1', quantity: 2 },
        { campaignItemId: 'item-2', quantity: 1 },
      ],
    }).success).toBe(true);
  });
});
