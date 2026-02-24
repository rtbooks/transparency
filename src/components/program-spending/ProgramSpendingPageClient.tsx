'use client';

import { useState } from 'react';
import { ProgramSpendingList } from './ProgramSpendingList';
import { ProgramSpendingForm } from './ProgramSpendingForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

interface ProgramSpendingPageClientProps {
  organizationSlug: string;
  canEdit: boolean;
}

export function ProgramSpendingPageClient({
  organizationSlug,
  canEdit,
}: ProgramSpendingPageClientProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Program Spending</h1>
          <p className="mt-2 text-gray-600">
            Track and manage mission-related spending for your organization.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Item
          </Button>
        )}
      </div>

      <ProgramSpendingList
        organizationSlug={organizationSlug}
        refreshKey={refreshKey}
        canEdit={canEdit}
        openItemId={openItemId}
        onItemOpened={() => setOpenItemId(null)}
        onRefresh={() => setRefreshKey((k) => k + 1)}
      />

      {canEdit && (
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Program Spending Item</DialogTitle>
              <DialogDescription>
                Plan a new mission-related expenditure.
              </DialogDescription>
            </DialogHeader>
            <ProgramSpendingForm
              organizationSlug={organizationSlug}
              onSuccess={(createdId) => {
                setShowAddDialog(false);
                setRefreshKey((k) => k + 1);
                if (createdId) {
                  setOpenItemId(createdId);
                }
              }}
              onCancel={() => setShowAddDialog(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
