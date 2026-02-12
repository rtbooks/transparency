/**
 * GET /api/organizations/[slug]/changes?from=date&to=date
 * Get all changes to an organization within a date range
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { OrganizationService } from '@/services/organization.service';
import { AccountService } from '@/services/account.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const slug = params.slug;
    const { searchParams } = new URL(request.url);
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    if (!fromStr || !toStr) {
      return NextResponse.json(
        { error: 'Both from and to date parameters are required' },
        { status: 400 }
      );
    }

    // Parse and validate dates
    const fromDate = new Date(fromStr);
    const toDate = new Date(toStr);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: 'from date must be before to date' },
        { status: 400 }
      );
    }

    // Get organization to verify it exists
    const organization = await OrganizationService.findBySlug(slug);
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get changes in date range
    const orgChanges = await OrganizationService.findChangesInRange(
      slug,
      fromDate,
      toDate
    );

    const accountChanges = await AccountService.findChangesInRange(
      organization.id,
      fromDate,
      toDate
    );

    return NextResponse.json({
      dateRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      changes: {
        organization: orgChanges.map((version) => ({
          versionId: version.versionId,
          previousVersionId: version.previousVersionId,
          validFrom: version.validFrom,
          systemFrom: version.systemFrom,
          changedBy: version.changedBy,
          isDeleted: version.isDeleted,
          data: version,
        })),
        accounts: accountChanges.map((version) => ({
          versionId: version.versionId,
          previousVersionId: version.previousVersionId,
          validFrom: version.validFrom,
          systemFrom: version.systemFrom,
          changedBy: version.changedBy,
          isDeleted: version.isDeleted,
          data: version,
        })),
      },
      summary: {
        totalChanges: orgChanges.length + accountChanges.length,
        organizationChanges: orgChanges.length,
        accountChanges: accountChanges.length,
      },
    });
  } catch (error) {
    console.error('Error fetching changes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch changes' },
      { status: 500 }
    );
  }
}
