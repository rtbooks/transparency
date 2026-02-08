import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { updateAccountBalances } from '@/lib/accounting/balance-calculator';
import { z } from 'zod';

const createTransactionSchema = z.object({
  date: z.string().datetime(),
  amount: z.number().positive(),
  description: z.string().min(1),
  referenceNumber: z.string().nullable().optional(),
  debitAccountId: z.string().uuid(),
  creditAccountId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
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

    // Find organization and check access
    const organization = await prisma.organization.findUnique({
      where: { slug: params.slug },
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
