import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the user in our database
    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    // Find organization and check access
    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];
    if (!orgUser || orgUser.role === 'SUPPORTER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if account exists and belongs to organization
    const existingAccount = await prisma.account.findFirst({
      where: buildCurrentVersionWhere({ id }),
    });

    if (!existingAccount || existingAccount.organizationId !== organization.id) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Validate deactivation: cannot deactivate if has active children
    if (existingAccount.isActive) {
      const activeChildren = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({
          parentAccountId: existingAccount.id,
          isActive: true,
        }),
      });

      if (activeChildren) {
        return NextResponse.json(
          { error: 'Cannot deactivate account with active child accounts. Deactivate children first.' },
          { status: 400 }
        );
      }
    }

    // Validate activation: cannot activate if parent is inactive
    if (!existingAccount.isActive && existingAccount.parentAccountId) {
      const parentAccount = await prisma.account.findFirst({
        where: buildCurrentVersionWhere({ id: existingAccount.parentAccountId }),
      });

      if (parentAccount && !parentAccount.isActive) {
        return NextResponse.json(
          { error: 'Cannot activate account because parent account is inactive. Activate parent first.' },
          { status: 400 }
        );
      }
    }

    // Toggle the isActive status
    const updatedAccount = await prisma.account.update({
      where: { versionId: existingAccount.versionId },
      data: {
        isActive: !existingAccount.isActive,
      },
    });

    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error('Error toggling account status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
