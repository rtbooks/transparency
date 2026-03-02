/**
 * StripePayment Service
 * Creates and queries StripePayment records — the domain model for Stripe payments.
 * Decoupled from any specific business context (donations, bills, etc.).
 */

import { prisma } from '@/lib/prisma';
import type { StripePayment, StripePaymentStatus } from '@/generated/prisma/client';

export interface CreateStripePaymentInput {
  organizationId: string;
  stripeSessionId: string;
  stripePaymentId?: string | null;
  amount: number;
  stripeFeeAmount?: number | null;
  status?: StripePaymentStatus;
  transactionId: string;
  donationId?: string | null;
  billPaymentId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Create a StripePayment record within a transaction context.
 * Must be called inside a Prisma $transaction — accepts the tx client.
 */
export async function createStripePayment(
  tx: any,
  input: CreateStripePaymentInput
): Promise<StripePayment> {
  return tx.stripePayment.create({
    data: {
      organizationId: input.organizationId,
      stripeSessionId: input.stripeSessionId,
      stripePaymentId: input.stripePaymentId ?? null,
      amount: input.amount,
      stripeFeeAmount: input.stripeFeeAmount ?? null,
      status: input.status ?? 'COMPLETED',
      transactionId: input.transactionId,
      donationId: input.donationId ?? null,
      billPaymentId: input.billPaymentId ?? null,
      metadata: input.metadata ?? null,
    },
  });
}

/**
 * Find a StripePayment by stripeSessionId (used for webhook idempotency).
 */
export async function findStripePaymentBySessionId(
  stripeSessionId: string
): Promise<StripePayment | null> {
  return prisma.stripePayment.findUnique({
    where: { stripeSessionId },
  });
}
