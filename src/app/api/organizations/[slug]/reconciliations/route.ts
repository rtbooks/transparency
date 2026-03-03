import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { startReconciliation, listReconciliations, getLastEndingBalance } from '@/services/account-reconciliation.service';
import { z } from 'zod';

const createSchema = z.object({
  accountId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  beginningBalance: z.number(),
  endingBalance: z.number(),
});

/**
 * GET /api/organizations/[slug]/reconciliations
 * List reconciliations, optionally filtered by accountId.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const ctx = await withOrgAuth(slug);

    const accountId = request.nextUrl.searchParams.get('accountId') || undefined;
    const reconciliations = await listReconciliations(ctx.orgId, accountId);

    return NextResponse.json(reconciliations);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error listing reconciliations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/[slug]/reconciliations
 * Start a new reconciliation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const body = await request.json();
    const validated = createSchema.parse(body);

    const safeDateParse = (s: string) => new Date(s.length === 10 ? s + 'T12:00:00' : s);

    // Use start-of-day for period start, end-of-day for period end
    const periodStartDate = safeDateParse(validated.periodStart);
    periodStartDate.setUTCHours(0, 0, 0, 0);
    const periodEndDate = safeDateParse(validated.periodEnd);
    periodEndDate.setUTCHours(23, 59, 59, 999);

    const reconciliation = await startReconciliation({
      organizationId: ctx.orgId,
      accountId: validated.accountId,
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
      beginningBalance: validated.beginningBalance,
      endingBalance: validated.endingBalance,
      createdBy: ctx.userId,
    });

    return NextResponse.json(reconciliation, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (error?.message?.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error starting reconciliation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
