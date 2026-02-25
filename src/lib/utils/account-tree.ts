import { Account } from '@/generated/prisma/client';

export interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
}

/**
 * Builds a hierarchical tree structure from a flat array of accounts
 */
export function buildAccountTree(accounts: Account[]): AccountTreeNode[] {
  // Create a map for quick lookup
  const accountMap = new Map<string, AccountTreeNode>();
  const rootAccounts: AccountTreeNode[] = [];

  // Initialize all accounts with empty children arrays
  accounts.forEach((account) => {
    accountMap.set(account.id, { ...account, children: [] });
  });

  // Build the tree structure
  accounts.forEach((account) => {
    const node = accountMap.get(account.id)!;

    if (account.parentAccountId) {
      const parent = accountMap.get(account.parentAccountId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        rootAccounts.push(node);
      }
    } else {
      // No parent, this is a root account
      rootAccounts.push(node);
    }
  });

  // Sort children and root accounts by code
  for (const node of accountMap.values()) {
    node.children.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }
  rootAccounts.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return rootAccounts;
}

/**
 * Formats currency for display
 */
export function formatCurrency(amount: number | string | { toString(): string }): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : typeof amount === 'number' ? amount : parseFloat(amount.toString());
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numAmount);
}

/**
 * Detects the reimbursement pattern: an EXPENSE transaction that credits an
 * expense account (reducing the expense rather than incurring one).
 */
export function isReimbursementTransaction(
  type: string,
  creditAccountType?: string,
): boolean {
  return type === 'EXPENSE' && creditAccountType === 'EXPENSE';
}

/**
 * Formats a transaction amount for display, showing reimbursements as negative
 * using accounting parenthesis notation.
 */
export function formatTransactionAmount(
  amount: number | string | { toString(): string },
  type: string,
  creditAccountType?: string,
): string {
  const formatted = formatCurrency(amount);
  if (isReimbursementTransaction(type, creditAccountType)) {
    return `(${formatted})`;
  }
  return formatted;
}

/**
 * Gets icon or color for account type
 */
export function getAccountTypeInfo(type: string): {
  label: string;
  color: string;
} {
  switch (type) {
    case 'ASSET':
      return { label: 'Asset', color: 'text-green-600' };
    case 'LIABILITY':
      return { label: 'Liability', color: 'text-red-600' };
    case 'EQUITY':
      return { label: 'Equity', color: 'text-blue-600' };
    case 'REVENUE':
      return { label: 'Revenue', color: 'text-emerald-600' };
    case 'EXPENSE':
      return { label: 'Expense', color: 'text-orange-600' };
    default:
      return { label: type, color: 'text-gray-600' };
  }
}
