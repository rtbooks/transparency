"use client";

import { useEffect, useState, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { BillDetail } from "./BillDetail";
import { formatCurrency } from "@/lib/utils/account-tree";

interface Bill {
  id: string;
  billNumber: string;
  direction: "PAYABLE" | "RECEIVABLE";
  status: "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
  amount: number;
  amountPaid: number;
  description: string | null;
  category: string | null;
  issueDate: string;
  dueDate: string;
  notes: string | null;
  contact: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface BillListProps {
  organizationSlug: string;
  directionFilter?: "PAYABLE" | "RECEIVABLE";
  refreshKey?: number;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "CANCELLED", label: "Cancelled" },
];

function getStatusBadge(status: Bill["status"]) {
  const config: Record<Bill["status"], { variant: "default" | "secondary" | "outline" | "destructive"; className: string; label: string }> = {
    DRAFT: { variant: "secondary", className: "bg-gray-100 text-gray-700", label: "Draft" },
    PENDING: { variant: "default", className: "bg-blue-100 text-blue-700", label: "Pending" },
    PARTIAL: { variant: "default", className: "bg-yellow-100 text-yellow-700", label: "Partial" },
    PAID: { variant: "default", className: "bg-green-100 text-green-700", label: "Paid" },
    OVERDUE: { variant: "destructive", className: "bg-red-100 text-red-700", label: "Overdue" },
    CANCELLED: { variant: "secondary", className: "bg-gray-100 text-gray-500 line-through", label: "Cancelled" },
  };
  const c = config[status];
  return (
    <Badge variant={c.variant} className={c.className}>
      {c.label}
    </Badge>
  );
}

function getDirectionBadge(direction: Bill["direction"]) {
  return direction === "PAYABLE" ? (
    <Badge variant="outline" className="border-orange-300 text-orange-700">
      Payable
    </Badge>
  ) : (
    <Badge variant="outline" className="border-emerald-300 text-emerald-700">
      Receivable
    </Badge>
  );
}

export function BillList({ organizationSlug, directionFilter, refreshKey }: BillListProps) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 25;

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (directionFilter) {
        params.append("direction", directionFilter);
      }
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (search) {
        params.append("search", search);
      }

      const response = await fetch(
        `/api/organizations/${organizationSlug}/bills?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch bills");
      }

      const data = await response.json();
      setBills(data.bills);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [organizationSlug, page, directionFilter, statusFilter, search]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills, refreshKey]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [directionFilter, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchBills();
  };

  const handleRowClick = (bill: Bill) => {
    setSelectedBill(bill);
  };

  if (loading && bills.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading bills...</div>
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
              placeholder="Bill number, contact, or description..."
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
          <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Count */}
      <div className="text-sm text-gray-600">
        Showing {bills.length} of {totalCount} bills
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill #</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Issue Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-gray-500">
                  No bills found. Create your first bill to get started.
                </TableCell>
              </TableRow>
            ) : (
              bills.map((bill) => (
                <TableRow
                  key={bill.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleRowClick(bill)}
                >
                  <TableCell className="font-medium">{bill.billNumber}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {bill.contact?.name || "—"}
                  </TableCell>
                  <TableCell>{getDirectionBadge(bill.direction)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(bill.amount)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-gray-600">
                    {formatCurrency(bill.amountPaid)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-gray-600">
                    {formatCurrency(
                      (parseFloat(String(bill.amount)) || 0) -
                      (parseFloat(String(bill.amountPaid)) || 0)
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(bill.status)}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {new Date(bill.issueDate).toLocaleDateString()}
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

      {/* Bill Detail Dialog */}
      <Dialog
        open={!!selectedBill}
        onOpenChange={(open) => !open && setSelectedBill(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bill Details</DialogTitle>
            <DialogDescription>
              {selectedBill?.billNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedBill && (
            <BillDetail
              organizationSlug={organizationSlug}
              bill={selectedBill}
              onClose={() => setSelectedBill(null)}
              onRefresh={() => {
                setSelectedBill(null);
                fetchBills();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
