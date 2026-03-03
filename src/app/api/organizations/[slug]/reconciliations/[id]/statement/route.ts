import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { put, del } from '@vercel/blob';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

/**
 * POST /api/organizations/[slug]/reconciliations/[id]/statement
 * Upload a bank statement attachment for a reconciliation.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const reconciliation = await prisma.accountReconciliation.findFirst({
      where: { id, organizationId: organization.id },
    });
    if (!reconciliation) return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5 MB.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: PDF, PNG, JPEG, WebP.' }, { status: 400 });
    }

    // Delete old blob if replacing
    if (reconciliation.statementBlobUrl) {
      try { await del(reconciliation.statementBlobUrl); } catch { /* ignore */ }
    }

    const blob = await put(
      `reconciliations/${organization.id}/${id}/${file.name}`,
      file,
      { access: 'private', addRandomSuffix: true }
    );

    await prisma.accountReconciliation.update({
      where: { id },
      data: {
        statementBlobUrl: blob.url,
        statementFileName: file.name,
      },
    });

    return NextResponse.json({ statementFileName: file.name, statementBlobUrl: blob.url });
  } catch (error) {
    console.error('Error uploading reconciliation statement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/organizations/[slug]/reconciliations/[id]/statement
 * Remove the bank statement attachment from a reconciliation.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const reconciliation = await prisma.accountReconciliation.findFirst({
      where: { id, organizationId: organization.id },
    });
    if (!reconciliation) return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });

    if (reconciliation.statementBlobUrl) {
      try { await del(reconciliation.statementBlobUrl); } catch { /* ignore */ }
    }

    await prisma.accountReconciliation.update({
      where: { id },
      data: { statementBlobUrl: null, statementFileName: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reconciliation statement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
