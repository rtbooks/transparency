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
}

export function BillsPageClient({ organizationSlug, accounts }: BillsPageClientProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("ALL");
  const [openBillId, setOpenBillId] = useState<string | null>(null);

  const tabs: { label: string; value: DirectionFilter }[] = [
    { label: "All", value: "ALL" },
    { label: "Payables", value: "PAYABLE" },
    { label: "Receivables", value: "RECEIVABLE" },
  ];

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bills &amp; Pledges</h1>
          <p className="mt-2 text-gray-600">
            Track payables owed by your organization and receivables owed to you.
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Bill
        </Button>
      </div>

      {/* Aging Summary */}
      <div className="mb-6">
        <AgingSummary organizationSlug={organizationSlug} />
      </div>

      {/* Direction Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setDirectionFilter(tab.value)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              directionFilter === tab.value
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <BillList
        organizationSlug={organizationSlug}
        directionFilter={directionFilter === "ALL" ? undefined : directionFilter}
        refreshKey={refreshKey}
        accounts={accounts}
        openBillId={openBillId}
        onBillOpened={() => setOpenBillId(null)}
      />

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
    </>
  );
}
