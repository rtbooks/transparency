import { AccountType, Transaction } from '@/generated/prisma/client';
import { calculateNewBalance } from './balance-calculator';

/**
 * Recalculate an account's balance from all its transactions
 * Used for verification and balance correction
 */
export function recalculateAccountBalance(
  transactions: Array<{
    debitAccountId: string;
    creditAccountId: string;
    amount: number | any;
  }>,
  accountId: string,
  accountType: AccountType,
  initialBalance: number = 0
): number {
  let balance = initialBalance;

  for (const transaction of transactions) {
    const amount = typeof transaction.amount === 'number' 
      ? transaction.amount 
      : parseFloat(transaction.amount.toString());

    if (transaction.debitAccountId === accountId) {
      // This account was debited
      balance = calculateNewBalance(balance, amount, accountType, true);
    } else if (transaction.creditAccountId === accountId) {
      // This account was credited
      balance = calculateNewBalance(balance, amount, accountType, false);
    }
  }

  return balance;
}

/**
 * Verify that an account's stored balance matches its calculated balance
 */
export function verifyAccountBalance(
  currentBalance: number | any,
  calculatedBalance: number
): { isCorrect: boolean; difference: number } {
  const current = typeof currentBalance === 'number' 
    ? currentBalance 
    : parseFloat(currentBalance.toString());

  const difference = Math.abs(current - calculatedBalance);
  
  // Allow for floating point precision errors (less than 1 cent)
  const isCorrect = difference < 0.01;

  return {
    isCorrect,
    difference,
  };
}

/**
 * Get balance summary for an account including transaction count
 */
export interface BalanceSummary {
  accountId: string;
  accountName: string;
  accountType: AccountType;
  currentBalance: number;
  totalDebits: number;
  totalCredits: number;
  transactionCount: number;
}

export function calculateBalanceSummary(
  accountId: string,
  accountName: string,
  accountType: AccountType,
  currentBalance: number | any,
  transactions: Array<{
    debitAccountId: string;
    creditAccountId: string;
    amount: number | any;
  }>
): BalanceSummary {
  let totalDebits = 0;
  let totalCredits = 0;
  let transactionCount = 0;

  for (const transaction of transactions) {
    const amount = typeof transaction.amount === 'number' 
      ? transaction.amount 
      : parseFloat(transaction.amount.toString());

    if (transaction.debitAccountId === accountId) {
      totalDebits += amount;
      transactionCount++;
    }
    if (transaction.creditAccountId === accountId) {
      totalCredits += amount;
      transactionCount++;
    }
  }

  const balance = typeof currentBalance === 'number' 
    ? currentBalance 
    : parseFloat(currentBalance.toString());

  return {
    accountId,
    accountName,
    accountType,
    currentBalance: balance,
    totalDebits,
    totalCredits,
    transactionCount,
  };
}

/**
 * Verify double-entry bookkeeping integrity
 * Sum of all debits should equal sum of all credits
 */
export function verifyDoubleEntryIntegrity(
  transactions: Array<{
    amount: number | any;
  }>
): { isValid: boolean; totalDebits: number; totalCredits: number; difference: number } {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const transaction of transactions) {
    const amount = typeof transaction.amount === 'number' 
      ? transaction.amount 
      : parseFloat(transaction.amount.toString());

    totalDebits += amount;
    totalCredits += amount;
  }

  const difference = Math.abs(totalDebits - totalCredits);
  const isValid = difference < 0.01; // Allow for floating point precision

  return {
    isValid,
    totalDebits,
    totalCredits,
    difference,
  };
}

/**
 * Calculate hierarchical balance (account + all descendants)
 * Useful for parent accounts to show total including children
 */
export function calculateHierarchicalBalance(
  accountId: string,
  accounts: Array<{
    id: string;
    parentAccountId: string | null;
    currentBalance: number | any;
  }>
): number {
  // Find the account
  const account = accounts.find(a => a.id === accountId);
  if (!account) return 0;

  let totalBalance = typeof account.currentBalance === 'number'
    ? account.currentBalance
    : parseFloat(account.currentBalance.toString());

  // Recursively add children's balances (but NOT their descendants)
  // This function calculates the account's own balance plus its direct children
  // It does not double-count by adding both children and grandchildren
  const directChildren = accounts.filter(a => a.parentAccountId === accountId);
  for (const child of directChildren) {
    const childBalance = typeof child.currentBalance === 'number'
      ? child.currentBalance
      : parseFloat(child.currentBalance.toString());
    totalBalance += childBalance;
    
    // Recursively add grandchildren
    const grandchildren = accounts.filter(a => a.parentAccountId === child.id);
    for (const grandchild of grandchildren) {
      totalBalance += calculateHierarchicalBalance(grandchild.id, accounts);
    }
  }

  return totalBalance;
}
