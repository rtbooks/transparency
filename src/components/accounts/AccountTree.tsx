'use client';

import { useEffect, useState } from 'react';
import { AccountTreeNode, buildAccountTree } from '@/lib/utils/account-tree';
import { AccountTreeNodeComponent } from './AccountTreeNode';
import { Account } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CreateAccountForm } from '@/components/forms/CreateAccountForm';
import { ApplyTemplateDialog } from './ApplyTemplateDialog';
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
  const [showInactive, setShowInactive] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/organizations/${organizationSlug}/accounts?includeInactive=true`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const data: Account[] = await response.json();
      setFlatAccounts(data);
      
      // Filter based on showInactive toggle
      const filteredAccounts = showInactive ? data : data.filter(a => a.isActive);
      const tree = buildAccountTree(filteredAccounts);
      setAccounts(tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [organizationSlug, showInactive]);

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
        <div className="flex items-center gap-4">
          {/* Show Inactive Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive" className="text-sm text-gray-600 cursor-pointer">
              Show inactive
            </Label>
          </div>
          
          {/* Use Template Button (only if no accounts) */}
          <ApplyTemplateDialog
            organizationSlug={organizationSlug}
            hasExistingAccounts={flatAccounts.length > 0}
            onSuccess={fetchAccounts}
          />
          
          {/* Add Account Button */}
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
              <AccountTreeNodeComponent 
                key={account.id} 
                node={account}
                organizationSlug={organizationSlug}
                allAccounts={flatAccounts.map(a => ({
                  id: a.id,
                  code: a.code,
                  name: a.name,
                  type: a.type,
                  parentAccountId: a.parentAccountId
                }))}
                onAccountUpdated={fetchAccounts}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
