"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatTransactionAmount } from "@/lib/utils/account-tree";

interface ContactTransaction {
  id: string;
  transactionDate: string;
  amount: number | string;
  type: string;
  description: string;
  referenceNumber: string | null;
  debitAccount: { code: string; name: string; type?: string };
  creditAccount: { code: string; name: string; type?: string };
}

interface ContactTransactionHistoryProps {
  organizationSlug: string;
  contactId: string;
}

export function ContactTransactionHistory({
  organizationSlug,
  contactId,
}: ContactTransactionHistoryProps) {
  const [transactions, setTransactions] = useState<ContactTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/organizations/${organizationSlug}/contacts/${contactId}/transactions?page=${page}&limit=25`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setTransactions(data.transactions);
          setTotal(data.pagination.totalCount);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [organizationSlug, contactId, page]);

  if (loading) {
    return <div className="py-8 text-center text-sm text-gray-500">Loading transactions...</div>;
  }

  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        No transactions linked to this contact.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500">
        {total} transaction{total !== 1 ? "s" : ""} linked to this contact
      </div>
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Debit</TableHead>
              <TableHead>Credit</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="font-medium">
                  {new Date(tx.transactionDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {tx.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {tx.debitAccount.code} - {tx.debitAccount.name}
                </TableCell>
                <TableCell className="text-sm">
                  {tx.creditAccount.code} - {tx.creditAccount.name}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatTransactionAmount(tx.amount, tx.type, tx.creditAccount.type)}
                </TableCell>
                <TableCell className="max-w-xs truncate text-sm">
                  {tx.description}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {total > 25 && (
        <div className="flex justify-center gap-2">
          <button
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-gray-500">
            Page {page} of {Math.ceil(total / 25)}
          </span>
          <button
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            disabled={page >= Math.ceil(total / 25)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
