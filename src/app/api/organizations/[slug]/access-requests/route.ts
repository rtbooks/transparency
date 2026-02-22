import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { createAccessRequest, getPendingRequests } from '@/services/access-request.service';
import { z } from 'zod';

const createRequestSchema = z.object({
  message: z.string().max(500).nullable().optional(),
});

/**
 * GET /api/organizations/[slug]/access-requests
 * List pending access requests (admin only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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

    // Only admins can list access requests
    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];
    const isAdmin = user.isPlatformAdmin || (orgUser && orgUser.role === 'ORG_ADMIN');

    if (!isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const requests = await getPendingRequests(organization.id);

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Error listing access requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/[slug]/access-requests
 * Submit a new access request (authenticated users only).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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

    const body = await request.json();
    const validated = createRequestSchema.parse(body);

    const result = await createAccessRequest({
      organizationId: organization.id,
      userId: user.id,
      message: validated.message,
    });

    const statusCode = (result as any).autoApproved ? 201 : 202;
    return NextResponse.json(result, { status: statusCode });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (error?.message?.includes('already have')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Error creating access request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
