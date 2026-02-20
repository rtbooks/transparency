import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { voidTransaction } from '@/services/transaction.service';
import { z } from 'zod';

const voidTransactionSchema = z.object({
  voidReason: z.string().min(1, 'A reason for voiding is required'),
});

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

    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organization = await prisma.organization.findUnique({
      where: { slug },
      include: {
        organizationUsers: {
          where: { userId: user.id },
        },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgUser = organization.organizationUsers[0];
    if (!orgUser || orgUser.role === 'DONOR') {
      return NextResponse.json({ error: 'Access denied. Only admins can void transactions.' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = voidTransactionSchema.parse(body);

    const voided = await voidTransaction(id, organization.id, validatedData, user.id);
    return NextResponse.json(voided);
  } catch (error) {
    console.error('Error voiding transaction:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'Transaction not found or already voided') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
