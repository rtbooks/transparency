"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["INDIVIDUAL", "ORGANIZATION"]),
  roles: z.array(z.enum(["DONOR", "VENDOR"])).min(1, "At least one role is required"),
  email: z.string().email("Invalid email").nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional().or(z.literal("")),
  address: z.string().nullable().optional().or(z.literal("")),
  notes: z.string().nullable().optional().or(z.literal("")),
});

interface Contact {
  id: string;
  name: string;
  type: "INDIVIDUAL" | "ORGANIZATION";
  roles: ("DONOR" | "VENDOR")[];
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
}

interface ContactFormProps {
  organizationSlug: string;
  contact?: Contact;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ContactForm({ organizationSlug, contact, onSuccess, onCancel }: ContactFormProps) {
  const isEditing = !!contact;

  const [name, setName] = useState(contact?.name ?? "");
  const [type, setType] = useState<"INDIVIDUAL" | "ORGANIZATION">(contact?.type ?? "INDIVIDUAL");
  const [roles, setRoles] = useState<Set<"DONOR" | "VENDOR">>(
    new Set(contact?.roles ?? [])
  );
  const [email, setEmail] = useState(contact?.email ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [address, setAddress] = useState(contact?.address ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const toggleRole = (role: "DONOR" | "VENDOR") => {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    const formData = {
      name: name.trim(),
      type,
      roles: Array.from(roles),
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };

    const result = contactFormSchema.safeParse(formData);
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
        ? `/api/organizations/${organizationSlug}/contacts/${contact.id}`
        : `/api/organizations/${organizationSlug}/contacts`;

      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save contact");
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

      {/* Name */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Name <span className="text-red-500">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contact name"
        />
        {validationErrors.name && (
          <p className="mt-1 text-sm text-red-500">{validationErrors.name}</p>
        )}
      </div>

      {/* Type */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Type</label>
        <Select value={type} onValueChange={(v) => setType(v as "INDIVIDUAL" | "ORGANIZATION")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INDIVIDUAL">Individual</SelectItem>
            <SelectItem value="ORGANIZATION">Organization</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Roles */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Roles <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2">
            <Switch
              checked={roles.has("DONOR")}
              onCheckedChange={() => toggleRole("DONOR")}
            />
            <span className="text-sm">Donor</span>
          </label>
          <label className="flex items-center gap-2">
            <Switch
              checked={roles.has("VENDOR")}
              onCheckedChange={() => toggleRole("VENDOR")}
            />
            <span className="text-sm">Vendor</span>
          </label>
        </div>
        {validationErrors.roles && (
          <p className="mt-1 text-sm text-red-500">{validationErrors.roles}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
        />
        {validationErrors.email && (
          <p className="mt-1 text-sm text-red-500">{validationErrors.email}</p>
        )}
      </div>

      {/* Phone */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Phone</label>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
        />
      </div>

      {/* Address */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Address</label>
        <Textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Mailing address"
          rows={3}
        />
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
          {submitting ? "Saving..." : isEditing ? "Update Contact" : "Create Contact"}
        </Button>
      </div>
    </form>
  );
}
