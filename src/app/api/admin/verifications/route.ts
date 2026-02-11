import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/verifications
 * 
 * List organizations pending verification
 * Platform admin only
 */
export async function GET() {
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

    // Fetch pending organizations
    const pendingOrganizations = await prisma.organization.findMany({
      where: {
        verificationStatus: "PENDING_VERIFICATION",
      },
      include: {
        organizationUsers: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          where: {
            role: "ORG_ADMIN",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(pendingOrganizations);
  } catch (error) {
    console.error("Error fetching pending verifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
