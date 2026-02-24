"use client";

import { useState } from "react";
import { BillList } from "./BillList";
import { BillForm } from "./BillForm";
import { AgingSummary } from "./AgingSummary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

type DirectionFilter = "ALL" | "PAYABLE" | "RECEIVABLE";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface BillsPageClientProps {
  organizationSlug: string;
  accounts: Account[];
  canEdit?: boolean;
}

export function BillsPageClient({ organizationSlug, accounts, canEdit = true }: BillsPageClientProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("ALL");
  const [openBillId, setOpenBillId] = useState<string | null>(null);

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bills</h1>
          <p className="mt-2 text-gray-600">
            Track payables owed by your organization and receivables owed to you.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Bill
          </Button>
        )}
      </div>

      {/* Aging Summary */}
      <div className="mb-6">
        <AgingSummary organizationSlug={organizationSlug} />
      </div>

      <BillList
        organizationSlug={organizationSlug}
        directionFilter={directionFilter === "ALL" ? undefined : directionFilter}
        onDirectionChange={setDirectionFilter}
        directionValue={directionFilter}
        refreshKey={refreshKey}
        accounts={accounts}
        openBillId={openBillId}
        onBillOpened={() => setOpenBillId(null)}
      />

      {canEdit && (
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Bill</DialogTitle>
              <DialogDescription>
                Create a new bill or pledge for your organization.
              </DialogDescription>
            </DialogHeader>
            <BillForm
              organizationSlug={organizationSlug}
              accounts={accounts}
              onSuccess={(createdBillId) => {
                setShowAddDialog(false);
                setRefreshKey((k) => k + 1);
                if (createdBillId) {
                  setOpenBillId(createdBillId);
                }
              }}
              onCancel={() => setShowAddDialog(false)}
              defaultDirection={
                directionFilter === "ALL" ? undefined : directionFilter
              }
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
