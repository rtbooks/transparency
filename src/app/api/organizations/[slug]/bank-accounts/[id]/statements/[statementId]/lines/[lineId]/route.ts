import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { manualMatch, unmatchLine, skipLine, removeMatch } from '@/services/reconciliation.service';
import { z } from 'zod';

const matchActionSchema = z.object({
  action: z.literal('match'),
  // Single transaction match
  transactionId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
  // Multi-transaction match
  matches: z.array(z.object({
    transactionId: z.string().uuid(),
    amount: z.number().positive(),
  })).optional(),
});

const otherActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('unmatch') }),
  z.object({
    action: z.literal('remove-match'),
    matchId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('skip'),
    notes: z.string().optional(),
  }),
]);

const patchSchema = z.union([matchActionSchema, otherActionSchema]);

/**
 * PATCH /api/organizations/[slug]/bank-accounts/[id]/statements/[statementId]/lines/[lineId]
 * Match, unmatch, remove-match, or skip a statement line.
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
    const validated = patchSchema.parse(body);

    let result;
    switch (validated.action) {
      case 'match': {
        const matchEntries = validated.matches
          ? validated.matches
          : validated.transactionId
            ? [{ transactionId: validated.transactionId, amount: validated.amount || Math.abs(Number(line.amount)) }]
            : null;
        if (!matchEntries) {
          return NextResponse.json({ error: 'transactionId or matches required for match action' }, { status: 400 });
        }
        result = await manualMatch(lineId, matchEntries);
        break;
      }
      case 'unmatch':
        result = await unmatchLine(lineId);
        break;
      case 'remove-match':
        result = await removeMatch(validated.matchId);
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
    if (error?.message?.includes('exceeds line amount')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error updating statement line:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
