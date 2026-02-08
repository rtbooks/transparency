import { Account } from '@prisma/client';

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

  return rootAccounts;
}

/**
 * Formats currency for display
 */
export function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(numAmount);
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
