import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@/generated/prisma/client";

// --- Input Types ---

export interface CreatePaymentMethodInput {
  organizationId: string;
  type: PaymentMethod;
  isEnabled?: boolean;
  displayOrder?: number;
  label?: string | null;
  instructions?: string | null;
  stripeAccountId?: string | null;
  handle?: string | null;
  accountId?: string | null;
  payableTo?: string | null;
  mailingAddress?: string | null;
}

export interface UpdatePaymentMethodInput {
  isEnabled?: boolean;
  displayOrder?: number;
  label?: string | null;
  instructions?: string | null;
  stripeAccountId?: string | null;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  stripeFeePercent?: number;
  stripeFeeFixed?: number;
  handle?: string | null;
  accountId?: string | null;
  payableTo?: string | null;
  mailingAddress?: string | null;
}

// --- Service Functions ---

/**
 * List payment methods for an organization.
 * If enabledOnly is true, only returns enabled methods (for public/donor views).
 */
export async function listPaymentMethods(
  organizationId: string,
  enabledOnly = false
) {
  return prisma.organizationPaymentMethod.findMany({
    where: {
      organizationId,
      ...(enabledOnly ? { isEnabled: true } : {}),
    },
    orderBy: { displayOrder: "asc" },
  });
}

/**
 * Get a single payment method by ID, scoped to an organization.
 */
export async function getPaymentMethod(id: string, organizationId: string) {
  return prisma.organizationPaymentMethod.findFirst({
    where: { id, organizationId },
  });
}

/**
 * Get a payment method by type for an organization.
 */
export async function getPaymentMethodByType(
  organizationId: string,
  type: PaymentMethod
) {
  return prisma.organizationPaymentMethod.findUnique({
    where: {
      organizationId_type: { organizationId, type },
    },
  });
}

/**
 * Create a new payment method for an organization.
 * Only one method per type is allowed (enforced by unique constraint).
 */
export async function createPaymentMethod(input: CreatePaymentMethodInput) {
  // Auto-assign display order if not provided
  if (input.displayOrder === undefined) {
    const count = await prisma.organizationPaymentMethod.count({
      where: { organizationId: input.organizationId },
    });
    input.displayOrder = count;
  }

  return prisma.organizationPaymentMethod.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      isEnabled: input.isEnabled ?? true,
      displayOrder: input.displayOrder,
      label: input.label,
      instructions: input.instructions,
      stripeAccountId: input.stripeAccountId,
      handle: input.handle,
      accountId: input.accountId,
      payableTo: input.payableTo,
      mailingAddress: input.mailingAddress,
    },
  });
}

/**
 * Update an existing payment method.
 */
export async function updatePaymentMethod(
  id: string,
  organizationId: string,
  input: UpdatePaymentMethodInput
) {
  // Build update data with only provided fields
  const data: Record<string, unknown> = {};
  if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;
  if (input.displayOrder !== undefined) data.displayOrder = input.displayOrder;
  if (input.label !== undefined) data.label = input.label;
  if (input.instructions !== undefined) data.instructions = input.instructions;
  if (input.stripeAccountId !== undefined)
    data.stripeAccountId = input.stripeAccountId;
  if (input.stripeChargesEnabled !== undefined)
    data.stripeChargesEnabled = input.stripeChargesEnabled;
  if (input.stripePayoutsEnabled !== undefined)
    data.stripePayoutsEnabled = input.stripePayoutsEnabled;
  if (input.stripeFeePercent !== undefined)
    data.stripeFeePercent = input.stripeFeePercent;
  if (input.stripeFeeFixed !== undefined)
    data.stripeFeeFixed = input.stripeFeeFixed;
  if (input.handle !== undefined) data.handle = input.handle;
  if (input.accountId !== undefined) data.accountId = input.accountId;
  if (input.payableTo !== undefined) data.payableTo = input.payableTo;
  if (input.mailingAddress !== undefined)
    data.mailingAddress = input.mailingAddress;

  return prisma.organizationPaymentMethod.update({
    where: { id, organizationId },
    data,
  });
}

/**
 * Delete a payment method.
 */
export async function deletePaymentMethod(id: string, organizationId: string) {
  return prisma.organizationPaymentMethod.delete({
    where: { id, organizationId },
  });
}

/**
 * Reorder payment methods for an organization.
 * Accepts an array of { id, displayOrder } pairs.
 */
export async function reorderPaymentMethods(
  organizationId: string,
  order: Array<{ id: string; displayOrder: number }>
) {
  return prisma.$transaction(
    order.map(({ id, displayOrder }) =>
      prisma.organizationPaymentMethod.update({
        where: { id, organizationId },
        data: { displayOrder },
      })
    )
  );
}

/**
 * Update Stripe Connect status for an organization's Stripe payment method.
 * Called after OAuth callback or account status check.
 */
export async function updateStripeConnectStatus(
  organizationId: string,
  stripeAccountId: string,
  chargesEnabled: boolean,
  payoutsEnabled: boolean
) {
  return prisma.organizationPaymentMethod.upsert({
    where: {
      organizationId_type: { organizationId, type: "STRIPE" },
    },
    update: {
      stripeAccountId,
      stripeChargesEnabled: chargesEnabled,
      stripePayoutsEnabled: payoutsEnabled,
    },
    create: {
      organizationId,
      type: "STRIPE",
      isEnabled: chargesEnabled,
      stripeAccountId,
      stripeChargesEnabled: chargesEnabled,
      stripePayoutsEnabled: payoutsEnabled,
      label: "Credit / Debit Card",
    },
  });
}

/**
 * Disconnect Stripe Connect for an organization.
 */
export async function disconnectStripe(organizationId: string) {
  const method = await getPaymentMethodByType(organizationId, "STRIPE");
  if (!method) return null;

  return prisma.organizationPaymentMethod.update({
    where: { id: method.id },
    data: {
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      isEnabled: false,
    },
  });
}
