"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils/account-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Target, Pencil } from "lucide-react";
import { CampaignForm } from "./CampaignForm";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  targetAmount: number | null;
  amountRaised: number;
  progressPercent: number | null;
  donationCount: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  accountId: string;
  createdAt: string;
}

interface CampaignListProps {
  organizationSlug: string;
  refreshKey: number;
  showEditControls?: boolean;
}

export function CampaignList({
  organizationSlug,
  refreshKey,
  showEditControls = true,
}: CampaignListProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    async function fetchCampaigns() {
      setLoading(true);
      try {
        const res = await fetch(`/api/organizations/${organizationSlug}/campaigns`);
        if (res.ok) {
          const data = await res.json();
          setCampaigns(data.campaigns || []);
        }
      } catch (e) {
        console.error("Failed to load campaigns:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchCampaigns();
  }, [organizationSlug, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-12 text-center">
        <Target className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">No campaigns yet</h3>
        <p className="mt-2 text-sm text-gray-500">
          Create your first fundraising campaign to start receiving directed donations.
        </p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    PAUSED: "bg-yellow-100 text-yellow-800",
    COMPLETED: "bg-blue-100 text-blue-800",
    CANCELLED: "bg-gray-100 text-gray-600",
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex items-start justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {campaign.name}
              </h3>
              <div className="flex items-center gap-2">
                <Badge className={statusColors[campaign.status] || "bg-gray-100"}>
                  {campaign.status}
                </Badge>
                {showEditControls && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingCampaign(campaign)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {campaign.description && (
              <p className="mb-4 text-sm text-gray-600 line-clamp-2">
                {campaign.description}
              </p>
            )}

            {/* Progress bar */}
            <div className="mb-3">
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-green-700">
                  {formatCurrency(campaign.amountRaised)}
                </span>
                {campaign.targetAmount && (
                  <span className="text-sm text-gray-500">
                    of {formatCurrency(campaign.targetAmount)} goal
                  </span>
                )}
              </div>
              {campaign.targetAmount && campaign.targetAmount > 0 && (
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${campaign.progressPercent || 0}%` }}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                {campaign.donationCount} donation{campaign.donationCount !== 1 ? "s" : ""}
              </span>
              {campaign.endDate && (
                <span>
                  Ends {new Date(campaign.endDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingCampaign}
        onOpenChange={(open) => !open && setEditingCampaign(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
            <DialogDescription>
              Update campaign details, target, or status.
            </DialogDescription>
          </DialogHeader>
          {editingCampaign && (
            <CampaignForm
              organizationSlug={organizationSlug}
              campaign={editingCampaign}
              onSuccess={() => {
                setEditingCampaign(null);
                // Trigger refresh
                setCampaigns((prev) =>
                  prev.map((c) => (c.id === editingCampaign.id ? { ...c } : c))
                );
                window.location.reload();
              }}
              onCancel={() => setEditingCampaign(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
