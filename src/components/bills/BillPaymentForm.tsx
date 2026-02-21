"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/utils/account-tree";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface BillPaymentFormProps {
  organizationSlug: string;
  billId: string;
  direction: "PAYABLE" | "RECEIVABLE";
  amountRemaining: number;
  accounts: Account[];
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Compact form for recording a payment against a bill.
 *
 * PAYABLE payment:    DR Accounts Payable (liability), CR Cash/Bank (asset)
 * RECEIVABLE receipt: DR Cash/Bank (asset), CR Accounts Receivable (asset)
 */
export function BillPaymentForm({
  organizationSlug,
  billId,
  direction,
  amountRemaining,
  accounts,
  onSuccess,
  onCancel,
}: BillPaymentFormProps) {
  const [amount, setAmount] = useState(amountRemaining.toFixed(2));
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PAYABLE payment: DR liability (AP), CR asset (Cash)
  // RECEIVABLE receipt: DR asset (Cash), CR asset (AR)
  const debitAccounts = accounts.filter((a) =>
    direction === "PAYABLE" ? a.type === "LIABILITY" : a.type === "ASSET"
  );
  const creditAccounts = accounts.filter((a) => a.type === "ASSET");

  const debitLabel =
    direction === "PAYABLE"
      ? "Accounts Payable (Liability)"
      : "Cash / Bank (Asset)";
  const creditLabel =
    direction === "PAYABLE"
      ? "Cash / Bank (Asset)"
      : "Accounts Receivable (Asset)";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (parsedAmount > amountRemaining + 0.001) {
      setError(`Amount cannot exceed remaining balance of ${formatCurrency(amountRemaining)}`);
      return;
    }
    if (!paymentDate) {
      setError("Payment date is required");
      return;
    }
    if (!debitAccountId || !creditAccountId) {
      setError("Both accounts are required");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(
        `/api/organizations/${organizationSlug}/bills/${billId}/payments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: parsedAmount,
            transactionDate: paymentDate.toISOString(),
            debitAccountId,
            creditAccountId,
            description: description.trim() || undefined,
            referenceNumber: referenceNumber.trim() || null,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record payment");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Amount Remaining */}
      <div className="rounded-lg border bg-gray-50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Amount Remaining</span>
          <span className="text-lg font-semibold">{formatCurrency(amountRemaining)}</span>
        </div>
      </div>

      {/* Payment Amount */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Payment Amount <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="number"
            step="0.01"
            min="0"
            max={amountRemaining}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-9"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Payment Date */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Payment Date <span className="text-red-500">*</span>
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full pl-3 text-left font-normal">
              {paymentDate ? format(paymentDate, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={paymentDate}
              onSelect={setPaymentDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Account Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {debitLabel} <span className="text-red-500">*</span>
          </label>
          <Select value={debitAccountId} onValueChange={setDebitAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select account..." />
            </SelectTrigger>
            <SelectContent>
              {debitAccounts.map((acct) => (
                <SelectItem key={acct.id} value={acct.id}>
                  {acct.code} – {acct.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {creditLabel} <span className="text-red-500">*</span>
          </label>
          <Select value={creditAccountId} onValueChange={setCreditAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Select account..." />
            </SelectTrigger>
            <SelectContent>
              {creditAccounts.map((acct) => (
                <SelectItem key={acct.id} value={acct.id}>
                  {acct.code} – {acct.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={direction === "PAYABLE" ? "e.g., Check #1234" : "e.g., Deposit received"}
        />
      </div>

      {/* Reference Number */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Reference Number</label>
        <Input
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          placeholder="e.g., Check #, Wire ref"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Recording..." : `Record ${direction === "PAYABLE" ? "Payment" : "Receipt"}`}
        </Button>
      </div>
    </form>
  );
}
