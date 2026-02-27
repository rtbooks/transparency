import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { buildCurrentVersionWhere } from "@/lib/temporal/temporal-utils";
import { z } from "zod";
import {
  getPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from "@/services/payment-method.service";

const updatePaymentMethodSchema = z.object({
  isEnabled: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  label: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  handle: z.string().nullable().optional(),
  payableTo: z.string().nullable().optional(),
  mailingAddress: z.string().nullable().optional(),
});

/**
 * Shared auth check: resolves org and verifies admin role.
 */
async function resolveOrgAndCheckAdmin(slug: string) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { error: "Unauthorized", status: 401 };

  const user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
  });
  if (!user) return { error: "User not found", status: 404 };

  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
  });
  if (!organization) return { error: "Organization not found", status: 404 };

  const orgUser = await prisma.organizationUser.findFirst({
    where: buildCurrentVersionWhere({
      userId: user.id,
      organizationId: organization.id,
    }),
  });
  if (orgUser?.role !== "ORG_ADMIN" && !user.isPlatformAdmin) {
    return { error: "Forbidden", status: 403 };
  }

  return { organization };
}

/**
 * GET /api/organizations/[slug]/payment-methods/[id]
 * Get a single payment method. Requires admin.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const result = await resolveOrgAndCheckAdmin(slug);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const method = await getPaymentMethod(id, result.organization.id);
    if (!method) {
      return NextResponse.json(
        { error: "Payment method not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(method);
  } catch (error) {
    console.error("Error getting payment method:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organizations/[slug]/payment-methods/[id]
 * Update a payment method. Requires admin.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const result = await resolveOrgAndCheckAdmin(slug);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const body = await request.json();
    const validated = updatePaymentMethodSchema.parse(body);

    const method = await updatePaymentMethod(
      id,
      result.organization.id,
      validated
    );

    return NextResponse.json(method);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating payment method:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/organizations/[slug]/payment-methods/[id]
 * Delete a payment method. Requires admin.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const result = await resolveOrgAndCheckAdmin(slug);
    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    await deletePaymentMethod(id, result.organization.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting payment method:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
