/**
 * GET /api/organizations/[slug]/accounts/[id]/history
 * Get complete version history of an account
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { AccountService } from '@/services/account.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = params.id;
    const history = await AccountService.findHistory(accountId);

    if (!history || history.length === 0) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Map to include version metadata and changes
    const historyWithMeta = history.map((version, index) => {
      const previous = history[index + 1]; // Next in array is previous version
      const changes: Record<string, { from: unknown; to: unknown }> = {};

      if (previous) {
        // Detect what changed
        const keys = Object.keys(version) as Array<keyof typeof version>;
        keys.forEach((key) => {
          if (
            key !== 'versionId' &&
            key !== 'previousVersionId' &&
            key !== 'validFrom' &&
            key !== 'validTo' &&
            key !== 'systemFrom' &&
            key !== 'systemTo' &&
            version[key] !== previous[key]
          ) {
            changes[key] = {
              from: previous[key],
              to: version[key],
            };
          }
        });
      }

      return {
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
          changedBy: version.changedBy,
        },
        changes: Object.keys(changes).length > 0 ? changes : undefined,
      };
    });

    return NextResponse.json({
      accountId,
      totalVersions: history.length,
      history: historyWithMeta,
    });
  } catch (error) {
    console.error('Error fetching account history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account history' },
      { status: 500 }
    );
  }
}
