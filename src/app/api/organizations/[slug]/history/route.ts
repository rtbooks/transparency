/**
 * GET /api/organizations/[slug]/history
 * Get complete version history of an organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { OrganizationService } from '@/services/organization.service';

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
    const history = await OrganizationService.findHistory(slug);

    if (!history || history.length === 0) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Map to include version metadata
    const historyWithMeta = history.map((version) => ({
      ...version,
      versionMetadata: {
        versionId: version.versionId,
        previousVersionId: version.previousVersionId,
        validFrom: version.validFrom,
        validTo: version.validTo,
        systemFrom: version.systemFrom,
        systemTo: version.systemTo,
        isDeleted: version.isDeleted,
        deletedAt: version.deletedAt,
      },
    }));

    return NextResponse.json({ history: historyWithMeta });
  } catch (error) {
    console.error('Error fetching organization history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization history' },
      { status: 500 }
    );
  }
}
