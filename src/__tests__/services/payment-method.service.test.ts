/**
 * Unit tests for Payment Method Service
 *
 * Tests payment method CRUD, field persistence on updates,
 * reordering, Stripe Connect lifecycle, and filtering.
 * These tests directly prevent the class of bugs where:
 *   - New fields are added to the model but not wired into update logic
 *   - enabledOnly filtering is broken
 *   - Auto-assigned display order regresses
 *   - Stripe connect/disconnect lifecycle breaks
 */

import { prisma } from '@/lib/prisma';
import type { PaymentMethod } from '@/generated/prisma/client';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    organizationPaymentMethod: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import {
  listPaymentMethods,
  getPaymentMethod,
  getPaymentMethodByType,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  reorderPaymentMethods,
  updateStripeConnectStatus,
  disconnectStripe,
} from '@/services/payment-method.service';

const mockOpm = prisma.organizationPaymentMethod as unknown as {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  upsert: jest.Mock;
  count: jest.Mock;
};

describe('Payment Method Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── listPaymentMethods ──────────────────────────────────────

  describe('listPaymentMethods', () => {
    const methods = [
      { id: 'pm-1', organizationId: 'org-1', type: 'STRIPE', isEnabled: true, displayOrder: 0 },
      { id: 'pm-2', organizationId: 'org-1', type: 'CHECK', isEnabled: false, displayOrder: 1 },
      { id: 'pm-3', organizationId: 'org-1', type: 'VENMO', isEnabled: true, displayOrder: 2 },
    ];

    it('should return all payment methods when enabledOnly is false', async () => {
      mockOpm.findMany.mockResolvedValue(methods);

      const result = await listPaymentMethods('org-1');

      expect(result).toEqual(methods);
      expect(mockOpm.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        orderBy: { displayOrder: 'asc' },
      });
    });

    it('should filter to enabled-only when enabledOnly is true', async () => {
      const enabledOnly = methods.filter((m) => m.isEnabled);
      mockOpm.findMany.mockResolvedValue(enabledOnly);

      const result = await listPaymentMethods('org-1', true);

      expect(result).toEqual(enabledOnly);
      expect(mockOpm.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', isEnabled: true },
        orderBy: { displayOrder: 'asc' },
      });
    });

    it('should return empty array when no methods exist', async () => {
      mockOpm.findMany.mockResolvedValue([]);

      const result = await listPaymentMethods('org-1');

      expect(result).toEqual([]);
    });
  });

  // ─── getPaymentMethod ────────────────────────────────────────

  describe('getPaymentMethod', () => {
    it('should return payment method by id scoped to organization', async () => {
      const method = { id: 'pm-1', organizationId: 'org-1', type: 'STRIPE' };
      mockOpm.findFirst.mockResolvedValue(method);

      const result = await getPaymentMethod('pm-1', 'org-1');

      expect(result).toEqual(method);
      expect(mockOpm.findFirst).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
      });
    });

    it('should return null when payment method not found', async () => {
      mockOpm.findFirst.mockResolvedValue(null);

      const result = await getPaymentMethod('nonexistent', 'org-1');

      expect(result).toBeNull();
    });
  });

  // ─── getPaymentMethodByType ──────────────────────────────────

  describe('getPaymentMethodByType', () => {
    it('should look up by composite unique key (organizationId + type)', async () => {
      const method = { id: 'pm-1', organizationId: 'org-1', type: 'VENMO' };
      mockOpm.findUnique.mockResolvedValue(method);

      const result = await getPaymentMethodByType('org-1', 'VENMO' as PaymentMethod);

      expect(result).toEqual(method);
      expect(mockOpm.findUnique).toHaveBeenCalledWith({
        where: { organizationId_type: { organizationId: 'org-1', type: 'VENMO' } },
      });
    });

    it('should return null when type does not exist for organization', async () => {
      mockOpm.findUnique.mockResolvedValue(null);

      const result = await getPaymentMethodByType('org-1', 'CASH' as PaymentMethod);

      expect(result).toBeNull();
    });
  });

  // ─── createPaymentMethod ─────────────────────────────────────

  describe('createPaymentMethod', () => {
    it('should auto-assign displayOrder based on existing count', async () => {
      mockOpm.count.mockResolvedValue(3);
      mockOpm.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'pm-new', ...data })
      );

      await createPaymentMethod({
        organizationId: 'org-1',
        type: 'VENMO' as PaymentMethod,
      });

      expect(mockOpm.count).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
      });
      expect(mockOpm.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ displayOrder: 3 }),
      });
    });

    it('should use provided displayOrder when given', async () => {
      mockOpm.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'pm-new', ...data })
      );

      await createPaymentMethod({
        organizationId: 'org-1',
        type: 'CHECK' as PaymentMethod,
        displayOrder: 5,
      });

      expect(mockOpm.count).not.toHaveBeenCalled();
      expect(mockOpm.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ displayOrder: 5 }),
      });
    });

    it('should default isEnabled to true when not provided', async () => {
      mockOpm.count.mockResolvedValue(0);
      mockOpm.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'pm-new', ...data })
      );

      await createPaymentMethod({
        organizationId: 'org-1',
        type: 'STRIPE' as PaymentMethod,
      });

      expect(mockOpm.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isEnabled: true }),
      });
    });

    it('should respect explicit isEnabled = false', async () => {
      mockOpm.count.mockResolvedValue(0);
      mockOpm.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'pm-new', ...data })
      );

      await createPaymentMethod({
        organizationId: 'org-1',
        type: 'STRIPE' as PaymentMethod,
        isEnabled: false,
      });

      expect(mockOpm.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isEnabled: false }),
      });
    });

    it('should pass all optional fields to create', async () => {
      mockOpm.count.mockResolvedValue(0);
      mockOpm.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'pm-new', ...data })
      );

      await createPaymentMethod({
        organizationId: 'org-1',
        type: 'CHECK' as PaymentMethod,
        label: 'Personal Check',
        instructions: 'Mail to PO Box 123',
        stripeAccountId: 'acct_123',
        handle: '@myhandle',
        payableTo: 'Acme Nonprofit',
        mailingAddress: '123 Main St',
      });

      expect(mockOpm.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          type: 'CHECK',
          label: 'Personal Check',
          instructions: 'Mail to PO Box 123',
          stripeAccountId: 'acct_123',
          handle: '@myhandle',
          payableTo: 'Acme Nonprofit',
          mailingAddress: '123 Main St',
        }),
      });
    });
  });

  // ─── updatePaymentMethod ─────────────────────────────────────

  describe('updatePaymentMethod', () => {
    beforeEach(() => {
      mockOpm.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'pm-1', organizationId: 'org-1', ...data })
      );
    });

    it('should persist isEnabled changes', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { isEnabled: false });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ isEnabled: false }),
      });
    });

    it('should persist displayOrder changes', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { displayOrder: 5 });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ displayOrder: 5 }),
      });
    });

    it('should persist label changes', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { label: 'New Label' });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ label: 'New Label' }),
      });
    });

    it('should persist label as null to clear it', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { label: null });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ label: null }),
      });
    });

    it('should persist instructions changes', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { instructions: 'Pay within 30 days' });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ instructions: 'Pay within 30 days' }),
      });
    });

    it('should persist instructions as null to clear it', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { instructions: null });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ instructions: null }),
      });
    });

    it('should persist stripeAccountId changes', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { stripeAccountId: 'acct_456' });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ stripeAccountId: 'acct_456' }),
      });
    });

    it('should persist stripeAccountId as null to clear it', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { stripeAccountId: null });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ stripeAccountId: null }),
      });
    });

    it('should persist stripeChargesEnabled changes', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { stripeChargesEnabled: true });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ stripeChargesEnabled: true }),
      });
    });

    it('should persist stripePayoutsEnabled changes', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { stripePayoutsEnabled: true });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ stripePayoutsEnabled: true }),
      });
    });

    it('should persist handle changes', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { handle: '@newhandle' });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ handle: '@newhandle' }),
      });
    });

    it('should persist handle as null to clear it', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { handle: null });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ handle: null }),
      });
    });

    it('should persist payableTo changes', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { payableTo: 'Acme Nonprofit' });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ payableTo: 'Acme Nonprofit' }),
      });
    });

    it('should persist payableTo as null to clear it', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { payableTo: null });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ payableTo: null }),
      });
    });

    it('should persist mailingAddress changes', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { mailingAddress: '456 Oak Ave' });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ mailingAddress: '456 Oak Ave' }),
      });
    });

    it('should persist mailingAddress as null to clear it', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { mailingAddress: null });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({ mailingAddress: null }),
      });
    });

    it('should persist multiple fields in a single update', async () => {
      await updatePaymentMethod('pm-1', 'org-1', {
        isEnabled: true,
        displayOrder: 2,
        label: 'Updated Label',
        instructions: 'New instructions',
        handle: '@updated',
        payableTo: 'Updated Org',
        mailingAddress: '789 Pine Blvd',
      });

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: expect.objectContaining({
          isEnabled: true,
          displayOrder: 2,
          label: 'Updated Label',
          instructions: 'New instructions',
          handle: '@updated',
          payableTo: 'Updated Org',
          mailingAddress: '789 Pine Blvd',
        }),
      });
    });

    it('should NOT include fields that were not provided', async () => {
      await updatePaymentMethod('pm-1', 'org-1', { label: 'Only this' });

      const callData = mockOpm.update.mock.calls[0][0].data;
      expect(callData).toEqual({ label: 'Only this' });
      expect(callData).not.toHaveProperty('isEnabled');
      expect(callData).not.toHaveProperty('displayOrder');
      expect(callData).not.toHaveProperty('instructions');
      expect(callData).not.toHaveProperty('stripeAccountId');
      expect(callData).not.toHaveProperty('stripeChargesEnabled');
      expect(callData).not.toHaveProperty('stripePayoutsEnabled');
      expect(callData).not.toHaveProperty('handle');
      expect(callData).not.toHaveProperty('payableTo');
      expect(callData).not.toHaveProperty('mailingAddress');
    });

    it('should send empty data object when no fields provided', async () => {
      await updatePaymentMethod('pm-1', 'org-1', {});

      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
        data: {},
      });
    });
  });

  // ─── deletePaymentMethod ─────────────────────────────────────

  describe('deletePaymentMethod', () => {
    it('should delete by id scoped to organization', async () => {
      mockOpm.delete.mockResolvedValue({ id: 'pm-1' });

      await deletePaymentMethod('pm-1', 'org-1');

      expect(mockOpm.delete).toHaveBeenCalledWith({
        where: { id: 'pm-1', organizationId: 'org-1' },
      });
    });
  });

  // ─── reorderPaymentMethods ───────────────────────────────────

  describe('reorderPaymentMethods', () => {
    it('should batch update display orders in a $transaction', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        { id: 'pm-1', displayOrder: 2 },
        { id: 'pm-2', displayOrder: 0 },
        { id: 'pm-3', displayOrder: 1 },
      ]);

      const order = [
        { id: 'pm-1', displayOrder: 2 },
        { id: 'pm-2', displayOrder: 0 },
        { id: 'pm-3', displayOrder: 1 },
      ];

      await reorderPaymentMethods('org-1', order);

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything()])
      );
    });

    it('should handle empty order array', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([]);

      await reorderPaymentMethods('org-1', []);

      expect(prisma.$transaction).toHaveBeenCalledWith([]);
    });
  });

  // ─── updateStripeConnectStatus ───────────────────────────────

  describe('updateStripeConnectStatus', () => {
    it('should upsert Stripe payment method with correct data', async () => {
      const expected = {
        id: 'pm-stripe',
        organizationId: 'org-1',
        type: 'STRIPE',
        stripeAccountId: 'acct_123',
        stripeChargesEnabled: true,
        stripePayoutsEnabled: false,
      };
      mockOpm.upsert.mockResolvedValue(expected);

      const result = await updateStripeConnectStatus('org-1', 'acct_123', true, false);

      expect(result).toEqual(expected);
      expect(mockOpm.upsert).toHaveBeenCalledWith({
        where: {
          organizationId_type: { organizationId: 'org-1', type: 'STRIPE' },
        },
        update: {
          stripeAccountId: 'acct_123',
          stripeChargesEnabled: true,
          stripePayoutsEnabled: false,
        },
        create: {
          organizationId: 'org-1',
          type: 'STRIPE',
          isEnabled: true,
          stripeAccountId: 'acct_123',
          stripeChargesEnabled: true,
          stripePayoutsEnabled: false,
          label: 'Credit / Debit Card',
        },
      });
    });

    it('should set isEnabled based on chargesEnabled in create', async () => {
      mockOpm.upsert.mockResolvedValue({});

      await updateStripeConnectStatus('org-1', 'acct_456', false, true);

      expect(mockOpm.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isEnabled: false }),
        })
      );
    });
  });

  // ─── disconnectStripe ────────────────────────────────────────

  describe('disconnectStripe', () => {
    it('should clear Stripe fields and disable the method', async () => {
      mockOpm.findUnique.mockResolvedValue({
        id: 'pm-stripe',
        organizationId: 'org-1',
        type: 'STRIPE',
      });
      mockOpm.update.mockResolvedValue({
        id: 'pm-stripe',
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        isEnabled: false,
      });

      const result = await disconnectStripe('org-1');

      expect(result).not.toBeNull();
      expect(mockOpm.update).toHaveBeenCalledWith({
        where: { id: 'pm-stripe' },
        data: {
          stripeAccountId: null,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
          isEnabled: false,
        },
      });
    });

    it('should return null when no Stripe method exists', async () => {
      mockOpm.findUnique.mockResolvedValue(null);

      const result = await disconnectStripe('org-1');

      expect(result).toBeNull();
      expect(mockOpm.update).not.toHaveBeenCalled();
    });
  });
});
