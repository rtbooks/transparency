import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { getAttachment } from '@/services/attachment.service';

/**
 * Proxy download for private Vercel Blob attachments.
 * Authenticates the user, verifies org membership, then streams the blob.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
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

    const attachment = await getAttachment(organization.id, id);
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Fetch the blob from Vercel's private store using the server-side token
    const blobResponse = await fetch(attachment.blobUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!blobResponse.ok) {
      console.error('Blob fetch failed:', blobResponse.status, blobResponse.statusText);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return new NextResponse(blobResponse.body, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `inline; filename="${attachment.fileName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error downloading attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
