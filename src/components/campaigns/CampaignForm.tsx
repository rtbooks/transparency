"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";

interface Account {
  id: string;
  name: string;
  code: string;
}

interface TierInput {
  id?: string;
  name: string;
  amount: string;
  maxSlots: string;
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
    campaignType?: string;
    unitPrice?: number | null;
    maxUnits?: number | null;
    unitLabel?: string | null;
    allowMultiUnit?: boolean;
    tiers?: { id: string; name: string; amount: number; maxSlots: number | null; sortOrder?: number }[];
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

  // Campaign constraint fields
  const [campaignType, setCampaignType] = useState(campaign?.campaignType || "OPEN");
  const [unitPrice, setUnitPrice] = useState(
    campaign?.unitPrice ? String(campaign.unitPrice) : ""
  );
  const [maxUnits, setMaxUnits] = useState(
    campaign?.maxUnits ? String(campaign.maxUnits) : ""
  );
  const [unitLabel, setUnitLabel] = useState(campaign?.unitLabel || "");
  const [allowMultiUnit, setAllowMultiUnit] = useState(campaign?.allowMultiUnit ?? true);
  const [tiers, setTiers] = useState<TierInput[]>(
    campaign?.tiers?.map(t => ({
      id: t.id,
      name: t.name,
      amount: String(t.amount),
      maxSlots: t.maxSlots ? String(t.maxSlots) : "",
    })) || []
  );

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
            unitPrice: campaignType === 'FIXED_UNIT' && unitPrice ? parseFloat(unitPrice) : null,
            maxUnits: campaignType === 'FIXED_UNIT' && maxUnits ? parseInt(maxUnits) : null,
            unitLabel: campaignType === 'FIXED_UNIT' ? unitLabel || null : null,
            allowMultiUnit: campaignType === 'FIXED_UNIT' ? allowMultiUnit : true,
          }
        : {
            accountId: resolvedAccountId,
            name: name.trim(),
            description: description.trim() || null,
            targetAmount: targetAmount ? parseFloat(targetAmount) : null,
            startDate: startDate || null,
            endDate: endDate || null,
            campaignType,
            unitPrice: campaignType === 'FIXED_UNIT' && unitPrice ? parseFloat(unitPrice) : null,
            maxUnits: campaignType === 'FIXED_UNIT' && maxUnits ? parseInt(maxUnits) : null,
            unitLabel: campaignType === 'FIXED_UNIT' ? unitLabel || null : null,
            allowMultiUnit: campaignType === 'FIXED_UNIT' ? allowMultiUnit : true,
            tiers: campaignType === 'TIERED' ? tiers.map((t, i) => ({
              name: t.name,
              amount: parseFloat(t.amount),
              maxSlots: t.maxSlots ? parseInt(t.maxSlots) : null,
              sortOrder: i,
            })) : undefined,
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
      if (!isEditing) {
        trackEvent('campaign_created', {
          orgSlug: organizationSlug,
          goalAmount: targetAmount ? parseFloat(targetAmount) : undefined,
        });
      }
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

      {/* Campaign Type (only for new campaigns) */}
      {!isEditing && (
        <div>
          <Label htmlFor="campaignType">Campaign Type</Label>
          <select
            id="campaignType"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={campaignType}
            onChange={(e) => setCampaignType(e.target.value)}
          >
            <option value="OPEN">Open — Any donation amount</option>
            <option value="FIXED_UNIT">Fixed Unit — Fixed price per unit (tickets, squares, bricks)</option>
            <option value="TIERED">Tiered — Predefined donation levels (sponsorships)</option>
          </select>
        </div>
      )}

      {/* FIXED_UNIT fields */}
      {campaignType === "FIXED_UNIT" && (
        <div className="space-y-3 rounded-lg border bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800">Fixed Unit Settings</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="unitPrice">Price per Unit ($)</Label>
              <Input
                id="unitPrice"
                type="number"
                min="0.01"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="25.00"
                required
              />
            </div>
            <div>
              <Label htmlFor="maxUnits">Max Units (capacity)</Label>
              <Input
                id="maxUnits"
                type="number"
                min="1"
                step="1"
                value={maxUnits}
                onChange={(e) => setMaxUnits(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="unitLabel">Unit Label</Label>
              <Input
                id="unitLabel"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="e.g., square, ticket, brick"
              />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <input
                id="allowMultiUnit"
                type="checkbox"
                checked={allowMultiUnit}
                onChange={(e) => setAllowMultiUnit(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="allowMultiUnit" className="text-sm">Allow multiple units per donation</Label>
            </div>
          </div>
          {unitPrice && maxUnits && (
            <p className="text-sm text-blue-700">
              Total capacity: {maxUnits} {unitLabel || "unit"}(s) × ${parseFloat(unitPrice).toFixed(2)} = ${(parseFloat(unitPrice) * parseInt(maxUnits)).toFixed(2)}
            </p>
          )}
        </div>
      )}

      {/* TIERED fields */}
      {campaignType === "TIERED" && !isEditing && (
        <div className="space-y-3 rounded-lg border bg-purple-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-purple-800">Sponsorship Tiers</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTiers([...tiers, { name: "", amount: "", maxSlots: "" }])}
            >
              <Plus className="mr-1 h-3 w-3" /> Add Tier
            </Button>
          </div>
          {tiers.length === 0 && (
            <p className="text-sm text-purple-600">Add at least one tier for donors to choose from.</p>
          )}
          {tiers.map((tier, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">Tier Name</Label>
                <Input
                  value={tier.name}
                  onChange={(e) => {
                    const updated = [...tiers];
                    updated[i] = { ...tier, name: e.target.value };
                    setTiers(updated);
                  }}
                  placeholder="e.g., Gold Sponsor"
                  required
                />
              </div>
              <div className="w-28">
                <Label className="text-xs">Amount ($)</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={tier.amount}
                  onChange={(e) => {
                    const updated = [...tiers];
                    updated[i] = { ...tier, amount: e.target.value };
                    setTiers(updated);
                  }}
                  placeholder="500"
                  required
                />
              </div>
              <div className="w-24">
                <Label className="text-xs">Max Slots</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={tier.maxSlots}
                  onChange={(e) => {
                    const updated = [...tiers];
                    updated[i] = { ...tier, maxSlots: e.target.value };
                    setTiers(updated);
                  }}
                  placeholder="∞"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

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
