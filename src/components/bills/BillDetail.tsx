"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Pencil, Ban, DollarSign } from "lucide-react";
import { BillForm } from "./BillForm";
import { formatCurrency } from "@/lib/utils/account-tree";

interface Payment {
  id: string;
  date: string;
  amount: number;
  transactionReference: string | null;
  transactionDescription: string | null;
}

interface BillDetailData {
  id: string;
  billNumber: string;
  direction: "PAYABLE" | "RECEIVABLE";
  status: "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
  amount: number;
  amountPaid: number;
  amountRemaining: number;
  description: string | null;
  category: string | null;
  issueDate: string;
  dueDate: string;
  notes: string | null;
  contactId: string | null;
  contact: {
    id: string;
    name: string;
    email: string | null;
  } | null;
  payments: Payment[];
  createdAt: string;
  updatedAt: string;
}

interface BillDetailProps {
  organizationSlug: string;
  bill: {
    id: string;
    billNumber: string;
    direction: "PAYABLE" | "RECEIVABLE";
    status: "DRAFT" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
    amount: number;
    amountPaid: number;
    amountRemaining: number;
    description: string | null;
    category: string | null;
    issueDate: string;
    dueDate: string;
    notes: string | null;
    contact: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
  };
  onClose: () => void;
  onRefresh: () => void;
}

function getStatusBadge(status: BillDetailData["status"]) {
  const config: Record<BillDetailData["status"], { variant: "default" | "secondary" | "outline" | "destructive"; className: string; label: string }> = {
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

export function BillDetail({ organizationSlug, bill, onClose, onRefresh }: BillDetailProps) {
  const [detail, setDetail] = useState<BillDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/organizations/${organizationSlug}/bills/${bill.id}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch bill details");
      }
      const data = await response.json();
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [organizationSlug, bill.id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this bill? This action cannot be undone.")) {
      return;
    }

    try {
      setCancelling(true);
      const response = await fetch(
        `/api/organizations/${organizationSlug}/bills/${bill.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel bill");
      }

      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setCancelling(false);
    }
  };

  const handleRecordPayment = () => {
    alert("Coming soon: Record payment functionality will be available in a future update.");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading bill details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!detail) return null;

  const progressPercent = detail.amount > 0
    ? Math.min((detail.amountPaid / detail.amount) * 100, 100)
    : 0;

  return (
    <>
      <div className="space-y-6">
        {/* Header Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Bill Number</label>
            <div className="mt-1 text-gray-900">{detail.billNumber}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Status</label>
            <div className="mt-1">{getStatusBadge(detail.status)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Direction</label>
            <div className="mt-1">
              <Badge
                variant="outline"
                className={
                  detail.direction === "PAYABLE"
                    ? "border-orange-300 text-orange-700"
                    : "border-emerald-300 text-emerald-700"
                }
              >
                {detail.direction === "PAYABLE" ? "Payable" : "Receivable"}
              </Badge>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Contact</label>
            <div className="mt-1 text-gray-900">
              {detail.contact?.name || "—"}
              {detail.contact?.email && (
                <span className="ml-2 text-sm text-gray-500">{detail.contact.email}</span>
              )}
            </div>
          </div>
        </div>

        {/* Amount & Progress */}
        <div className="rounded-lg border bg-gray-50 p-4">
          <div className="mb-3 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-lg font-semibold">{formatCurrency(detail.amount)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Paid</div>
              <div className="text-lg font-semibold text-green-700">
                {formatCurrency(detail.amountPaid)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Remaining</div>
              <div className="text-lg font-semibold text-orange-700">
                {formatCurrency(detail.amountRemaining)}
              </div>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-1 text-right text-xs text-gray-500">
            {progressPercent.toFixed(0)}% paid
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Issue Date</label>
            <div className="mt-1 rounded-lg border bg-gray-50 p-3 text-sm">
              {new Date(detail.issueDate).toLocaleDateString()}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Due Date</label>
            <div className="mt-1 rounded-lg border bg-gray-50 p-3 text-sm">
              {new Date(detail.dueDate).toLocaleDateString()}
            </div>
          </div>
        </div>

        {detail.description && (
          <div>
            <label className="text-sm font-medium text-gray-700">Description</label>
            <div className="mt-1 rounded-lg border bg-gray-50 p-3 text-sm">
              {detail.description}
            </div>
          </div>
        )}

        {detail.category && (
          <div>
            <label className="text-sm font-medium text-gray-700">Category</label>
            <div className="mt-1 rounded-lg border bg-gray-50 p-3 text-sm">
              {detail.category}
            </div>
          </div>
        )}

        {detail.notes && (
          <div>
            <label className="text-sm font-medium text-gray-700">Notes</label>
            <div className="mt-1 whitespace-pre-line rounded-lg border bg-gray-50 p-3 text-sm">
              {detail.notes}
            </div>
          </div>
        )}

        {/* Payment History */}
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">Payment History</h3>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!detail.payments || detail.payments.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-4 text-center text-sm text-gray-500">
                      No payments recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  detail.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-sm">
                        {new Date(payment.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {payment.transactionReference || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {payment.transactionDescription || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
          <div>
            <span className="font-medium">Created:</span>{" "}
            {new Date(detail.createdAt).toLocaleString()}
          </div>
          <div>
            <span className="font-medium">ID:</span> {detail.id.slice(0, 8)}...
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t pt-4">
          {detail.status !== "CANCELLED" && detail.status !== "PAID" && (
            <>
              <Button variant="outline" size="sm" onClick={handleRecordPayment}>
                <DollarSign className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={cancelling}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Ban className="mr-2 h-4 w-4" />
                {cancelling ? "Cancelling..." : "Cancel Bill"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={(open) => !open && setEditing(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Bill</DialogTitle>
            <DialogDescription>
              Update the bill details.
            </DialogDescription>
          </DialogHeader>
          <BillForm
            organizationSlug={organizationSlug}
            bill={{
              id: detail.id,
              direction: detail.direction,
              contactId: detail.contact?.id ?? null,
              billNumber: detail.billNumber,
              amount: detail.amount,
              description: detail.description,
              category: detail.category,
              issueDate: detail.issueDate,
              dueDate: detail.dueDate,
              notes: detail.notes,
            }}
            onSuccess={() => {
              setEditing(false);
              onRefresh();
            }}
            onCancel={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
