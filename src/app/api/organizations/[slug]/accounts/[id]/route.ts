import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  findAccountById,
  updateAccount,
  isAccountCodeAvailable,
} from '@/services/account.service';
import { findOrganizationBySlug } from '@/services/organization.service';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

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

    // Find organization (current version)
    const organization = await findOrganizationBySlug(slug);

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check user access and role (current version)
    const orgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        userId: user.id,
        organizationId: organization.id,
      }),
    });

    if (!orgUser || orgUser.role === 'DONOR') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if account exists and belongs to organization (current version)
    const existingAccount = await findAccountById(id);

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
      const codeAvailable = await isAccountCodeAvailable(
        organization.id,
        validatedData.code,
        id
      );

      if (!codeAvailable) {
        return NextResponse.json(
          { error: 'Account code already exists' },
          { status: 400 }
        );
      }
    }

    // If parent account is specified, verify it exists and is same type
    if (validatedData.parentAccountId) {
      const parentAccount = await findAccountById(validatedData.parentAccountId);

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

      // Check for circular reference (walk up the parent chain)
      let currentParentId = parentAccount.parentAccountId;
      while (currentParentId) {
        if (currentParentId === id) {
          return NextResponse.json(
            { error: 'Cannot create circular parent-child relationship' },
            { status: 400 }
          );
        }
        const nextParent = await findAccountById(currentParentId);
        if (!nextParent) break;
        currentParentId = nextParent.parentAccountId;
      }
    }

    // Prepare updates
    const updates: any = {};
    if (validatedData.code) updates.code = validatedData.code;
    if (validatedData.name) updates.name = validatedData.name;
    if (validatedData.type) updates.type = validatedData.type;
    if (validatedData.parentAccountId !== undefined) {
      updates.parentAccountId = validatedData.parentAccountId;
    }
    if (validatedData.description !== undefined) {
      updates.description = validatedData.description;
    }

    // Update the account (creates new version with audit trail)
    const updatedAccount = await updateAccount(id, updates, user.id);

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
