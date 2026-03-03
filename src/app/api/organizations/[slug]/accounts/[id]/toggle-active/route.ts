import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere, closeVersion, buildNewVersionData } from '@/lib/temporal/temporal-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    // Check if account exists and belongs to organization
    const existingAccount = await prisma.account.findFirst({
      where: buildCurrentVersionWhere({ id }),
    });

    if (!existingAccount || existingAccount.organizationId !== ctx.orgId) {
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

    // Toggle the isActive status (temporal: close old version, create new)
    const now = new Date();
    await closeVersion(prisma.account, existingAccount.versionId, now, 'account');
    const updatedAccount = await prisma.account.create({
      data: buildNewVersionData(existingAccount, { isActive: !existingAccount.isActive } as any, now) as any,
    });

    return NextResponse.json(updatedAccount);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error toggling account status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
