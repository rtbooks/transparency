import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const approveSchema = z.object({
  notes: z.string().optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
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
    const path = request.url.split('/').pop();

    if (path === 'approve') {
      const { notes } = approveSchema.parse(body);

      // Update organization to VERIFIED status
      const organization = await prisma.organization.update({
        where: { id },
        data: {
          verificationStatus: "VERIFIED",
          verifiedAt: new Date(),
          verifiedBy: user.id,
          verificationNotes: notes,
        },
      });

      return NextResponse.json({
        message: "Organization approved successfully",
        organization,
      });
    } else if (path === 'reject') {
      const { reason } = rejectSchema.parse(body);

      // Update organization to VERIFICATION_FAILED status
      const organization = await prisma.organization.update({
        where: { id },
        data: {
          verificationStatus: "VERIFICATION_FAILED",
          verificationNotes: reason,
        },
      });

      // TODO: Send rejection email to organization admin

      return NextResponse.json({
        message: "Organization rejected",
        organization,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing verification:", error);

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
