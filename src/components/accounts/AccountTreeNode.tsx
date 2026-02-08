'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { AccountTreeNode } from '@/lib/utils/account-tree';
import { formatCurrency, getAccountTypeInfo } from '@/lib/utils/account-tree';

interface AccountTreeNodeProps {
  node: AccountTreeNode;
  level?: number;
}

export function AccountTreeNodeComponent({
  node,
  level = 0,
}: AccountTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const hasChildren = node.children.length > 0;
  const typeInfo = getAccountTypeInfo(node.type);

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
            />
          ))}
        </div>
      )}
    </div>
  );
}
