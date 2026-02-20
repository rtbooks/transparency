import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { updateAccountBalances } from '@/lib/accounting/balance-calculator';
import { AccountService } from '@/services/account.service';
import { MAX_DATE } from '@/lib/temporal/temporal-utils';
import { z } from 'zod';

const createTransactionSchema = z.object({
  date: z.string().datetime(),
  amount: z.number().positive(),
  description: z.string().min(1),
  referenceNumber: z.string().nullable().optional(),
  debitAccountId: z.string().uuid(),
  creditAccountId: z.string().uuid(),
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
    if (!orgUser) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse query parameters for filtering and pagination
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const type = searchParams.get('type');
    const accountId = searchParams.get('accountId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const asOfDate = searchParams.get('asOfDate')
      ? new Date(searchParams.get('asOfDate')!)
      : undefined;
    const includeVoided = searchParams.get('includeVoided') === 'true';
    const includeHistory = searchParams.get('includeHistory') === 'true';

    // Build where clause
    const where: any = {
      organizationId: organization.id,
    };

    // Only show current versions by default
    if (!includeHistory) {
      where.validTo = MAX_DATE;
    }

    // Filter out deleted
    where.isDeleted = false;

    // Filter voided unless explicitly requested
    if (!includeVoided) {
      where.isVoided = false;
    }

    if (type) {
      where.type = type;
    }

    if (accountId) {
      where.OR = [
        { debitAccountId: accountId },
        { creditAccountId: accountId },
      ];
    }

    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) {
        where.transactionDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.transactionDate.lte = new Date(endDate);
      }
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count for pagination
    const totalCount = await prisma.transaction.count({ where });

    // Fetch transactions (without account includes for now)
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get unique account IDs from transactions
    const accountIds = [
      ...new Set([
        ...transactions.map(t => t.debitAccountId),
        ...transactions.map(t => t.creditAccountId),
      ])
    ];

    // Fetch accounts - either current or as of date
    const accounts = accountIds.length > 0 
      ? (asOfDate
          ? await AccountService.findManyAsOf(organization.id, accountIds, asOfDate)
          : await AccountService.findManyCurrent(organization.id, accountIds))
      : [];

    // Create account lookup map
    const accountMap = new Map(accounts.map(a => [a.id, {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
    }]));

    // Enrich transactions with account data
    const enrichedTransactions = transactions.map(tx => ({
      ...tx,
      debitAccount: accountMap.get(tx.debitAccountId) || {
        id: tx.debitAccountId,
        code: '???',
        name: '(Account not found)',
        type: 'ASSET',
      },
      creditAccount: accountMap.get(tx.creditAccountId) || {
        id: tx.creditAccountId,
        code: '???',
        name: '(Account not found)',
        type: 'ASSET',
      },
    }));

    return NextResponse.json({
      transactions: enrichedTransactions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount,
      },
      temporalContext: asOfDate ? {
        asOfDate: asOfDate.toISOString(),
        isHistoricalView: true,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
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

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createTransactionSchema.parse(body);

    // Verify both accounts exist and belong to the organization
    const [debitAccount, creditAccount] = await Promise.all([
      prisma.account.findUnique({
        where: { id: validatedData.debitAccountId },
      }),
      prisma.account.findUnique({
        where: { id: validatedData.creditAccountId },
      }),
    ]);

    if (
      !debitAccount ||
      !creditAccount ||
      debitAccount.organizationId !== organization.id ||
      creditAccount.organizationId !== organization.id
    ) {
      return NextResponse.json(
        { error: 'Invalid account selection' },
        { status: 400 }
      );
    }

    // Verify accounts are active
    if (!debitAccount.isActive || !creditAccount.isActive) {
      return NextResponse.json(
        { error: 'Cannot use inactive accounts for transactions' },
        { status: 400 }
      );
    }

    // Determine transaction type based on account types
    let transactionType: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    if (
      debitAccount.type === 'ASSET' &&
      creditAccount.type === 'REVENUE'
    ) {
      transactionType = 'INCOME';
    } else if (
      debitAccount.type === 'EXPENSE' &&
      creditAccount.type === 'ASSET'
    ) {
      transactionType = 'EXPENSE';
    } else if (
      debitAccount.type === 'ASSET' &&
      creditAccount.type === 'ASSET'
    ) {
      transactionType = 'TRANSFER';
    } else {
      transactionType = 'INCOME'; // Default for general entries
    }

    // Create transaction and update balances in a transaction
    const transaction = await prisma.$transaction(async (tx) => {
      // Create the transaction record
      const newTransaction = await tx.transaction.create({
        data: {
          organizationId: organization.id,
          transactionDate: new Date(validatedData.date),
          amount: validatedData.amount,
          type: transactionType,
          debitAccountId: validatedData.debitAccountId,
          creditAccountId: validatedData.creditAccountId,
          description: validatedData.description,
          referenceNumber: validatedData.referenceNumber || null,
          paymentMethod: 'OTHER', // Default, can be enhanced later
        },
      });

      // Update account balances
      await updateAccountBalances(
        tx,
        validatedData.debitAccountId,
        validatedData.creditAccountId,
        validatedData.amount
      );

      return newTransaction;
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);

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
