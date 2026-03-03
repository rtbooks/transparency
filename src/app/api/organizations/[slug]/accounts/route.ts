import { NextRequest, NextResponse } from 'next/server';
import { withOrgAuth, AuthError, authErrorResponse } from '@/lib/auth/with-org-auth';
import { z } from 'zod';
import {
  findAccountsByOrganization,
  findActiveAccounts,
  getAccountsByType,
  createAccount,
  isAccountCodeAvailable,
  findAccountById,
} from '@/services/account.service';

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
    const ctx = await withOrgAuth(slug);

    // Check query parameters
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const typeFilter = searchParams.get('type') as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | null;

    // Fetch accounts (current versions only)
    let accounts;
    if (typeFilter) {
      accounts = await getAccountsByType(ctx.orgId, typeFilter);
    } else if (includeInactive) {
      accounts = await findAccountsByOrganization(ctx.orgId);
    } else {
      accounts = await findActiveAccounts(ctx.orgId);
    }

    return NextResponse.json(accounts);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
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
    const ctx = await withOrgAuth(slug, { requiredRole: 'ORG_ADMIN' });

    // Parse and validate request body
    const body = await request.json();
    const validatedData = accountSchema.parse(body);

    // Check if account code already exists (current versions)
    const codeAvailable = await isAccountCodeAvailable(
      ctx.orgId,
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
      organizationId: ctx.orgId,
      code: validatedData.code,
      name: validatedData.name,
      type: validatedData.type,
      parentAccountId: validatedData.parentAccountId || null,
      description: validatedData.description || null,
      createdByUserId: ctx.userId,
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
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
