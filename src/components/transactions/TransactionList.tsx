"use client";

import { useEffect, useState, useCallback } from "react";
import { Transaction, Account } from "@/generated/prisma/client";
import { AsOfDatePicker } from "@/components/temporal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/utils/account-tree";
import { ChevronLeft, ChevronRight, Download, Search, Info, Pencil, Ban } from "lucide-react";
import { format } from "date-fns";
import { EditTransactionForm } from "./EditTransactionForm";
import { VoidTransactionDialog } from "./VoidTransactionDialog";

interface TransactionWithAccounts extends Transaction {
  debitAccount: Pick<Account, "id" | "code" | "name" | "type">;
  creditAccount: Pick<Account, "id" | "code" | "name" | "type">;
  contact?: { id: string; name: string; type: string; roles: string[] } | null;
}

interface TransactionListProps {
  organizationSlug: string;
  refreshKey?: number;
}

export function TransactionList({ organizationSlug, refreshKey }: TransactionListProps) {
  const [transactions, setTransactions] = useState<TransactionWithAccounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithAccounts | null>(
    null
  );

  // Edit/Void state
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithAccounts | null>(null);
  const [voidingTransaction, setVoidingTransaction] = useState<TransactionWithAccounts | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; code: string; name: string; type: string }>>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [asOfDate, setAsOfDate] = useState<Date | undefined>(undefined);
  const [showVoided, setShowVoided] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 25;

  // Temporal context from API
  const [temporalContext, setTemporalContext] = useState<{
    asOfDate: string;
    isHistoricalView: boolean;
  } | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (typeFilter && typeFilter !== "all") {
        params.append("type", typeFilter);
      }
      if (search) {
        params.append("search", search);
      }
      if (startDate) {
        params.append("startDate", startDate);
      }
      if (endDate) {
        params.append("endDate", endDate);
      }
      if (asOfDate) {
        params.append("asOfDate", asOfDate.toISOString());
      }
      if (showVoided) {
        params.append("includeVoided", "true");
      }

      const response = await fetch(
        `/api/organizations/${organizationSlug}/transactions?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data = await response.json();
      setTransactions(data.transactions);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.totalCount);
      setTemporalContext(data.temporalContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, typeFilter, startDate, endDate, asOfDate, showVoided, refreshKey]); // refreshKey triggers re-fetch after a new transaction is recorded

  const handleSearch = () => {
    setPage(1); // Reset to first page
    fetchTransactions();
  };

  const handleExportCSV = async () => {
    try {
      // Fetch all transactions without pagination
      const params = new URLSearchParams();
      if (typeFilter && typeFilter !== "all") {
        params.append("type", typeFilter);
      }
      if (search) {
        params.append("search", search);
      }
      if (startDate) {
        params.append("startDate", startDate);
      }
      if (endDate) {
        params.append("endDate", endDate);
      }
      params.append("limit", "10000"); // Large limit for export

      const response = await fetch(
        `/api/organizations/${organizationSlug}/transactions?${params.toString()}`
      );
      const data = await response.json();

      // Generate CSV
      const headers = [
        "Date",
        "Type",
        "Debit Account",
        "Credit Account",
        "Amount",
        "Description",
        "Reference Number",
      ];

      const csvRows = [
        headers.join(","),
        ...data.transactions.map((t: TransactionWithAccounts) =>
          [
            new Date(t.transactionDate).toLocaleDateString(),
            t.type,
            `"${t.debitAccount.code} - ${t.debitAccount.name}"`,
            `"${t.creditAccount.code} - ${t.creditAccount.name}"`,
            t.amount,
            `"${t.description}"`,
            t.referenceNumber || "",
          ].join(",")
        ),
      ];

      // Download
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch(`/api/organizations/${organizationSlug}/accounts`);
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || data);
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    }
  }, [organizationSlug]);

  const handleEditClick = async (transaction: TransactionWithAccounts) => {
    setSelectedTransaction(null);
    if (accounts.length === 0) {
      await fetchAccounts();
    }
    setEditingTransaction(transaction);
  };

  const handleVoidClick = (transaction: TransactionWithAccounts) => {
    setSelectedTransaction(null);
    setVoidingTransaction(transaction);
  };

  const handleEditSuccess = () => {
    setEditingTransaction(null);
    fetchTransactions();
  };

  const handleVoidSuccess = () => {
    setVoidingTransaction(null);
    fetchTransactions();
  };

  const getTransactionTypeBadge = (type: string) => {
    const variants: Record<
      string,
      { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
    > = {
      INCOME: { variant: "default", label: "Income" },
      EXPENSE: { variant: "destructive", label: "Expense" },
      TRANSFER: { variant: "secondary", label: "Transfer" },
    };
    const config = variants[type] || { variant: "outline", label: type };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading transactions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-white p-4">
        <div className="min-w-[200px] flex-1">
          <label className="mb-2 block text-sm font-medium text-gray-700">Search</label>
          <div className="flex gap-2">
            <Input
              placeholder="Description or reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} size="sm">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-w-[150px]">
          <label className="mb-2 block text-sm font-medium text-gray-700">Type</label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="INCOME">Income</SelectItem>
              <SelectItem value="EXPENSE">Expense</SelectItem>
              <SelectItem value="TRANSFER">Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[150px]">
          <label className="mb-2 block text-sm font-medium text-gray-700">Start Date</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>

        <div className="min-w-[150px]">
          <label className="mb-2 block text-sm font-medium text-gray-700">End Date</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div className="min-w-[200px]">
          <label className="mb-2 block text-sm font-medium text-gray-700">As Of Date</label>
          <AsOfDatePicker
            date={asOfDate}
            onDateChange={setAsOfDate}
            maxDate={new Date()}
            className="w-full"
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="show-voided"
            checked={showVoided}
            onCheckedChange={setShowVoided}
          />
          <label htmlFor="show-voided" className="text-sm text-gray-700">
            Show voided
          </label>
        </div>

        <Button onClick={handleExportCSV} variant="outline" size="sm" className="ml-auto">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Temporal Context Banner */}
      {temporalContext && temporalContext.isHistoricalView && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            <div className="flex items-center justify-between">
              <span>
                <strong>
                  Viewing transactions as of {format(new Date(temporalContext.asOfDate), "PPP")}.
                </strong>{" "}
                Account names are shown as they were at that time.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAsOfDate(undefined)}
                className="ml-4"
              >
                View Current State
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Transaction Count */}
      <div className="text-sm text-gray-600">
        Showing {transactions.length} of {totalCount} transactions
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Debit Account</TableHead>
              <TableHead>Credit Account</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-gray-500">
                  No transactions found. Record your first transaction to get started.
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => (
                <TableRow
                  key={transaction.versionId || transaction.id}
                  className={`cursor-pointer hover:bg-gray-50 ${transaction.isVoided ? 'opacity-50' : ''}`}
                  onClick={() => setSelectedTransaction(transaction)}
                >
                  <TableCell className={`font-medium ${transaction.isVoided ? 'line-through' : ''}`}>
                    {new Date(transaction.transactionDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{getTransactionTypeBadge(transaction.type)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {transaction.isVoided && (
                        <Badge variant="destructive" className="text-xs">Voided</Badge>
                      )}
                      {!transaction.isVoided && transaction.previousVersionId && (
                        <Badge variant="outline" className="text-xs">Edited</Badge>
                      )}
                      {!transaction.isVoided && !transaction.previousVersionId && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {transaction.debitAccount.code}
                      </div>
                      <div className="text-gray-500">{transaction.debitAccount.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {transaction.creditAccount.code}
                      </div>
                      <div className="text-gray-500">{transaction.creditAccount.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-gray-900">
                    {formatCurrency(transaction.amount)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {transaction.contact?.name || "—"}
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {transaction.referenceNumber || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Transaction Detail Dialog */}
      <Dialog
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              {selectedTransaction &&
                new Date(selectedTransaction.transactionDate).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Type</label>
                  <div className="mt-1 flex items-center gap-2">
                    {getTransactionTypeBadge(selectedTransaction.type)}
                    {selectedTransaction.isVoided && (
                      <Badge variant="destructive">Voided</Badge>
                    )}
                    {!selectedTransaction.isVoided && selectedTransaction.previousVersionId && (
                      <Badge variant="outline">Edited</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Amount</label>
                  <div className={`mt-1 text-lg font-semibold ${selectedTransaction.isVoided ? 'line-through text-gray-400' : ''}`}>
                    {formatCurrency(selectedTransaction.amount)}
                  </div>
                </div>
              </div>

              {selectedTransaction.isVoided && selectedTransaction.voidReason && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <label className="text-sm font-medium text-red-700">Void Reason</label>
                  <div className="mt-1 text-sm text-red-900">{selectedTransaction.voidReason}</div>
                </div>
              )}

              {selectedTransaction.changeReason && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <label className="text-sm font-medium text-blue-700">Edit Reason</label>
                  <div className="mt-1 text-sm text-blue-900">{selectedTransaction.changeReason}</div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Debit Account</label>
                <div className="mt-1 rounded-lg border bg-gray-50 p-3">
                  <div className="font-mono text-sm font-medium">
                    {selectedTransaction.debitAccount.code}
                  </div>
                  <div className="text-gray-900">{selectedTransaction.debitAccount.name}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {selectedTransaction.debitAccount.type}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Credit Account</label>
                <div className="mt-1 rounded-lg border bg-gray-50 p-3">
                  <div className="font-mono text-sm font-medium">
                    {selectedTransaction.creditAccount.code}
                  </div>
                  <div className="text-gray-900">{selectedTransaction.creditAccount.name}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {selectedTransaction.creditAccount.type}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <div className="mt-1 rounded-lg border bg-gray-50 p-3">
                  {selectedTransaction.description}
                </div>
              </div>

              {selectedTransaction.referenceNumber && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Reference Number</label>
                  <div className="mt-1 rounded-lg border bg-gray-50 p-3 font-mono text-sm">
                    {selectedTransaction.referenceNumber}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                <div>
                  <span className="font-medium">Created:</span>{" "}
                  {new Date(selectedTransaction.createdAt).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">ID:</span> {selectedTransaction.id.slice(0, 8)}...
                </div>
              </div>

              {/* Edit/Void action buttons - only for non-voided transactions */}
              {!selectedTransaction.isVoided && (
                <div className="flex gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditClick(selectedTransaction)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Transaction
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleVoidClick(selectedTransaction)}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Void Transaction
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Update the transaction details. All changes are tracked with full audit history.
            </DialogDescription>
          </DialogHeader>
          {editingTransaction && (
            <EditTransactionForm
              organizationSlug={organizationSlug}
              transaction={editingTransaction}
              accounts={accounts}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingTransaction(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Void Transaction Dialog */}
      {voidingTransaction && (
        <VoidTransactionDialog
          open={!!voidingTransaction}
          onOpenChange={(open) => !open && setVoidingTransaction(null)}
          organizationSlug={organizationSlug}
          transaction={voidingTransaction}
          onSuccess={handleVoidSuccess}
        />
      )}
    </div>
  );
}
