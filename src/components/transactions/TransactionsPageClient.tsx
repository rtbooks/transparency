"use client";

import { useState } from "react";
import { TransactionList } from "./TransactionList";
import { RecordTransactionButton } from "./RecordTransactionButton";

interface TransactionsPageClientProps {
  organizationSlug: string;
  canEdit?: boolean;
}

export function TransactionsPageClient({ organizationSlug, canEdit = true }: TransactionsPageClientProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="mt-2 text-gray-600">
            View, search, and export your organization&apos;s transaction history.
          </p>
        </div>
        {canEdit && (
          <RecordTransactionButton
            organizationSlug={organizationSlug}
            onTransactionCreated={() => setRefreshKey((k) => k + 1)}
          />
        )}
      </div>

      <TransactionList organizationSlug={organizationSlug} refreshKey={refreshKey} />
    </>
  );
}
