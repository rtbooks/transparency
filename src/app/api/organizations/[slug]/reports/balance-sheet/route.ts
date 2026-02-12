/**
 * GET /api/organizations/[slug]/reports/balance-sheet?asOfDate=<date>
 * Generate balance sheet as of a specific date
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { OrganizationService } from '@/services/organization.service';
import { generateBalanceSheet } from '@/lib/reporting/temporal-reports';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const asOfDateStr = searchParams.get('asOfDate');

    if (!asOfDateStr) {
      return NextResponse.json(
        { error: 'asOfDate parameter is required' },
        { status: 400 }
      );
    }

    const asOfDate = new Date(asOfDateStr);
    if (isNaN(asOfDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Get organization
    const organization = await OrganizationService.findBySlug(slug);
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Generate report
    const balanceSheet = await generateBalanceSheet(organization.id, asOfDate);

    return NextResponse.json(balanceSheet);
  } catch (error) {
    console.error('Error generating balance sheet:', error);
    return NextResponse.json(
      { error: 'Failed to generate balance sheet' },
      { status: 500 }
    );
  }
}
