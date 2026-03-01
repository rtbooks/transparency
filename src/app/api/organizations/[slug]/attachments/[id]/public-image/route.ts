import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

/**
 * Public proxy for program spending image attachments.
 * No auth required — only serves images belonging to program spending items
 * in organizations with public transparency enabled.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
      select: { id: true, publicTransparency: true },
    });

    if (!organization || !organization.publicTransparency) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (
      !attachment ||
      attachment.organizationId !== organization.id ||
      attachment.entityType !== 'PROGRAM_SPENDING' ||
      !attachment.mimeType.startsWith('image/')
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const blobResponse = await fetch(attachment.blobUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!blobResponse.ok) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    return new NextResponse(blobResponse.body, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error serving public image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
