"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Target } from "lucide-react";
import { CampaignList } from "./CampaignList";
import { CampaignForm } from "./CampaignForm";

interface CampaignsPageClientProps {
  organizationSlug: string;
  canEdit?: boolean;
}

export function CampaignsPageClient({ organizationSlug, canEdit = true }: CampaignsPageClientProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [donationsAccountId, setDonationsAccountId] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  const fetchDonationsAccount = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${organizationSlug}/campaigns`);
      if (res.ok) {
        const data = await res.json();
        setDonationsAccountId(data.donationsAccountId || null);
      }
    } catch (e) {
      // Ignore
    } finally {
      setConfigLoaded(true);
    }
  }, [organizationSlug]);

  useEffect(() => {
    fetchDonationsAccount();
  }, [fetchDonationsAccount]);

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-2 text-gray-600">
            Manage fundraising campaigns for your organization.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => setShowAddDialog(true)}
            disabled={configLoaded && !donationsAccountId}
            title={configLoaded && !donationsAccountId ? "Set a Donations Account in Settings first" : undefined}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        )}
      </div>

      {canEdit && configLoaded && !donationsAccountId && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <h3 className="font-medium text-amber-900">
                Donations Account Not Configured
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                To create campaigns, first designate a Donations Account in your{" "}
                <a
                  href={`/org/${organizationSlug}/settings`}
                  className="font-medium underline"
                >
                  Organization Settings
                </a>
                . This should be a top-level Revenue account (e.g., &quot;Contributions&quot;). 
                Campaigns will be created as child accounts under it.
              </p>
            </div>
          </div>
        </div>
      )}

      <CampaignList
        organizationSlug={organizationSlug}
        refreshKey={refreshKey}
      />

      {canEdit && (
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
              <DialogDescription>
                Create a new fundraising campaign. A child Revenue account will be
                linked for tracking donations to this campaign.
              </DialogDescription>
            </DialogHeader>
            <CampaignForm
              organizationSlug={organizationSlug}
              donationsAccountId={donationsAccountId}
              onSuccess={() => {
                setShowAddDialog(false);
                setRefreshKey((k) => k + 1);
              }}
              onCancel={() => setShowAddDialog(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
