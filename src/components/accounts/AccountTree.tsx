'use client';

import { useEffect, useState } from 'react';
import { AccountTreeNode, buildAccountTree } from '@/lib/utils/account-tree';
import { AccountTreeNodeComponent } from './AccountTreeNode';
import { Account } from '@prisma/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CreateAccountForm } from '@/components/forms/CreateAccountForm';
import { Plus } from 'lucide-react';

interface AccountTreeProps {
  organizationSlug: string;
}

export function AccountTree({ organizationSlug }: AccountTreeProps) {
  const [accounts, setAccounts] = useState<AccountTreeNode[]>([]);
  const [flatAccounts, setFlatAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/organizations/${organizationSlug}/accounts`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const data: Account[] = await response.json();
      setFlatAccounts(data);
      const tree = buildAccountTree(data);
      setAccounts(tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [organizationSlug]);

  const handleSuccess = () => {
    setDialogOpen(false);
    fetchAccounts();
  };

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

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Chart of Accounts
        </h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Account</DialogTitle>
              <DialogDescription>
                Add a new account to your chart of accounts.
              </DialogDescription>
            </DialogHeader>
            <CreateAccountForm
              organizationSlug={organizationSlug}
              accounts={flatAccounts.map(a => ({
                id: a.id,
                code: a.code,
                name: a.name,
                type: a.type,
                parentAccountId: a.parentAccountId
              }))}
              onSuccess={handleSuccess}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <p>No accounts found.</p>
          <p className="mt-2 text-sm">
            Create your first account to get started.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2 text-sm text-gray-500">
            {accounts.length} root account{accounts.length !== 1 ? 's' : ''}
          </div>
          <div className="space-y-2">
            {accounts.map((account) => (
              <AccountTreeNodeComponent key={account.id} node={account} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
