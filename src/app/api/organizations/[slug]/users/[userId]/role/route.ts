import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { canModifyRole } from '@/lib/auth/permissions';

const updateRoleSchema = z.object({
  role: z.enum(['DONOR', 'ORG_ADMIN', 'PLATFORM_ADMIN', 'PUBLIC']),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  try {
    const { slug, userId: organizationUserId } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the current user
    const currentUser = await prisma.user.findUnique({
      where: { authId: clerkUserId },
      select: {
        id: true,
        isPlatformAdmin: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Find organization and check current user's access
    const organization = await prisma.organization.findUnique({
      where: { slug },
      include: {
        organizationUsers: {
          where: { userId: currentUser.id },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const currentUserOrgAccess = organization.organizationUsers[0];
    
    // Platform admins can modify roles, otherwise need ORG_ADMIN or higher
    const canManageRoles = currentUser.isPlatformAdmin || (currentUserOrgAccess && currentUserOrgAccess.role !== 'DONOR');
    
    if (!canManageRoles) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Find the organization user to update
    const targetOrgUser = await prisma.organizationUser.findUnique({
      where: { id: organizationUserId },
      include: { organization: true },
    });

    if (!targetOrgUser || targetOrgUser.organizationId !== organization.id) {
      return NextResponse.json(
        { error: 'User not found in organization' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { role: newRole } = updateRoleSchema.parse(body);

    // Determine current user's effective role (PLATFORM_ADMIN if isPlatformAdmin, otherwise org role)
    const effectiveRole = currentUser.isPlatformAdmin ? 'PLATFORM_ADMIN' : currentUserOrgAccess?.role;

    // Check if current user can modify this role
    if (!effectiveRole || !canModifyRole(effectiveRole, targetOrgUser.role, newRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to assign this role' },
        { status: 403 }
      );
    }

    // Update the role
    const updatedOrgUser = await prisma.organizationUser.update({
      where: { id: organizationUserId },
      data: { role: newRole },
      include: {
        user: true,
      },
    });

    return NextResponse.json(updatedOrgUser);
  } catch (error) {
    console.error('Error updating user role:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
