import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { findProgramSpendingById, unlinkTransaction } from '@/services/program-spending.service';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string; txId: string }> }
) {
  try {
    const { slug, id, txId } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];
    if (!orgUser || orgUser.role === 'DONOR') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const item = await findProgramSpendingById(id);
    if (!item || item.organizationId !== organization.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await unlinkTransaction(id, txId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unlinking transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
