import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { z } from 'zod';

const createSchema = z.object({
  accountId: z.string().uuid(),
  bankName: z.string().min(1).max(200),
  accountNumberLast4: z.string().min(4).max(4),
  accountType: z.enum(['checking', 'savings']).optional(),
});

/**
 * GET /api/organizations/[slug]/bank-accounts
 * List bank accounts for the organization.
 */
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

    const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        organizationId: organization.id,
        userId: user.id,
      }),
    });
    if (!orgUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { organizationId: organization.id },
      orderBy: { bankName: 'asc' },
    });

    // Resolve account names
    const accountIds = bankAccounts.map((ba) => ba.accountId);
    const accounts = accountIds.length > 0
      ? await prisma.account.findMany({
          where: buildCurrentVersionWhere({ id: { in: accountIds } }),
          select: { id: true, name: true, code: true, type: true },
        })
      : [];
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    const result = bankAccounts.map((ba) => {
      const acct = accountMap.get(ba.accountId);
      return {
        id: ba.id,
        accountId: ba.accountId,
        bankName: ba.bankName,
        accountNumberLast4: ba.accountNumberLast4,
        accountType: ba.accountType,
        isActive: ba.isActive,
        accountName: acct?.name || 'Unknown',
        accountCode: acct?.code || '',
        ledgerAccountType: acct?.type || '',
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing bank accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/organizations/[slug]/bank-accounts
 * Create a new bank account linked to a ledger account.
 */
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
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgUser = await prisma.organizationUser.findFirst({
      where: buildCurrentVersionWhere({
        organizationId: organization.id,
        userId: user.id,
      }),
    });
    if (!orgUser || (orgUser.role !== 'ORG_ADMIN' && orgUser.role !== 'PLATFORM_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    // Verify account belongs to this org
    const account = await prisma.account.findFirst({
      where: buildCurrentVersionWhere({
        id: parsed.data.accountId,
        organizationId: organization.id,
      }),
    });
    if (!account) {
      return NextResponse.json({ error: 'Account not found in this organization' }, { status: 404 });
    }

    // Check no existing bank account for this ledger account
    const existing = await prisma.bankAccount.findUnique({
      where: { accountId: parsed.data.accountId },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'This ledger account is already linked to a bank account' },
        { status: 409 }
      );
    }

    const bankAccount = await prisma.bankAccount.create({
      data: {
        organizationId: organization.id,
        accountId: parsed.data.accountId,
        bankName: parsed.data.bankName,
        accountNumberLast4: parsed.data.accountNumberLast4,
        accountType: parsed.data.accountType || null,
      },
    });

    return NextResponse.json(bankAccount, { status: 201 });
  } catch (error) {
    console.error('Error creating bank account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
