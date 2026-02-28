import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  findAccountsByOrganization,
  findActiveAccounts,
  getAccountsByType,
  createAccount,
  isAccountCodeAvailable,
  findAccountById,
} from '@/services/account.service';
import { findOrganizationBySlug } from '@/services/organization.service';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';

const accountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  parentAccountId: z.string().nullable().optional(),
  description: z.string().max(500).optional(),
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

    // Find organization (current version)
    const organization = await findOrganizationBySlug(slug);

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check user access (current version)
    const userAccess = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        userId: user.id,
        organizationId: organization.id,
      }),
    });

    if (!userAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check query parameters
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const typeFilter = searchParams.get('type') as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | null;

    // Fetch accounts (current versions only)
    let accounts;
    if (typeFilter) {
      accounts = await getAccountsByType(organization.id, typeFilter);
    } else if (includeInactive) {
      accounts = await findAccountsByOrganization(organization.id);
    } else {
      accounts = await findActiveAccounts(organization.id);
    }

    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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

    if (!orgUser || orgUser.role === 'SUPPORTER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = accountSchema.parse(body);

    // Check if account code already exists (current versions)
    const codeAvailable = await isAccountCodeAvailable(
      organization.id,
      validatedData.code
    );

    if (!codeAvailable) {
      return NextResponse.json(
        { error: 'Account code already exists' },
        { status: 400 }
      );
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

      if (parentAccount.type !== validatedData.type) {
        return NextResponse.json(
          { error: 'Parent account must be the same type' },
          { status: 400 }
        );
      }
    }

    // Create the account (initial version with audit trail)
    const account = await createAccount({
      organizationId: organization.id,
      code: validatedData.code,
      name: validatedData.name,
      type: validatedData.type,
      parentAccountId: validatedData.parentAccountId || null,
      description: validatedData.description || null,
      createdByUserId: user.id,
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);

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
