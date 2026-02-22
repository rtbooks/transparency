import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { buildCurrentVersionWhere } from "@/lib/temporal/temporal-utils";

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
      where: buildCurrentVersionWhere({
        verificationStatus: "PENDING_VERIFICATION",
      }),
      orderBy: {
        createdAt: "desc",
      },
    });

    // Fetch org admin users for each organization
    const orgIds = pendingOrganizations.map(org => org.id);
    const adminOrgUsers = orgIds.length > 0
      ? await prisma.organizationUser.findMany({
          where: buildCurrentVersionWhere({
            organizationId: { in: orgIds },
            role: "ORG_ADMIN",
          }),
        })
      : [];

    // Fetch user details for the admin org users
    const adminUserIds = [...new Set(adminOrgUsers.map(ou => ou.userId))];
    const adminUsers = adminUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: adminUserIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(adminUsers.map(u => [u.id, u]));

    // Enrich organizations with their admin users
    const enrichedOrganizations = pendingOrganizations.map(org => ({
      ...org,
      organizationUsers: adminOrgUsers
        .filter(ou => ou.organizationId === org.id)
        .map(ou => ({
          ...ou,
          user: userMap.get(ou.userId) || null,
        })),
    }));

    return NextResponse.json(enrichedOrganizations);
  } catch (error) {
    console.error("Error fetching pending verifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
