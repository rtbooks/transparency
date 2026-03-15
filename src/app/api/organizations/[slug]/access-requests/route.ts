import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { withPlatformAuth } from '@/lib/auth/with-platform-auth';
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
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const requests = await getPendingRequests(ctx.orgId);

    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
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
    const ctx = await withPlatformAuth(slug);

    const body = await request.json();
    const validated = createRequestSchema.parse(body);

    const result = await createAccessRequest({
      organizationId: ctx.orgId,
      userId: ctx.userId,
      message: validated.message,
    });

    const statusCode = (result as any).autoApproved ? 201 : 202;
    return NextResponse.json(result, { status: statusCode });
  } catch (error: any) {
    if (error instanceof AuthError) return authErrorResponse(error);
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
