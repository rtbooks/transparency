import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { buildCurrentVersionWhere } from "@/lib/temporal/temporal-utils";
import { z } from "zod";
import {
  listPaymentMethods,
  createPaymentMethod,
} from "@/services/payment-method.service";

const createPaymentMethodSchema = z.object({
  type: z.enum([
    "STRIPE",
    "VENMO",
    "PAYPAL",
    "CHECK",
    "CASH",
    "CASH_APP",
    "ZELLE",
    "BANK_TRANSFER",
    "OTHER",
  ]),
  isEnabled: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  label: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  handle: z.string().nullable().optional(),
  paymentUrl: z.string().url().nullable().optional(),
  payableTo: z.string().nullable().optional(),
  mailingAddress: z.string().nullable().optional(),
});

/**
 * GET /api/organizations/[slug]/payment-methods
 * List payment methods. Admins see all; public/donors see enabled only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if caller is an admin
    const { userId: clerkUserId } = await auth();
    let isAdmin = false;
    if (clerkUserId) {
      const user = await prisma.user.findUnique({
        where: { authId: clerkUserId },
      });
      if (user) {
        const orgUser = await prisma.organizationUser.findFirst({
          where: buildCurrentVersionWhere({
            userId: user.id,
            organizationId: organization.id,
          }),
        });
        isAdmin =
          orgUser?.role === "ORG_ADMIN" || user.isPlatformAdmin;
      }
    }

    const methods = await listPaymentMethods(organization.id, !isAdmin);

    return NextResponse.json({ paymentMethods: methods });
  } catch (error) {
    console.error("Error listing payment methods:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/[slug]/payment-methods
 * Create a new payment method. Requires ORG_ADMIN or PLATFORM_ADMIN.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check admin role
    const orgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        userId: user.id,
        organizationId: organization.id,
      }),
    });
    if (orgUser?.role !== "ORG_ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createPaymentMethodSchema.parse(body);

    const method = await createPaymentMethod({
      organizationId: organization.id,
      ...validated,
    });

    return NextResponse.json(method, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    // Handle unique constraint violation (duplicate type)
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A payment method of this type already exists" },
        { status: 409 }
      );
    }
    console.error("Error creating payment method:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
