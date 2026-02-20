/**
 * Transaction types and utilities for double-entry bookkeeping
 */

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'GENERAL';

export interface TransactionFormData {
  type: TransactionType;
  date: Date;
  amount: number;
  description: string;
  referenceNumber?: string;
  
  // For INCOME, EXPENSE, TRANSFER
  fromAccountId?: string; // Credit account (source of funds)
  toAccountId?: string;   // Debit account (destination of funds)
  
  // For GENERAL journal entries
  debitAccountId?: string;
  creditAccountId?: string;
}

/**
 * Helper to determine account types for transaction type
 */
export function getAccountTypesForTransaction(type: TransactionType): {
  fromTypes: string[];
  toTypes: string[];
  fromLabel: string;
  toLabel: string;
} {
  switch (type) {
    case 'INCOME':
      return {
        fromTypes: ['REVENUE'],
        toTypes: ['ASSET'],
        fromLabel: 'Revenue Account',
        toLabel: 'Deposit To (Cash/Bank)',
      };
    case 'EXPENSE':
      return {
        fromTypes: ['ASSET'],
        toTypes: ['EXPENSE'],
        fromLabel: 'Pay From (Cash/Bank)',
        toLabel: 'Expense Account',
      };
    case 'TRANSFER':
      return {
        fromTypes: ['ASSET'],
        toTypes: ['ASSET'],
        fromLabel: 'Transfer From',
        toLabel: 'Transfer To',
      };
    case 'GENERAL':
      return {
        fromTypes: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
        toTypes: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
        fromLabel: 'Credit Account (Source)',
        toLabel: 'Debit Account (Destination)',
      };
  }
}

/**
 * Validate transaction based on accounting rules
 */
export function validateTransaction(data: TransactionFormData): string | null {
  if (data.amount <= 0) {
    return 'Amount must be greater than zero';
  }

  if (data.type === 'TRANSFER' && data.fromAccountId === data.toAccountId) {
    return 'Cannot transfer to the same account';
  }

  if (data.type === 'GENERAL' && data.fromAccountId === data.toAccountId) {
    return 'Debit and credit accounts must be different';
  }

  return null;
}

/**
 * Convert transaction form data to API payload
 */
export function prepareTransactionPayload(data: TransactionFormData) {
  let debitAccountId: string;
  let creditAccountId: string;

  switch (data.type) {
    case 'INCOME':
      debitAccountId = data.toAccountId!; // Asset increases (debit)
      creditAccountId = data.fromAccountId!; // Revenue increases (credit)
      break;
    case 'EXPENSE':
      debitAccountId = data.toAccountId!; // Expense increases (debit)
      creditAccountId = data.fromAccountId!; // Asset decreases (credit)
      break;
    case 'TRANSFER':
      debitAccountId = data.toAccountId!; // Destination asset increases (debit)
      creditAccountId = data.fromAccountId!; // Source asset decreases (credit)
      break;
    case 'GENERAL':
      debitAccountId = data.toAccountId!;   // "Debit Account (Destination)"
      creditAccountId = data.fromAccountId!; // "Credit Account (Source)"
      break;
  }

  return {
    date: data.date.toISOString(),
    amount: data.amount,
    description: data.description,
    referenceNumber: data.referenceNumber || null,
    debitAccountId,
    creditAccountId,
  };
}
