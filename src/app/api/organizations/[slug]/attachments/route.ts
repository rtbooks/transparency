import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
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

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    if (!orgUsers[0]) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

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

    const attachments = await listAttachments(organization.id, entityType, entityId);
    return NextResponse.json({ attachments });
  } catch (error) {
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

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    if (!orgUsers[0]) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // DONOR role cannot upload
    if (orgUsers[0].role === 'DONOR') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

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
      organization.id,
      entityType as AttachmentEntityType,
      entityId,
      file,
      user.id
    );

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error uploading attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
