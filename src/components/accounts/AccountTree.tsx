'use client';

import { useEffect, useState } from 'react';
import { AccountTreeNode, buildAccountTree } from '@/lib/utils/account-tree';
import { AccountTreeNodeComponent } from './AccountTreeNode';
import { Account } from '@prisma/client';

interface AccountTreeProps {
  organizationSlug: string;
}

export function AccountTree({ organizationSlug }: AccountTreeProps) {
  const [accounts, setAccounts] = useState<AccountTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/organizations/${organizationSlug}/accounts`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch accounts');
        }

        const data: Account[] = await response.json();
        const tree = buildAccountTree(data);
        setAccounts(tree);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchAccounts();
  }, [organizationSlug]);

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading accounts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <p className="font-semibold">Error loading accounts</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="py-12 text-center text-gray-500">
          <p>No accounts found.</p>
          <p className="mt-2 text-sm">
            Create your first account to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Chart of Accounts
        </h2>
        <span className="text-sm text-gray-500">
          {accounts.length} root account{accounts.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {accounts.map((account) => (
          <AccountTreeNodeComponent key={account.id} node={account} />
        ))}
      </div>
    </div>
  );
}
