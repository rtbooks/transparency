import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  findOrganizationBySlug,
  updateOrganization,
} from '@/services/organization.service';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

const updateOrganizationSchema = z.object({
  name: z.string().min(3).optional(),
  ein: z.string().nullable().optional(),
  mission: z.string().nullable().optional(),
  fiscalYearStart: z.string().datetime().optional(),
  logoUrl: z.string().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').nullable().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').nullable().optional(),
  donorAccessMode: z.enum(['AUTO_APPROVE', 'REQUIRE_APPROVAL']).optional(),
  paymentInstructions: z.string().nullable().optional(),
  donationsAccountId: z.string().nullable().optional(),
  publicTransparency: z.boolean().optional(),
});

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

    // Find the user in our database
    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    // Find organization (current version only)
    const organization = await findOrganizationBySlug(slug);

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check user access (current version of OrganizationUser)
    const userAccess = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        userId: user.id,
        organizationId: organization.id,
      }),
    });

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the user in our database
    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    // Find organization (current version)
    const organization = await findOrganizationBySlug(slug);

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if user is ORG_ADMIN (current version)
    const userAccess = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        userId: user.id,
        organizationId: organization.id,
      }),
    });

    if (!userAccess || userAccess.role !== 'ORG_ADMIN') {
      return NextResponse.json(
        { error: 'Only organization administrators can update settings' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateOrganizationSchema.parse(body);

    // Prepare updates
    const updates: any = {};
    if (validatedData.name) updates.name = validatedData.name;
    if (validatedData.ein !== undefined) updates.ein = validatedData.ein;
    if (validatedData.mission !== undefined) updates.mission = validatedData.mission;
    if (validatedData.fiscalYearStart) {
      updates.fiscalYearStart = new Date(validatedData.fiscalYearStart);
    }
    if (validatedData.logoUrl !== undefined) updates.logoUrl = validatedData.logoUrl;
    if (validatedData.primaryColor !== undefined) updates.primaryColor = validatedData.primaryColor;
    if (validatedData.accentColor !== undefined) updates.accentColor = validatedData.accentColor;
    if (validatedData.donorAccessMode !== undefined) updates.donorAccessMode = validatedData.donorAccessMode;
    if (validatedData.paymentInstructions !== undefined) updates.paymentInstructions = validatedData.paymentInstructions;
    if (validatedData.donationsAccountId !== undefined) updates.donationsAccountId = validatedData.donationsAccountId;
    if (validatedData.publicTransparency !== undefined) updates.publicTransparency = validatedData.publicTransparency;

    // Update organization (creates new version with audit trail)
    const updatedOrganization = await updateOrganization(
      organization.id,
      updates,
      user.id
    );

    return NextResponse.json(updatedOrganization);
  } catch (error) {
    console.error('Error updating organization:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
