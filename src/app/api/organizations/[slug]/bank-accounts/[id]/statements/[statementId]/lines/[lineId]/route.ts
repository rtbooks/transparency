import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { manualMatch, unmatchLine, skipLine } from '@/services/reconciliation.service';
import { z } from 'zod';

const matchSchema = z.object({
  action: z.enum(['match', 'unmatch', 'skip']),
  transactionId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

/**
 * PATCH /api/organizations/[slug]/bank-accounts/[id]/statements/[statementId]/lines/[lineId]
 * Match, unmatch, or skip a statement line.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string; statementId: string; lineId: string }> }
) {
  try {
    const { slug, lineId } = await params;
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

    const line = await prisma.bankStatementLine.findUnique({
      where: { id: lineId },
      include: { bankStatement: true },
    });

    if (!line || line.bankStatement.organizationId !== organization.id) {
      return NextResponse.json({ error: 'Statement line not found' }, { status: 404 });
    }

    if (line.bankStatement.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Cannot modify a completed reconciliation' }, { status: 400 });
    }

    const body = await request.json();
    const validated = matchSchema.parse(body);

    let result;
    switch (validated.action) {
      case 'match':
        if (!validated.transactionId) {
          return NextResponse.json({ error: 'transactionId required for match action' }, { status: 400 });
        }
        result = await manualMatch(lineId, validated.transactionId);
        break;
      case 'unmatch':
        result = await unmatchLine(lineId);
        break;
      case 'skip':
        result = await skipLine(lineId, validated.notes);
        break;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    console.error('Error updating statement line:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
