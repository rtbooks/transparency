"use client";

import { useState } from "react";
import { ContactList } from "./ContactList";
import { ContactForm } from "./ContactForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface ContactsPageClientProps {
  organizationSlug: string;
}

export function ContactsPageClient({ organizationSlug }: ContactsPageClientProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="mt-2 text-gray-600">
            Manage your organization&apos;s donors, vendors, and other contacts.
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </div>

      <ContactList organizationSlug={organizationSlug} refreshKey={refreshKey} />

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Create a new contact for your organization.
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            organizationSlug={organizationSlug}
            onSuccess={() => {
              setShowAddDialog(false);
              setRefreshKey((k) => k + 1);
            }}
            onCancel={() => setShowAddDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
