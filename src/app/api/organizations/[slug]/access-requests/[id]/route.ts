import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { approveAccessRequest, denyAccessRequest } from '@/services/access-request.service';
import { z } from 'zod';

const reviewSchema = z.object({
  action: z.enum(['approve', 'deny']),
});

/**
 * PATCH /api/organizations/[slug]/access-requests/[id]
 * Approve or deny an access request (admin only).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id: requestId } = await params;
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

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Only admins can review access requests
    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];
    const isAdmin = user.isPlatformAdmin || (orgUser && orgUser.role === 'ORG_ADMIN');

    if (!isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const validated = reviewSchema.parse(body);

    let result;
    if (validated.action === 'approve') {
      result = await approveAccessRequest(requestId, user.id);
    } else {
      result = await denyAccessRequest(requestId, user.id);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (error?.message?.includes('Cannot')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error reviewing access request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
