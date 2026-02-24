import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { canModifyRole } from '@/lib/auth/permissions';
import { OrganizationUserService } from '@/services/organization-user.service';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

const updateRoleSchema = z.object({
  role: z.enum(['SUPPORTER', 'ORG_ADMIN', 'PLATFORM_ADMIN', 'PUBLIC']),
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
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Find organization (current version)
    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check current user's access
    const currentUserAccess = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        organizationId: organization.id,
        userId: currentUser.id,
      }),
    });

    if (!currentUserAccess || currentUserAccess.role === 'SUPPORTER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Find the organization user to update (current version)
    const targetOrgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({ id: organizationUserId }),
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

    // Check if current user can modify this role
    if (!canModifyRole(currentUserAccess.role, targetOrgUser.role, newRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to assign this role' },
        { status: 403 }
      );
    }

    // Update the role (creates new version)
    const updatedOrgUser = await OrganizationUserService.updateRole(
      targetOrgUser.userId,
      organization.id,
      newRole,
      currentUser.id
    );

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

export async function DELETE(
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
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Find organization (current version)
    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check current user's access
    const currentUserAccess = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        organizationId: organization.id,
        userId: currentUser.id,
      }),
    });

    if (!currentUserAccess || currentUserAccess.role === 'SUPPORTER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Find the organization user to remove (current version)
    const targetOrgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({ id: organizationUserId }),
    });

    if (!targetOrgUser || targetOrgUser.organizationId !== organization.id) {
      return NextResponse.json(
        { error: 'User not found in organization' },
        { status: 404 }
      );
    }

    // Prevent user from removing themselves
    if (targetOrgUser.userId === currentUser.id) {
      return NextResponse.json(
        { error: 'Cannot remove yourself from the organization' },
        { status: 400 }
      );
    }

    // Check if current user can remove this user
    if (
      currentUserAccess.role === 'ORG_ADMIN' &&
      targetOrgUser.role === 'PLATFORM_ADMIN'
    ) {
      return NextResponse.json(
        { error: 'Cannot remove platform administrators' },
        { status: 403 }
      );
    }

    // Remove the user (soft delete)
    await OrganizationUserService.remove(
      targetOrgUser.userId,
      organization.id,
      currentUser.id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
