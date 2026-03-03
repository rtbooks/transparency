import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import {
  uploadAttachment,
  listAttachments,
  AttachmentValidationError,
  type AttachmentEntityType,
} from '@/services/attachment.service';

const VALID_ENTITY_TYPES: AttachmentEntityType[] = ['TRANSACTION', 'BILL', 'PROGRAM_SPENDING'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const ctx = await withOrgAuth(slug);

    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType') as AttachmentEntityType | null;
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId query parameters are required' },
        { status: 400 }
      );
    }

    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return NextResponse.json(
        { error: `Invalid entityType. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const attachments = await listAttachments(ctx.orgId, entityType, entityId);
    return NextResponse.json({ attachments });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error listing attachments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const entityType = formData.get('entityType') as string | null;
    const entityId = formData.get('entityId') as string | null;

    if (!file || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'file, entityType, and entityId are required' },
        { status: 400 }
      );
    }

    if (!VALID_ENTITY_TYPES.includes(entityType as AttachmentEntityType)) {
      return NextResponse.json(
        { error: `Invalid entityType. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const attachment = await uploadAttachment(
      ctx.orgId,
      entityType as AttachmentEntityType,
      entityId,
      file,
      ctx.userId
    );

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AttachmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error uploading attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
