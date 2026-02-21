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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ContactSelector } from "@/components/contacts/ContactSelector";

const billFormSchema = z.object({
  direction: z.enum(["PAYABLE", "RECEIVABLE"]),
  contactId: z.string().min(1, "Contact is required"),
  billNumber: z.string().min(1, "Bill number is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  description: z.string().nullable().optional().or(z.literal("")),
  category: z.string().nullable().optional().or(z.literal("")),
  issueDate: z.string().min(1, "Issue date is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().nullable().optional().or(z.literal("")),
});

interface BillFormProps {
  organizationSlug: string;
  bill?: {
    id: string;
    direction: "PAYABLE" | "RECEIVABLE";
    contactId: string | null;
    billNumber: string;
    amount: number;
    description: string | null;
    category: string | null;
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
  const [billNumber, setBillNumber] = useState(bill?.billNumber ?? "");
  const [amount, setAmount] = useState(bill?.amount?.toString() ?? "");
  const [description, setDescription] = useState(bill?.description ?? "");
  const [category, setCategory] = useState(bill?.category ?? "");
  const [issueDate, setIssueDate] = useState<Date | undefined>(
    bill?.issueDate ? new Date(bill.issueDate) : new Date()
  );
  const [dueDate, setDueDate] = useState<Date | undefined>(
    bill?.dueDate ? new Date(bill.dueDate) : undefined
  );
  const [notes, setNotes] = useState(bill?.notes ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    const formData = {
      direction,
      contactId: contactId || "",
      billNumber: billNumber.trim(),
      amount: parseFloat(amount) || 0,
      description: description.trim() || null,
      category: category.trim() || null,
      issueDate: issueDate ? issueDate.toISOString().slice(0, 10) : "",
      dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : "",
      notes: notes.trim() || null,
    };

    const result = billFormSchema.safeParse(formData);
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
            onClick={() => setDirection("PAYABLE")}
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
            onClick={() => setDirection("RECEIVABLE")}
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

      {/* Bill Number */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Bill Number <span className="text-red-500">*</span>
        </label>
        <Input
          value={billNumber}
          onChange={(e) => setBillNumber(e.target.value)}
          placeholder="e.g., BILL-001"
        />
        {validationErrors.billNumber && (
          <p className="mt-1 text-sm text-red-500">{validationErrors.billNumber}</p>
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

      {/* Category */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Category</label>
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g., Supplies, Rent, Pledge"
        />
      </div>

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
