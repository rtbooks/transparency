"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatTransactionAmount } from "@/lib/utils/account-tree";
import { ChevronLeft, ChevronRight, Download, Search, Info, Pencil, Ban, MoreVertical, CalendarClock, Eye, CheckCircle2, X } from "lucide-react";
import { format, subDays, subMonths, startOfDay } from "date-fns";
import { EditTransactionForm } from "./EditTransactionForm";
import { VoidTransactionDialog } from "./VoidTransactionDialog";
import { AttachmentSection } from "@/components/attachments/AttachmentSection";

interface TransactionWithAccounts extends Transaction {
  debitAccount: Pick<Account, "id" | "code" | "name" | "type">;
  creditAccount: Pick<Account, "id" | "code" | "name" | "type">;
  contact?: { id: string; name: string; type: string; roles: string[] } | null;
}

interface TransactionListProps {
  organizationSlug: string;
  refreshKey?: number;
  initialAccountId?: string;
}

type PeriodKey = "30d" | "60d" | "90d" | "6m" | "12m" | "ytd" | "all" | "custom";

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "60d", label: "Last 60 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom dates" },
];

function computePeriodDates(period: PeriodKey): { start: string; end: string } {
  const today = startOfDay(new Date());
  const end = format(today, "yyyy-MM-dd");
  switch (period) {
    case "30d":
      return { start: format(subDays(today, 30), "yyyy-MM-dd"), end };
    case "60d":
      return { start: format(subDays(today, 60), "yyyy-MM-dd"), end };
    case "90d":
      return { start: format(subDays(today, 90), "yyyy-MM-dd"), end };
    case "6m":
      return { start: format(subMonths(today, 6), "yyyy-MM-dd"), end };
    case "12m":
      return { start: format(subMonths(today, 12), "yyyy-MM-dd"), end };
    case "ytd":
      return { start: `${today.getFullYear()}-01-01`, end };
    case "all":
      return { start: "", end: "" };
    case "custom":
      return { start: "", end: "" };
  }
}

export function TransactionList({ organizationSlug, refreshKey, initialAccountId }: TransactionListProps) {
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
  const [accountFilter, setAccountFilter] = useState<string>(initialAccountId || "all");
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [asOfDate, setAsOfDate] = useState<Date | undefined>(undefined);
  const [showVoided, setShowVoided] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Compute effective start/end dates from period selection
  const { startDate, endDate } = useMemo(() => {
    if (period === "custom") {
      return { startDate: customStartDate, endDate: customEndDate };
    }
    const { start, end } = computePeriodDates(period);
    return { startDate: start, endDate: end };
  }, [period, customStartDate, customEndDate]);

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
      if (accountFilter && accountFilter !== "all") {
        params.append("accountId", accountFilter);
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
  }, [page, typeFilter, accountFilter, startDate, endDate, asOfDate, showVoided, refreshKey]);

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
      if (accountFilter && accountFilter !== "all") {
        params.append("accountId", accountFilter);
      }

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

  // Fetch accounts on mount for filter dropdown and edit forms
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleEditClick = async (transaction: TransactionWithAccounts) => {
    setSelectedTransaction(null);
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
      CLOSING: { variant: "outline", label: "Closing" },
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
              <SelectItem value="CLOSING">Closing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[170px]">
          <label className="mb-2 block text-sm font-medium text-gray-700">Period</label>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[200px]">
          <label className="mb-2 block text-sm font-medium text-gray-700">Account</label>
          <div className="flex items-center gap-1">
            <Select value={accountFilter} onValueChange={(v) => { setAccountFilter(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map((acct) => (
                  <SelectItem key={acct.id} value={acct.id}>
                    {acct.code} — {acct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accountFilter !== "all" && (
              <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={() => { setAccountFilter("all"); setPage(1); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {period === "custom" && (
          <>
            <div className="min-w-[150px]">
              <label className="mb-2 block text-sm font-medium text-gray-700">Start Date</label>
              <Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
            </div>
            <div className="min-w-[150px]">
              <label className="mb-2 block text-sm font-medium text-gray-700">End Date</label>
              <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
            </div>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setShowMoreOptions((prev) => !prev);
              }}
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              As of date
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setShowVoided((prev) => !prev);
              }}
            >
              <Eye className="mr-2 h-4 w-4" />
              {showVoided ? "Hide voided" : "Show voided"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* As Of Date picker (shown when toggled from menu) */}
      {showMoreOptions && (
        <div className="flex items-end gap-4 rounded-lg border bg-white p-4">
          <div className="min-w-[200px]">
            <label className="mb-2 block text-sm font-medium text-gray-700">As Of Date</label>
            <AsOfDatePicker
              date={asOfDate}
              onDateChange={setAsOfDate}
              maxDate={new Date()}
              className="w-full"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setAsOfDate(undefined);
              setShowMoreOptions(false);
            }}
          >
            Clear &amp; close
          </Button>
        </div>
      )}

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
                      {!transaction.isVoided && transaction.reconciled && (
                        <Badge variant="outline" className="border-green-300 bg-green-50 text-xs text-green-700">
                          <CheckCircle2 className="mr-1 h-3 w-3" />Reconciled
                        </Badge>
                      )}
                      {!transaction.isVoided && !transaction.reconciled && transaction.previousVersionId && (
                        <Badge variant="outline" className="text-xs">Edited</Badge>
                      )}
                      {!transaction.isVoided && !transaction.reconciled && !transaction.previousVersionId && (
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
                    {formatTransactionAmount(transaction.amount, transaction.type, transaction.creditAccount.type)}
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
                    {!selectedTransaction.isVoided && selectedTransaction.reconciled && (
                      <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">
                        <CheckCircle2 className="mr-1 h-3 w-3" />Reconciled
                      </Badge>
                    )}
                    {!selectedTransaction.isVoided && selectedTransaction.previousVersionId && (
                      <Badge variant="outline">Edited</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Amount</label>
                  <div className={`mt-1 text-lg font-semibold ${selectedTransaction.isVoided ? 'line-through text-gray-400' : ''}`}>
                    {formatTransactionAmount(selectedTransaction.amount, selectedTransaction.type, selectedTransaction.creditAccount.type)}
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

              {selectedTransaction.reconciled && selectedTransaction.reconciledAt && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <label className="text-sm font-medium text-green-700">Reconciled</label>
                  <div className="mt-1 text-sm text-green-900">
                    This transaction was reconciled on {new Date(selectedTransaction.reconciledAt).toLocaleDateString()}.
                    Reconciled transactions cannot be edited or voided.
                  </div>
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

              {/* Attachments */}
              <AttachmentSection
                organizationSlug={organizationSlug}
                entityType="TRANSACTION"
                entityId={selectedTransaction.id}
                readOnly={selectedTransaction.isVoided || selectedTransaction.reconciled}
              />

              {/* Edit/Void action buttons - only for non-voided, non-reconciled transactions */}
              {!selectedTransaction.isVoided && !selectedTransaction.reconciled && (
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
