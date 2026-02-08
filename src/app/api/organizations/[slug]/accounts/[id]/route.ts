import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateAccountSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).optional(),
  parentAccountId: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
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

    // Find organization and check access
    const organization = await prisma.organization.findUnique({
      where: { slug },
      include: {
        organizationUsers: {
          where: { userId: user.id },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const orgUser = organization.organizationUsers[0];
    if (!orgUser || orgUser.role === 'DONOR') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if account exists and belongs to organization
    const existingAccount = await prisma.account.findUnique({
      where: { id },
    });

    if (!existingAccount || existingAccount.organizationId !== organization.id) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateAccountSchema.parse(body);

    // If updating code, check for duplicates (excluding current account)
    if (validatedData.code && validatedData.code !== existingAccount.code) {
      const duplicateCode = await prisma.account.findFirst({
        where: {
          organizationId: organization.id,
          code: validatedData.code,
          id: { not: id },
        },
      });

      if (duplicateCode) {
        return NextResponse.json(
          { error: 'Account code already exists' },
          { status: 400 }
        );
      }
    }

    // If parent account is specified, verify it exists and is same type
    if (validatedData.parentAccountId) {
      const parentAccount = await prisma.account.findUnique({
        where: { id: validatedData.parentAccountId },
      });

      if (!parentAccount) {
        return NextResponse.json(
          { error: 'Parent account not found' },
          { status: 400 }
        );
      }

      const newType = validatedData.type || existingAccount.type;
      if (parentAccount.type !== newType) {
        return NextResponse.json(
          { error: 'Parent account must be the same type' },
          { status: 400 }
        );
      }

      // Check for circular reference
      let currentParent = parentAccount;
      while (currentParent.parentAccountId) {
        if (currentParent.parentAccountId === id) {
          return NextResponse.json(
            { error: 'Cannot create circular parent-child relationship' },
            { status: 400 }
          );
        }
        const nextParent = await prisma.account.findUnique({
          where: { id: currentParent.parentAccountId },
        });
        if (!nextParent) break;
        currentParent = nextParent;
      }
    }

    // Update the account
    const updatedAccount = await prisma.account.update({
      where: { id },
      data: {
        ...(validatedData.code && { code: validatedData.code }),
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.type && { type: validatedData.type }),
        ...(validatedData.parentAccountId !== undefined && {
          parentAccountId: validatedData.parentAccountId,
        }),
        ...(validatedData.description !== undefined && {
          description: validatedData.description,
        }),
      },
    });

    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error('Error updating account:', error);

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
