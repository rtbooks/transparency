import { createStripePayment, findStripePaymentBySessionId } from '@/services/stripe-payment.service';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    stripePayment: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

describe('stripe-payment.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createStripePayment', () => {
    it('should create a StripePayment record within a transaction context', async () => {
      const mockTx = {
        stripePayment: {
          create: jest.fn().mockResolvedValue({
            id: 'sp-1',
            organizationId: 'org-1',
            stripeSessionId: 'cs_test_123',
            stripePaymentId: 'pi_test_456',
            amount: 50.00,
            stripeFeeAmount: null,
            status: 'COMPLETED',
            transactionId: 'tx-1',
            donationId: 'don-1',
            billPaymentId: null,
            metadata: { donorName: 'Jane' },
            createdAt: new Date(),
          }),
        },
      };

      const result = await createStripePayment(mockTx as never, {
        organizationId: 'org-1',
        stripeSessionId: 'cs_test_123',
        stripePaymentId: 'pi_test_456',
        amount: 50.00,
        transactionId: 'tx-1',
        donationId: 'don-1',
        metadata: { donorName: 'Jane' },
      });

      expect(mockTx.stripePayment.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          stripeSessionId: 'cs_test_123',
          stripePaymentId: 'pi_test_456',
          amount: 50.00,
          stripeFeeAmount: null,
          status: 'COMPLETED',
          transactionId: 'tx-1',
          donationId: 'don-1',
          billPaymentId: null,
          metadata: { donorName: 'Jane' },
        },
      });
      expect(result.id).toBe('sp-1');
    });

    it('should handle optional fields as null', async () => {
      const mockTx = {
        stripePayment: {
          create: jest.fn().mockResolvedValue({
            id: 'sp-2',
            organizationId: 'org-1',
            stripeSessionId: 'cs_test_789',
            stripePaymentId: null,
            amount: 25.00,
            stripeFeeAmount: null,
            status: 'COMPLETED',
            transactionId: 'tx-2',
            donationId: null,
            billPaymentId: null,
            metadata: null,
            createdAt: new Date(),
          }),
        },
      };

      const result = await createStripePayment(mockTx as never, {
        organizationId: 'org-1',
        stripeSessionId: 'cs_test_789',
        amount: 25.00,
        transactionId: 'tx-2',
      });

      expect(mockTx.stripePayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stripePaymentId: null,
          donationId: null,
          billPaymentId: null,
          metadata: null,
        }),
      });
      expect(result.id).toBe('sp-2');
    });

    it('should support billPaymentId link', async () => {
      const mockTx = {
        stripePayment: {
          create: jest.fn().mockResolvedValue({
            id: 'sp-3',
            billPaymentId: 'bp-1',
          }),
        },
      };

      await createStripePayment(mockTx as never, {
        organizationId: 'org-1',
        stripeSessionId: 'cs_test_bill',
        amount: 100.00,
        transactionId: 'tx-3',
        billPaymentId: 'bp-1',
      });

      expect(mockTx.stripePayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          billPaymentId: 'bp-1',
        }),
      });
    });
  });

  describe('findStripePaymentBySessionId', () => {
    it('should return a StripePayment when found', async () => {
      const mockPayment = {
        id: 'sp-1',
        stripeSessionId: 'cs_test_123',
        status: 'COMPLETED',
      };
      (prisma.stripePayment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      const result = await findStripePaymentBySessionId('cs_test_123');

      expect(prisma.stripePayment.findUnique).toHaveBeenCalledWith({
        where: { stripeSessionId: 'cs_test_123' },
      });
      expect(result).toEqual(mockPayment);
    });

    it('should return null when not found', async () => {
      (prisma.stripePayment.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await findStripePaymentBySessionId('cs_nonexistent');

      expect(result).toBeNull();
    });
  });
});
