"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Account {
  id: string;
  name: string;
  code: string;
}

interface CampaignFormProps {
  organizationSlug: string;
  donationsAccountId?: string | null;
  campaign?: {
    id: string;
    name: string;
    description: string | null;
    targetAmount: number | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
    accountId: string;
  } | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CampaignForm({
  organizationSlug,
  donationsAccountId,
  campaign,
  onSuccess,
  onCancel,
}: CampaignFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [childAccounts, setChildAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [name, setName] = useState(campaign?.name || "");
  const [description, setDescription] = useState(campaign?.description || "");
  const [targetAmount, setTargetAmount] = useState(
    campaign?.targetAmount ? String(campaign.targetAmount) : ""
  );
  const [startDate, setStartDate] = useState(
    campaign?.startDate ? campaign.startDate.slice(0, 10) : ""
  );
  const [endDate, setEndDate] = useState(
    campaign?.endDate ? campaign.endDate.slice(0, 10) : ""
  );
  const [accountId, setAccountId] = useState(campaign?.accountId || "");
  const [status, setStatus] = useState(campaign?.status || "ACTIVE");
  const [newAccountName, setNewAccountName] = useState("");

  const isEditing = !!campaign;

  // Fetch child Revenue accounts under the donations account
  useEffect(() => {
    async function fetchAccounts() {
      if (!donationsAccountId && !isEditing) {
        setLoadingAccounts(false);
        return;
      }
      try {
        const res = await fetch(`/api/organizations/${organizationSlug}/accounts`);
        if (res.ok) {
          const data = await res.json();
          const accounts = (data.accounts || data || []).filter(
            (a: any) => a.type === "REVENUE" && a.parentAccountId === donationsAccountId
          );
          setChildAccounts(accounts);
        }
      } catch (e) {
        console.error("Failed to load accounts:", e);
      } finally {
        setLoadingAccounts(false);
      }
    }
    fetchAccounts();
  }, [organizationSlug, donationsAccountId, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: "Error", description: "Campaign name is required", variant: "destructive" });
      return;
    }

    // For new campaigns: either select existing child account or we'll create a new one
    let resolvedAccountId = accountId;

    if (!isEditing && !resolvedAccountId && newAccountName.trim()) {
      // Auto-generate an account code from the parent's code + next child number
      let code = "";
      if (donationsAccountId && childAccounts.length > 0) {
        // Find highest existing code and increment
        const codes = childAccounts.map((a) => parseInt(a.code, 10)).filter((n) => !isNaN(n));
        const nextCode = codes.length > 0 ? Math.max(...codes) + 10 : 4100;
        code = String(nextCode);
      } else {
        // Fallback: generate from timestamp
        code = `C${Date.now().toString().slice(-4)}`;
      }

      // Create a new child account under the donations account
      try {
        const createRes = await fetch(`/api/organizations/${organizationSlug}/accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newAccountName.trim(),
            code,
            type: "REVENUE",
            parentAccountId: donationsAccountId,
          }),
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          toast({ title: "Error", description: err.error || "Failed to create account", variant: "destructive" });
          return;
        }
        const newAccount = await createRes.json();
        resolvedAccountId = newAccount.id;
      } catch (err) {
        toast({ title: "Error", description: "Failed to create account", variant: "destructive" });
        return;
      }
    }

    if (!isEditing && !resolvedAccountId) {
      toast({
        title: "Error",
        description: "Select an existing account or enter a name for a new one",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const url = isEditing
        ? `/api/organizations/${organizationSlug}/campaigns/${campaign.id}`
        : `/api/organizations/${organizationSlug}/campaigns`;

      const body: any = isEditing
        ? {
            name: name.trim(),
            description: description.trim() || null,
            targetAmount: targetAmount ? parseFloat(targetAmount) : null,
            startDate: startDate || null,
            endDate: endDate || null,
            status,
          }
        : {
            accountId: resolvedAccountId,
            name: name.trim(),
            description: description.trim() || null,
            targetAmount: targetAmount ? parseFloat(targetAmount) : null,
            startDate: startDate || null,
            endDate: endDate || null,
          };

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save campaign");
      }

      toast({
        title: "Success",
        description: isEditing ? "Campaign updated." : "Campaign created.",
      });
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save campaign",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Campaign Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., 2026 Annual Fund"
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description (Planned Usage)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe how the funds will be used..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="targetAmount">Fundraising Goal ($)</Label>
          <Input
            id="targetAmount"
            type="number"
            min="0"
            step="0.01"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="Optional"
          />
        </div>
        {isEditing && (
          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Account selection (only for new campaigns) */}
      {!isEditing && (
        <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
          <Label className="text-base font-medium">Revenue Account</Label>
          <p className="text-sm text-gray-500">
            Each campaign is linked to a Revenue account for tracking. Select an
            existing child account or create a new one.
          </p>

          {loadingAccounts ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading accounts...
            </div>
          ) : (
            <>
              {childAccounts.length > 0 && (
                <div>
                  <Label htmlFor="accountId">Existing Account</Label>
                  <select
                    id="accountId"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={accountId}
                    onChange={(e) => {
                      setAccountId(e.target.value);
                      if (e.target.value) setNewAccountName("");
                    }}
                  >
                    <option value="">Create new account instead...</option>
                    {childAccounts.map((acct) => (
                      <option key={acct.id} value={acct.id}>
                        {acct.code} - {acct.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!accountId && (
                <div>
                  <Label htmlFor="newAccountName">New Account Name</Label>
                  <Input
                    id="newAccountName"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="e.g., Building Renovation Fund"
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Save Changes" : "Create Campaign"}
        </Button>
      </div>
    </form>
  );
}
