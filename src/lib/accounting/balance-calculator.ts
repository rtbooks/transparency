import { AccountType } from '@prisma/client';

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
  // Fetch both accounts
  const [debitAccount, creditAccount] = await Promise.all([
    prisma.account.findUnique({ where: { id: debitAccountId } }),
    prisma.account.findUnique({ where: { id: creditAccountId } }),
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

  // Update both accounts
  await Promise.all([
    prisma.account.update({
      where: { id: debitAccountId },
      data: { currentBalance: newDebitBalance },
    }),
    prisma.account.update({
      where: { id: creditAccountId },
      data: { currentBalance: newCreditBalance },
    }),
  ]);

  return { newDebitBalance, newCreditBalance };
}
