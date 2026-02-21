import { AccountType } from '@/generated/prisma/client';
import { MAX_DATE } from '@/lib/temporal/temporal-utils';

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
 * Update balances for both accounts involved in a transaction
 */
export async function updateAccountBalances(
  prisma: any,
  debitAccountId: string,
  creditAccountId: string,
  amount: number
) {
  // Fetch both accounts (current versions)
  const [debitAccount, creditAccount] = await Promise.all([
    prisma.account.findFirst({ where: { id: debitAccountId, validTo: MAX_DATE, isDeleted: false } }),
    prisma.account.findFirst({ where: { id: creditAccountId, validTo: MAX_DATE, isDeleted: false } }),
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

  const newCreditBalance = calculateNewBalance(
    creditAccount.currentBalance,
    amount,
    creditAccount.type,
    false // This account is being credited
  );

  // Update both accounts (using versionId as PK)
  await Promise.all([
    prisma.account.update({
      where: { versionId: debitAccount.versionId },
      data: { currentBalance: newDebitBalance },
    }),
    prisma.account.update({
      where: { versionId: creditAccount.versionId },
      data: { currentBalance: newCreditBalance },
    }),
  ]);

  return { newDebitBalance, newCreditBalance };
}

/**
 * Reverse the balance effects of a transaction on both accounts.
 * Used when editing or voiding a transaction.
 * 
 * This is the inverse of updateAccountBalances:
 * - Reverses the debit on the debit account (applies a credit)
 * - Reverses the credit on the credit account (applies a debit)
 */
export async function reverseAccountBalances(
  prisma: any,
  debitAccountId: string,
  creditAccountId: string,
  amount: number
) {
  // Fetch both accounts (current versions)
  const [debitAccount, creditAccount] = await Promise.all([
    prisma.account.findFirst({ where: { id: debitAccountId, validTo: MAX_DATE, isDeleted: false } }),
    prisma.account.findFirst({ where: { id: creditAccountId, validTo: MAX_DATE, isDeleted: false } }),
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

  // Update both accounts (using versionId as PK)
  await Promise.all([
    prisma.account.update({
      where: { versionId: debitAccount.versionId },
      data: { currentBalance: newDebitBalance },
    }),
    prisma.account.update({
      where: { versionId: creditAccount.versionId },
      data: { currentBalance: newCreditBalance },
    }),
  ]);

  return { newDebitBalance, newCreditBalance };
}
