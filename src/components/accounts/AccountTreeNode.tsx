'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Edit, Power, PowerOff } from 'lucide-react';
import { AccountTreeNode } from '@/lib/utils/account-tree';
import { formatCurrency, getAccountTypeInfo } from '@/lib/utils/account-tree';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { EditAccountForm } from '@/components/forms/EditAccountForm';
import { useToast } from '@/components/ui/use-toast';

interface AccountTreeNodeProps {
  node: AccountTreeNode;
  level?: number;
  organizationSlug: string;
  allAccounts: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    parentAccountId?: string | null;
  }>;
  onAccountUpdated?: () => void;
}

export function AccountTreeNodeComponent({
  node,
  level = 0,
  organizationSlug,
  allAccounts,
  onAccountUpdated,
}: AccountTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const { toast } = useToast();
  const hasChildren = node.children.length > 0;
  const typeInfo = getAccountTypeInfo(node.type);

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    if (onAccountUpdated) {
      onAccountUpdated();
    }
  };

  const handleToggleActive = async () => {
    setIsToggling(true);
    try {
      const response = await fetch(
        `/api/organizations/${organizationSlug}/accounts/${node.id}/toggle-active`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle account status');
      }

      toast({
        title: node.isActive ? 'Account Deactivated' : 'Account Activated',
        description: `${node.code} - ${node.name} has been ${node.isActive ? 'deactivated' : 'activated'}.`,
      });

      if (onAccountUpdated) {
        onAccountUpdated();
      }
    } catch (error) {
      console.error('Error toggling account:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to toggle account status',
      });
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50 ${
          level > 0 ? 'ml-6' : ''
        }`}
      >
        <div className="flex flex-1 items-center gap-3">
          {/* Expand/Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex h-6 w-6 items-center justify-center rounded ${
              hasChildren
                ? 'hover:bg-gray-200'
                : 'invisible'
            }`}
            disabled={!hasChildren}
          >
            {hasChildren && (
              isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-600" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-600" />
              )
            )}
          </button>

          {/* Account Code */}
          <span className="min-w-[80px] font-mono text-sm font-medium text-gray-900">
            {node.code}
          </span>

          {/* Account Name */}
          <span className="flex-1 text-sm font-medium text-gray-900">
            {node.name}
          </span>

          {/* Account Type */}
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${typeInfo.color} bg-gray-100`}
          >
            {typeInfo.label}
          </span>

          {/* Balance */}
          <span
            className={`min-w-[120px] text-right text-sm font-semibold ${
              Number(node.currentBalance) >= 0
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {formatCurrency(node.currentBalance)}
          </span>

          {/* Edit Button */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Edit className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Account</DialogTitle>
                <DialogDescription>
                  Update account details. Changes will be reflected immediately.
                </DialogDescription>
              </DialogHeader>
              <EditAccountForm
                organizationSlug={organizationSlug}
                account={{
                  id: node.id,
                  code: node.code,
                  name: node.name,
                  type: node.type,
                  parentAccountId: node.parentAccountId,
                  description: node.description,
                }}
                accounts={allAccounts}
                onSuccess={handleEditSuccess}
                onCancel={() => setEditDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>

          {/* Toggle Active/Inactive Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                disabled={isToggling}
              >
                {node.isActive ? (
                  <Power className="h-4 w-4 text-green-600" />
                ) : (
                  <PowerOff className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {node.isActive ? 'Deactivate' : 'Activate'} Account?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {node.isActive ? (
                    <>
                      Deactivating this account will hide it from the account tree.
                      It will no longer be available for new transactions, but
                      existing transactions will remain intact.
                    </>
                  ) : (
                    <>
                      Activating this account will make it visible in the account
                      tree and available for new transactions.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleToggleActive}>
                  {node.isActive ? 'Deactivate' : 'Activate'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-2 space-y-2">
          {node.children.map((child) => (
            <AccountTreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              organizationSlug={organizationSlug}
              allAccounts={allAccounts}
              onAccountUpdated={onAccountUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
