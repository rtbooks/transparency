import { AccountType } from '@/generated/prisma/client';
import { MAX_DATE, closeVersion } from '@/lib/temporal/temporal-utils';

/**
 * Calculate updated balance for an account based on a transaction
 * 
 * Double-entry bookkeeping rules:
 * - ASSET accounts: Debits increase, Credits decrease
 * - LIABILITY accounts: Credits increase, Debits decrease
 * - EQUITY accounts: Credits increase, Debits decrease
 * - REVENUE accounts: Credits increase, Debits decrease
 * - EXPENSE accounts: Debits increase, Credits decrease
 */
export function calculateNewBalance(
  currentBalance: number | { toString(): string },
  amount: number | { toString(): string },
  accountType: AccountType,
  isDebit: boolean
): number {
  const balance = typeof currentBalance === 'number' ? currentBalance : parseFloat(currentBalance.toString());
  const transactionAmount = typeof amount === 'number' ? amount : parseFloat(amount.toString());

  if (accountType === 'ASSET' || accountType === 'EXPENSE') {
    // Debits increase, Credits decrease
    return isDebit ? balance + transactionAmount : balance - transactionAmount;
  } else {
    // LIABILITY, EQUITY, REVENUE: Credits increase, Debits decrease
    return isDebit ? balance - transactionAmount : balance + transactionAmount;
  }
}

/**
 * Close an account version and create a new version with the updated balance.
 * Uses optimistic locking via closeVersion() to detect concurrent modifications.
 * 
 * IMPORTANT: This function must be called within a Prisma $transaction so that
 * the close + create is atomic. If a ConcurrentModificationError occurs, the
 * entire DB transaction rolls back — the caller should retry the whole operation.
 */
async function updateSingleAccountBalance(
  prisma: any,
  accountId: string,
  amount: number,
  isDebit: boolean,
  now: Date
): Promise<number> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, validTo: MAX_DATE, isDeleted: false },
  });

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  const newBalance = calculateNewBalance(account.currentBalance, amount, account.type, isDebit);

  // Close current version with optimistic lock — if another process closed
  // this version first, throws ConcurrentModificationError and the entire
  // DB transaction rolls back (no partial updates possible)
  await closeVersion(prisma.account, account.versionId, now, 'Account');

  // Create new version with updated balance
  const { versionId: _vId, ...rest } = account;
  await prisma.account.create({
    data: {
      ...rest,
      currentBalance: newBalance,
      versionId: crypto.randomUUID(),
      previousVersionId: account.versionId,
      validFrom: now,
      validTo: MAX_DATE,
      systemFrom: now,
      systemTo: MAX_DATE,
    },
  });

  return newBalance;
}

/**
 * Update balances for both accounts involved in a transaction.
 * Creates new bitemporal versions for each account.
 * 
 * Must be called within a Prisma $transaction (all callers already do this).
 * Both accounts are updated within the same DB transaction — if either fails,
 * the entire transaction rolls back with no partial balance updates.
 */
export async function updateAccountBalances(
  prisma: any,
  debitAccountId: string,
  creditAccountId: string,
  amount: number
) {
  // Fetch both accounts (current versions)
  const [debitAccount, creditAccount] = await Promise.all([
    prisma.account.findFirst({ where: { id: debitAccountId, validTo: MAX_DATE, systemTo: MAX_DATE, isDeleted: false } }),
    prisma.account.findFirst({ where: { id: creditAccountId, validTo: MAX_DATE, systemTo: MAX_DATE, isDeleted: false } }),
  ]);

  if (!debitAccount || !creditAccount) {
    throw new Error('One or both accounts not found');
  }

  // Calculate new balances
  const newDebitBalance = calculateNewBalance(
    debitAccount.currentBalance,
    amount,
    debitAccount.type,
    true // This account is being debited
  );
  const now = new Date();

  const newDebitBalance = await updateSingleAccountBalance(prisma, debitAccountId, amount, true, now);
  const newCreditBalance = await updateSingleAccountBalance(prisma, creditAccountId, amount, false, now);

  return { newDebitBalance, newCreditBalance };
}

/**
 * Reverse the balance effects of a transaction on both accounts.
 * Creates new bitemporal versions for each account.
 * 
 * Must be called within a Prisma $transaction.
 */
export async function reverseAccountBalances(
  prisma: any,
  debitAccountId: string,
  creditAccountId: string,
  amount: number
) {
  // Fetch both accounts (current versions)
  const [debitAccount, creditAccount] = await Promise.all([
    prisma.account.findFirst({ where: { id: debitAccountId, validTo: MAX_DATE, systemTo: MAX_DATE, isDeleted: false } }),
    prisma.account.findFirst({ where: { id: creditAccountId, validTo: MAX_DATE, systemTo: MAX_DATE, isDeleted: false } }),
  ]);

  if (!debitAccount || !creditAccount) {
    throw new Error('One or both accounts not found');
  }

  // Reverse the debit (apply credit to the debit account)
  const newDebitBalance = calculateNewBalance(
    debitAccount.currentBalance,
    amount,
    debitAccount.type,
    false // Credit to reverse the original debit
  );

  // Reverse the credit (apply debit to the credit account)
  const newCreditBalance = calculateNewBalance(
    creditAccount.currentBalance,
    amount,
    creditAccount.type,
    true // Debit to reverse the original credit
  );
  const now = new Date();

  // Reverse: credit the debit account, debit the credit account
  const newDebitBalance = await updateSingleAccountBalance(prisma, debitAccountId, amount, false, now);
  const newCreditBalance = await updateSingleAccountBalance(prisma, creditAccountId, amount, true, now);

  return { newDebitBalance, newCreditBalance };
}
