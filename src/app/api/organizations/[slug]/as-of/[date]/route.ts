/**
 * GET /api/organizations/[slug]/as-of/[date]
 * Get organization state as it was at a specific date
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { OrganizationService } from '@/services/organization.service';
import { AccountService } from '@/services/account.service';
import { ProgramSpendingService } from '@/services/program-spending.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; date: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, date: dateStr } = await params;

    // Parse and validate date
    const asOfDate = new Date(dateStr);
    if (isNaN(asOfDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Get organization as of date
    const organization = await OrganizationService.findAsOf(slug, asOfDate);
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found for this date' },
        { status: 404 }
      );
    }

    // Get accounts as of date
    const accounts = await AccountService.findAsOf(organization.id, asOfDate);

    // Get program spending as of date
    const programSpending = await ProgramSpendingService.findAsOf(
      organization.id,
      asOfDate
    );

    return NextResponse.json({
      asOfDate: asOfDate.toISOString(),
      organization: {
        ...organization,
        versionMetadata: {
          versionId: organization.versionId,
          validFrom: organization.validFrom,
          validTo: organization.validTo,
        },
      },
      accounts: accounts.map((acc) => ({
        ...acc,
        versionMetadata: {
          versionId: acc.versionId,
          validFrom: acc.validFrom,
          validTo: acc.validTo,
        },
      })),
      programSpending: programSpending.map((ps) => ({
        ...ps,
        versionMetadata: {
          versionId: ps.versionId,
          validFrom: ps.validFrom,
          validTo: ps.validTo,
        },
      })),
    });
  } catch (error) {
    console.error('Error fetching as-of-date state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical state' },
      { status: 500 }
    );
  }
}
