import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { put, del } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { findOrganizationBySlug, updateOrganization } from '@/services/organization.service';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

const MAX_LOGO_SIZE = 500 * 1024; // 500KB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

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

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organization = await findOrganizationBySlug(slug);
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const userAccess = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({ userId: user.id, organizationId: organization.id }),
    });

    if (!userAccess || userAccess.role !== 'ORG_ADMIN') {
      return NextResponse.json({ error: 'Only administrators can upload logos' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPEG, WebP, SVG' },
        { status: 400 }
      );
    }

    if (file.size > MAX_LOGO_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 500KB' },
        { status: 400 }
      );
    }

    // Delete old logo blob if it exists
    if (organization.logoUrl) {
      try {
        await del(organization.logoUrl);
      } catch {
        // Old blob may not exist or be from a different source — ignore
      }
    }

    // Upload to Vercel Blob
    const blob = await put(`logos/${organization.id}/${file.name}`, file, {
      access: 'public',
      contentType: file.type,
    });

    // Update organization with new logo URL
    await updateOrganization(organization.id, { logoUrl: blob.url }, user.id);

    return NextResponse.json({ logoUrl: blob.url });
  } catch (error) {
    console.error('Error uploading logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organization = await findOrganizationBySlug(slug);
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const userAccess = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({ userId: user.id, organizationId: organization.id }),
    });

    if (!userAccess || userAccess.role !== 'ORG_ADMIN') {
      return NextResponse.json({ error: 'Only administrators can remove logos' }, { status: 403 });
    }

    if (organization.logoUrl) {
      try {
        await del(organization.logoUrl);
      } catch {
        // Ignore blob deletion errors
      }
    }

    await updateOrganization(organization.id, { logoUrl: null }, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
