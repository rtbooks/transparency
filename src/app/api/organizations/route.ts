import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createOrganizationSchema = z.object({
  name: z.string().min(3),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  ein: z.string().nullable().optional(),
  mission: z.string().nullable().optional(),
  fiscalYearStart: z.string().datetime(),
});

export async function POST(request: NextRequest) {
  try {
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createOrganizationSchema.parse(body);

    // Check if slug is already taken
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: validatedData.slug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: 'This URL slug is already taken. Please choose another.' },
        { status: 400 }
      );
    }

    // Create organization and make the creating user an ORG_ADMIN
    const organization = await prisma.organization.create({
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        ein: validatedData.ein,
        mission: validatedData.mission,
        fiscalYearStart: new Date(validatedData.fiscalYearStart),
        organizationUsers: {
          create: {
            userId: user.id,
            role: 'ORG_ADMIN',
          },
        },
      },
      include: {
        organizationUsers: true,
      },
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error('Error creating organization:', error);

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

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the user in our database
    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
      include: {
        organizationUsers: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    // Return list of organizations the user has access to
    const organizations = user.organizationUsers.map((ou) => ({
      ...ou.organization,
      role: ou.role,
    }));

    return NextResponse.json(organizations);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
