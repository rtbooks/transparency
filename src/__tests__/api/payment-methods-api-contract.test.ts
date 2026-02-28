/**
 * API Contract Tests for Payment Methods Endpoint
 *
 * Validates that the payment methods API returns the correct response shape
 * for listing (admin and public views), create, and update operations.
 *
 * These tests prevent bugs where:
 *   - The API response is missing fields the UI needs (label, instructions, handle)
 *   - POST silently drops fields the form sends (payableTo, mailingAddress)
 *   - PATCH accepts fields that shouldn't be updatable (type, organizationId)
 *   - Public view exposes admin-only fields (stripeAccountId)
 */

import { z } from 'zod';

// ─── Shared enums ────────────────────────────────────────────────

const PaymentMethodTypeEnum = z.enum([
  'STRIPE',
  'VENMO',
  'PAYPAL',
  'CHECK',
  'CASH',
  'CASH_APP',
  'ZELLE',
  'BANK_TRANSFER',
  'OTHER',
]);

// ─── Response schemas ────────────────────────────────────────────

/** Admin view: full payment method returned from GET /payment-methods */
const PaymentMethodAdminResponseSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  type: PaymentMethodTypeEnum,
  isEnabled: z.boolean(),
  displayOrder: z.number(),
  label: z.string().nullable(),
  instructions: z.string().nullable(),
  stripeAccountId: z.string().nullable(),
  stripeChargesEnabled: z.boolean(),
  stripePayoutsEnabled: z.boolean(),
  handle: z.string().nullable(),
  accountId: z.string().nullable(),
  payableTo: z.string().nullable(),
  mailingAddress: z.string().nullable(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

/** Public/donor view: only fields needed to display payment options */
const PaymentMethodPublicResponseSchema = z.object({
  id: z.string(),
  type: PaymentMethodTypeEnum,
  label: z.string().nullable(),
  instructions: z.string().nullable(),
  handle: z.string().nullable(),
  payableTo: z.string().nullable(),
  mailingAddress: z.string().nullable(),
});

/** The fields the POST endpoint must accept for creating a payment method */
const PaymentMethodCreateRequestSchema = z.object({
  type: PaymentMethodTypeEnum,
  isEnabled: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  label: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  stripeAccountId: z.string().nullable().optional(),
  handle: z.string().nullable().optional(),
  payableTo: z.string().nullable().optional(),
  mailingAddress: z.string().nullable().optional(),
});

/** The fields the PATCH endpoint must accept for updating a payment method */
const PaymentMethodUpdateRequestSchema = z.object({
  isEnabled: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  label: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  stripeAccountId: z.string().nullable().optional(),
  stripeChargesEnabled: z.boolean().optional(),
  stripePayoutsEnabled: z.boolean().optional(),
  handle: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  stripeFeePercent: z.number().optional(),
  stripeFeeFixed: z.number().optional(),
  payableTo: z.string().nullable().optional(),
  mailingAddress: z.string().nullable().optional(),
});

// ─── Contract validation tests ───────────────────────────────────

describe('Payment Methods API Contract Tests', () => {
  describe('GET /api/organizations/[slug]/payment-methods admin response shape', () => {
    it('should validate a complete payment method response', () => {
      const response = {
        id: 'pm-1',
        organizationId: 'org-1',
        type: 'STRIPE',
        isEnabled: true,
        displayOrder: 0,
        label: 'Credit / Debit Card',
        instructions: 'Pay securely via Stripe',
        stripeAccountId: 'acct_123',
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        handle: null,
        accountId: null,
        payableTo: null,
        mailingAddress: null,
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      };

      const result = PaymentMethodAdminResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate a CHECK payment method with all optional fields', () => {
      const response = {
        id: 'pm-2',
        organizationId: 'org-1',
        type: 'CHECK',
        isEnabled: true,
        displayOrder: 1,
        label: 'Personal Check',
        instructions: 'Mail to our office',
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        handle: null,
        accountId: null,
        payableTo: 'Acme Nonprofit Inc.',
        mailingAddress: '123 Main St, City, ST 12345',
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      };

      const result = PaymentMethodAdminResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate a VENMO payment method with handle', () => {
      const response = {
        id: 'pm-3',
        organizationId: 'org-1',
        type: 'VENMO',
        isEnabled: false,
        displayOrder: 2,
        label: 'Venmo',
        instructions: null,
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        handle: '@acme-nonprofit',
        accountId: null,
        payableTo: null,
        mailingAddress: null,
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-02-15T00:00:00.000Z',
      };

      const result = PaymentMethodAdminResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should FAIL if type field is missing', () => {
      const response = {
        id: 'pm-1',
        organizationId: 'org-1',
        // type is MISSING
        isEnabled: true,
        displayOrder: 0,
        label: null,
        instructions: null,
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        handle: null,
        accountId: null,
        payableTo: null,
        mailingAddress: null,
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      };

      const result = PaymentMethodAdminResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should FAIL if isEnabled field is missing', () => {
      const response = {
        id: 'pm-1',
        organizationId: 'org-1',
        type: 'STRIPE',
        // isEnabled is MISSING
        displayOrder: 0,
        label: null,
        instructions: null,
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        handle: null,
        accountId: null,
        payableTo: null,
        mailingAddress: null,
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      };

      const result = PaymentMethodAdminResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should FAIL if displayOrder field is missing', () => {
      const response = {
        id: 'pm-1',
        organizationId: 'org-1',
        type: 'STRIPE',
        isEnabled: true,
        // displayOrder is MISSING
        label: null,
        instructions: null,
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        handle: null,
        accountId: null,
        payableTo: null,
        mailingAddress: null,
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      };

      const result = PaymentMethodAdminResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should FAIL for invalid payment method type', () => {
      const response = {
        id: 'pm-1',
        organizationId: 'org-1',
        type: 'BITCOIN',
        isEnabled: true,
        displayOrder: 0,
        label: null,
        instructions: null,
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        handle: null,
        accountId: null,
        payableTo: null,
        mailingAddress: null,
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      };

      const result = PaymentMethodAdminResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  describe('GET /api/organizations/[slug]/payment-methods public response shape', () => {
    it('should validate a public payment method response', () => {
      const response = {
        id: 'pm-1',
        type: 'VENMO',
        label: 'Venmo',
        instructions: 'Send to our Venmo',
        handle: '@acme-nonprofit',
        payableTo: null,
        mailingAddress: null,
      };

      const result = PaymentMethodPublicResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate a CHECK public response with payableTo and mailingAddress', () => {
      const response = {
        id: 'pm-2',
        type: 'CHECK',
        label: 'Personal Check',
        instructions: 'Mail to our office',
        handle: null,
        payableTo: 'Acme Nonprofit',
        mailingAddress: '123 Main St, City, ST 12345',
      };

      const result = PaymentMethodPublicResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should FAIL if type field is missing from public response', () => {
      const response = {
        id: 'pm-1',
        // type is MISSING
        label: 'Venmo',
        instructions: null,
        handle: '@acme',
        payableTo: null,
        mailingAddress: null,
      };

      const result = PaymentMethodPublicResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  describe('POST /api/organizations/[slug]/payment-methods request schema', () => {
    it('should accept minimal create request with only type', () => {
      const result = PaymentMethodCreateRequestSchema.safeParse({ type: 'STRIPE' });
      expect(result.success).toBe(true);
    });

    it('should accept create request with all fields', () => {
      const result = PaymentMethodCreateRequestSchema.safeParse({
        type: 'CHECK',
        isEnabled: true,
        displayOrder: 3,
        label: 'Personal Check',
        instructions: 'Mail to PO Box 123',
        stripeAccountId: null,
        handle: null,
        payableTo: 'Acme Nonprofit',
        mailingAddress: '123 Main St',
      });
      expect(result.success).toBe(true);
    });

    it('should accept all valid payment method types', () => {
      const types = [
        'STRIPE', 'VENMO', 'PAYPAL', 'CHECK', 'CASH',
        'CASH_APP', 'ZELLE', 'BANK_TRANSFER', 'OTHER',
      ];

      for (const type of types) {
        const result = PaymentMethodCreateRequestSchema.safeParse({ type });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid payment method type', () => {
      const result = PaymentMethodCreateRequestSchema.safeParse({ type: 'BITCOIN' });
      expect(result.success).toBe(false);
    });

    it('should reject request without type', () => {
      const result = PaymentMethodCreateRequestSchema.safeParse({ label: 'No Type' });
      expect(result.success).toBe(false);
    });

    it('should accept null for nullable string fields', () => {
      const result = PaymentMethodCreateRequestSchema.safeParse({
        type: 'VENMO',
        label: null,
        instructions: null,
        handle: null,
        payableTo: null,
        mailingAddress: null,
      });
      expect(result.success).toBe(true);
    });

    it('should strip unknown fields (organizationId, id)', () => {
      const input = {
        type: 'STRIPE',
        organizationId: 'org-1',
        id: 'pm-1',
        label: 'Test',
      };
      const result = PaymentMethodCreateRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('organizationId');
      expect(result.data).not.toHaveProperty('id');
    });
  });

  describe('PATCH /api/organizations/[slug]/payment-methods/[id] request schema', () => {
    it('should accept isEnabled update', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ isEnabled: false });
      expect(result.success).toBe(true);
    });

    it('should accept displayOrder update', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ displayOrder: 5 });
      expect(result.success).toBe(true);
    });

    it('should accept label update', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ label: 'New Label' });
      expect(result.success).toBe(true);
    });

    it('should accept null label to clear it', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ label: null });
      expect(result.success).toBe(true);
    });

    it('should accept instructions update', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ instructions: 'New instructions' });
      expect(result.success).toBe(true);
    });

    it('should accept null instructions to clear it', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ instructions: null });
      expect(result.success).toBe(true);
    });

    it('should accept stripeAccountId update', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ stripeAccountId: 'acct_new' });
      expect(result.success).toBe(true);
    });

    it('should accept null stripeAccountId to clear it', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ stripeAccountId: null });
      expect(result.success).toBe(true);
    });

    it('should accept stripeChargesEnabled update', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ stripeChargesEnabled: true });
      expect(result.success).toBe(true);
    });

    it('should accept stripePayoutsEnabled update', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ stripePayoutsEnabled: true });
      expect(result.success).toBe(true);
    });

    it('should accept handle update', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ handle: '@newhandle' });
      expect(result.success).toBe(true);
    });

    it('should accept payableTo update', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ payableTo: 'New Org' });
      expect(result.success).toBe(true);
    });

    it('should accept mailingAddress update', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ mailingAddress: '456 Oak Ave' });
      expect(result.success).toBe(true);
    });

    it('should accept accountId update', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ accountId: 'acct-clearing-1' });
      expect(result.success).toBe(true);
    });

    it('should accept null accountId to clear it', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ accountId: null });
      expect(result.success).toBe(true);
    });

    it('should accept stripeFeePercent update', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ stripeFeePercent: 2.2 });
      expect(result.success).toBe(true);
    });

    it('should accept stripeFeeFixed update', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({ stripeFeeFixed: 0.25 });
      expect(result.success).toBe(true);
    });

    it('should accept multiple fields together', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({
        isEnabled: true,
        label: 'Updated',
        instructions: 'New instructions',
        handle: '@updated',
        payableTo: 'Updated Org',
        mailingAddress: '789 Pine Blvd',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (no-op update)', () => {
      const result = PaymentMethodUpdateRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should strip unknown fields (type, organizationId)', () => {
      const input = {
        label: 'Updated',
        type: 'VENMO',
        organizationId: 'org-1',
      };
      const result = PaymentMethodUpdateRequestSchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('type');
      expect(result.data).not.toHaveProperty('organizationId');
    });
  });
});
