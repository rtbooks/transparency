'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Edit, Power, PowerOff, AlertTriangle } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

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

  // Fetch projected balance for ASSET accounts
  const [projectedBalance, setProjectedBalance] = useState<number | null>(null);
  useEffect(() => {
    if (node.type !== 'ASSET' || !node.isActive) return;
    async function fetchProjected() {
      try {
        const res = await fetch(
          `/api/organizations/${organizationSlug}/accounts/${node.id}/projected-balance`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.pendingBillCount > 0) {
            setProjectedBalance(data.projectedBalance);
          }
        }
      } catch {
        // Ignore
      }
    }
    fetchProjected();
  }, [node.id, node.type, node.isActive, organizationSlug]);

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
        className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border bg-white p-3 hover:bg-gray-50 sm:grid-cols-[1fr_auto_auto_auto] ${
          level > 0 ? 'ml-6' : ''
        } ${!node.isActive ? 'border-gray-300 bg-gray-50 opacity-60' : 'border-gray-200'}`}
      >
        {/* Left: Chevron + Code + Name */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${
              hasChildren ? 'hover:bg-gray-200' : 'invisible'
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
          <span className="shrink-0 font-mono text-sm font-medium text-gray-900">
            {node.code}
          </span>
          <Link
            href={`/org/${organizationSlug}/transactions?accountId=${node.id}`}
            className={`truncate text-sm font-medium hover:underline ${node.isActive ? 'text-blue-700 hover:text-blue-900' : 'text-gray-500 hover:text-gray-700'}`}
            title="View transactions for this account"
          >
            {node.name}
            {!node.isActive && (
              <span className="ml-1 text-xs text-gray-400">(Inactive)</span>
            )}
          </Link>
        </div>

        {/* Type Badge */}
        <span
          className={`hidden shrink-0 rounded-full px-3 py-1 text-xs font-medium sm:inline-block ${typeInfo.color} bg-gray-100`}
        >
          {typeInfo.label}
        </span>

        {/* Balance Column — stacks balance + projected */}
        <div className="flex flex-col items-end justify-center">
          <span
            className={`whitespace-nowrap text-sm font-semibold ${
              Number(node.currentBalance) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatCurrency(node.currentBalance)}
          </span>
          {projectedBalance !== null && (
            <span
              className={`whitespace-nowrap text-xs ${
                projectedBalance >= 0 ? 'text-blue-600' : 'text-red-600'
              }`}
              title="Projected balance after pending payable bills"
            >
              {projectedBalance < 0 && (
                <AlertTriangle className="mr-0.5 inline h-3 w-3" />
              )}
              Avail: {formatCurrency(projectedBalance)}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex shrink-0 items-center gap-1">
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
