'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Edit } from 'lucide-react';
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
import { EditAccountForm } from '@/components/forms/EditAccountForm';

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
  const hasChildren = node.children.length > 0;
  const typeInfo = getAccountTypeInfo(node.type);

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    if (onAccountUpdated) {
      onAccountUpdated();
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
