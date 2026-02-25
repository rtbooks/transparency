import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { updateAccountBalances } from '@/lib/accounting/balance-calculator';
import { AccountService } from '@/services/account.service';
import { MAX_DATE, buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { z } from 'zod';
import { isDateInClosedPeriod } from '@/services/fiscal-period.service';

const createTransactionSchema = z.object({
  date: z.string().datetime(),
  amount: z.number().positive(),
  description: z.string().min(1),
  referenceNumber: z.string().nullable().optional(),
  debitAccountId: z.string().uuid(),
  creditAccountId: z.string().uuid(),
  contactId: z.string().uuid().nullable().optional(),
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
    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];
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

    // Temporal filtering based on as-of date
    if (asOfDate) {
      // System time: only show transactions that existed in the system at this date
      where.systemFrom = { lte: asOfDate };
      where.systemTo = { gt: asOfDate };
      // Valid time: show the version that was valid at this date
      where.validFrom = { lte: asOfDate };
      where.validTo = { gt: asOfDate };
    } else if (!includeHistory) {
      // Default: only show current versions
      where.validTo = MAX_DATE;
      where.systemTo = MAX_DATE;
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
        // End of day: include all transactions on the end date
        const endOfDay = new Date(endDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        where.transactionDate.lte = endOfDay;
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

    // Compute period total using double-entry principles when filtering by type
    let periodTotal: number;
    if (type === 'EXPENSE' || type === 'INCOME') {
      const accountType = type === 'EXPENSE' ? 'EXPENSE' : 'REVENUE';
      const accts = await prisma.account.findMany({
        where: buildCurrentVersionWhere({ organizationId: organization.id, type: accountType }),
        select: { id: true },
      });
      const acctIds = accts.map(a => a.id);
      if (acctIds.length > 0) {
        // Base where without the type filter (we use account-based logic instead)
        const baseWhere = { ...where };
        delete baseWhere.type;
        const [debits, credits] = await Promise.all([
          prisma.transaction.aggregate({
            where: { ...baseWhere, debitAccountId: { in: acctIds } },
            _sum: { amount: true },
          }),
          prisma.transaction.aggregate({
            where: { ...baseWhere, creditAccountId: { in: acctIds } },
            _sum: { amount: true },
          }),
        ]);
        // Expenses: debits increase, credits decrease
        // Revenue: credits increase, debits decrease
        periodTotal = type === 'EXPENSE'
          ? Number(debits._sum.amount || 0) - Number(credits._sum.amount || 0)
          : Number(credits._sum.amount || 0) - Number(debits._sum.amount || 0);
      } else {
        periodTotal = 0;
      }
    } else {
      const aggregate = await prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
      });
      periodTotal = Number(aggregate._sum.amount) || 0;
    }

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

    // Fetch contacts for transactions that have contactId
    const contactIds = [...new Set(transactions.map(t => t.contactId).filter(Boolean))] as string[];
    const contacts = contactIds.length > 0
      ? await prisma.contact.findMany({
          where: buildCurrentVersionWhere({ id: { in: contactIds } }),
          select: { id: true, name: true, type: true, roles: true },
        })
      : [];
    const contactMap = new Map(contacts.map(c => [c.id, c]));

    // Enrich transactions with account and contact data
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
      contact: tx.contactId ? contactMap.get(tx.contactId) || null : null,
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
      periodTotal,
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
    const organization = await prisma.organization.findFirst({
      where: buildCurrentVersionWhere({ slug }),
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const orgUsers = await prisma.organizationUser.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
    });
    const orgUser = orgUsers[0];
    if (!orgUser || orgUser.role === 'SUPPORTER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createTransactionSchema.parse(body);

    // Verify both accounts exist and belong to the organization
    const [debitAccount, creditAccount] = await Promise.all([
      prisma.account.findFirst({
        where: buildCurrentVersionWhere({ id: validatedData.debitAccountId }),
      }),
      prisma.account.findFirst({
        where: buildCurrentVersionWhere({ id: validatedData.creditAccountId }),
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

    // Check if the transaction date falls in a closed fiscal period
    const closedCheck = await isDateInClosedPeriod(organization.id, new Date(validatedData.date));
    if (closedCheck.closed) {
      return NextResponse.json(
        { error: `Cannot create transaction in closed fiscal period "${closedCheck.periodName}"` },
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
          contactId: validatedData.contactId || null,
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
