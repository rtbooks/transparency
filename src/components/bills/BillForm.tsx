"use client";

import { useState } from "react";
import { z } from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ContactSelector } from "@/components/contacts/ContactSelector";

const billFormSchema = z.object({
  direction: z.enum(["PAYABLE", "RECEIVABLE"]),
  contactId: z.string().min(1, "Contact is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  description: z.string().nullable().optional().or(z.literal("")),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().nullable().optional().or(z.literal("")),
  liabilityOrAssetAccountId: z.string().min(1, "Account is required"),
  expenseOrRevenueAccountId: z.string().min(1, "Account is required"),
});

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface BillFormProps {
  organizationSlug: string;
  accounts?: Account[];
  bill?: {
    id: string;
    direction: "PAYABLE" | "RECEIVABLE";
    contactId: string | null;
    amount: number;
    description: string | null;
    issueDate: string;
    dueDate: string;
    notes: string | null;
  };
  onSuccess: () => void;
  onCancel: () => void;
  defaultDirection?: "PAYABLE" | "RECEIVABLE";
}

export function BillForm({
  organizationSlug,
  accounts,
  bill,
  onSuccess,
  onCancel,
  defaultDirection,
}: BillFormProps) {
  const isEditing = !!bill;

  const [direction, setDirection] = useState<"PAYABLE" | "RECEIVABLE">(
    bill?.direction ?? defaultDirection ?? "PAYABLE"
  );
  const [contactId, setContactId] = useState(bill?.contactId ?? "");
  const [amount, setAmount] = useState(bill?.amount?.toString() ?? "");
  const [description, setDescription] = useState(bill?.description ?? "");
  const [issueDate, setIssueDate] = useState<Date | undefined>(
    bill?.issueDate ? new Date(bill.issueDate) : new Date()
  );
  const [dueDate, setDueDate] = useState<Date | undefined>(
    bill?.dueDate ? new Date(bill.dueDate) : undefined
  );
  const [notes, setNotes] = useState(bill?.notes ?? "");
  const [liabilityOrAssetAccountId, setLiabilityOrAssetAccountId] = useState("");
  const [expenseOrRevenueAccountId, setExpenseOrRevenueAccountId] = useState("");

  // Filter accounts based on direction
  // PAYABLE: liability account (AP) + expense account
  // RECEIVABLE: asset account (AR) + revenue account
  const apArAccounts = (accounts ?? []).filter((a) =>
    direction === "PAYABLE"
      ? a.type === "LIABILITY"
      : a.type === "ASSET"
  );
  const expRevAccounts = (accounts ?? []).filter((a) =>
    direction === "PAYABLE"
      ? a.type === "EXPENSE"
      : a.type === "REVENUE"
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    const formData: Record<string, unknown> = {
      direction,
      contactId: contactId || "",
      amount: parseFloat(amount) || 0,
      description: description.trim() || null,
      issueDate: issueDate ? issueDate.toISOString().slice(0, 10) : "",
      dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : "",
      notes: notes.trim() || null,
      ...(isEditing ? {} : { liabilityOrAssetAccountId, expenseOrRevenueAccountId }),
    };

    const schema = isEditing
      ? billFormSchema.omit({ liabilityOrAssetAccountId: true, expenseOrRevenueAccountId: true })
      : billFormSchema;
    const result = schema.safeParse(formData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0];
        if (field) errors[String(field)] = err.message;
      });
      setValidationErrors(errors);
      return;
    }

    try {
      setSubmitting(true);

      const url = isEditing
        ? `/api/organizations/${organizationSlug}/bills/${bill.id}`
        : `/api/organizations/${organizationSlug}/bills`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save bill");
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

      {/* Direction */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Direction <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => {
              setDirection("PAYABLE");
              setLiabilityOrAssetAccountId("");
              setExpenseOrRevenueAccountId("");
            }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              direction === "PAYABLE"
                ? "bg-orange-100 text-orange-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Payable
          </button>
          <button
            type="button"
            onClick={() => {
              setDirection("RECEIVABLE");
              setLiabilityOrAssetAccountId("");
              setExpenseOrRevenueAccountId("");
            }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              direction === "RECEIVABLE"
                ? "bg-emerald-100 text-emerald-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Receivable
          </button>
        </div>
      </div>

      {/* Contact */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Contact <span className="text-red-500">*</span>
        </label>
        <ContactSelector
          organizationSlug={organizationSlug}
          value={contactId || null}
          onChange={(id) => setContactId(id ?? "")}
        />
        {validationErrors.contactId && (
          <p className="mt-1 text-sm text-red-500">{validationErrors.contactId}</p>
        )}
      </div>

      {/* Amount */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Amount <span className="text-red-500">*</span>
        </label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
        {validationErrors.amount && (
          <p className="mt-1 text-sm text-red-500">{validationErrors.amount}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description"
        />
      </div>

      {/* Account Selectors */}
      {!isEditing && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {direction === "PAYABLE" ? "Accounts Payable (Liability)" : "Accounts Receivable (Asset)"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <Select value={liabilityOrAssetAccountId} onValueChange={setLiabilityOrAssetAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={direction === "PAYABLE" ? "Select AP account..." : "Select AR account..."} />
              </SelectTrigger>
              <SelectContent>
                {apArAccounts.map((acct) => (
                  <SelectItem key={acct.id} value={acct.id}>
                    {acct.code} – {acct.name}
                  </SelectItem>
                ))}
                {apArAccounts.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    No {direction === "PAYABLE" ? "liability" : "asset"} accounts found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {validationErrors.liabilityOrAssetAccountId && (
              <p className="mt-1 text-sm text-red-500">{validationErrors.liabilityOrAssetAccountId}</p>
            )}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {direction === "PAYABLE" ? "Expense Account" : "Revenue Account"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <Select value={expenseOrRevenueAccountId} onValueChange={setExpenseOrRevenueAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={direction === "PAYABLE" ? "Select expense account..." : "Select revenue account..."} />
              </SelectTrigger>
              <SelectContent>
                {expRevAccounts.map((acct) => (
                  <SelectItem key={acct.id} value={acct.id}>
                    {acct.code} – {acct.name}
                  </SelectItem>
                ))}
                {expRevAccounts.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    No {direction === "PAYABLE" ? "expense" : "revenue"} accounts found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {validationErrors.expenseOrRevenueAccountId && (
              <p className="mt-1 text-sm text-red-500">{validationErrors.expenseOrRevenueAccountId}</p>
            )}
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label className="mb-2 text-sm font-medium text-gray-700">
            Issue Date <span className="text-red-500">*</span>
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full pl-3 text-left font-normal">
                {issueDate ? format(issueDate, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={issueDate}
                onSelect={setIssueDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {validationErrors.issueDate && (
            <p className="mt-1 text-sm text-red-500">{validationErrors.issueDate}</p>
          )}
        </div>
        <div className="flex flex-col">
          <label className="mb-2 text-sm font-medium text-gray-700">
            Due Date <span className="text-red-500">*</span>
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full pl-3 text-left font-normal">
                {dueDate ? format(dueDate, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dueDate}
                onSelect={setDueDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {validationErrors.dueDate && (
            <p className="mt-1 text-sm text-red-500">{validationErrors.dueDate}</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Notes</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes"
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEditing ? "Update Bill" : "Create Bill"}
        </Button>
      </div>
    </form>
  );
}
