import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { buildCurrentVersionWhere, closeVersion, buildNewVersionData } from "@/lib/temporal/temporal-utils";

const approveSchema = z.object({
  notes: z.string().optional(),
});

/**
 * POST /api/admin/organizations/[id]/approve
 * 
 * Approve a pending organization
 * Platform admin only
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is platform admin
    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user || !user.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Platform admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { notes } = approveSchema.parse(body);

    // Find current version of the organization
    const org = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ id }),
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Update organization to VERIFIED status (temporal: close old version, create new)
    const now = new Date();
    await closeVersion(prisma.organization, org.versionId, now, "organization");
    const organization = await prisma.organization.create({
      data: buildNewVersionData(org, {
        verificationStatus: "VERIFIED",
        verifiedAt: now,
        verifiedBy: user.id,
        verificationNotes: notes,
      } as any, now, user.id) as any,
    });

    return NextResponse.json({
      message: "Organization approved successfully",
      organization,
    });
  } catch (error) {
    console.error("Error approving organization:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
