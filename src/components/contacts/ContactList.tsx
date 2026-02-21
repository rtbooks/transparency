"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Search, Pencil } from "lucide-react";
import { ContactForm } from "./ContactForm";

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
  createdAt: string;
  updatedAt: string;
}

interface ContactListProps {
  organizationSlug: string;
  refreshKey?: number;
}

export function ContactList({ organizationSlug, refreshKey }: ContactListProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 25;

  const fetchContacts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (roleFilter && roleFilter !== "all") {
        params.append("role", roleFilter);
      }
      if (search) {
        params.append("search", search);
      }

      const response = await fetch(
        `/api/organizations/${organizationSlug}/contacts?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch contacts");
      }

      const data = await response.json();
      setContacts(data.contacts);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, roleFilter, refreshKey]);

  const handleSearch = () => {
    setPage(1);
    fetchContacts();
  };

  const handleEditClick = (contact: Contact) => {
    setSelectedContact(null);
    setEditingContact(contact);
  };

  const handleEditSuccess = () => {
    setEditingContact(null);
    fetchContacts();
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { variant: "default" | "secondary"; label: string }> = {
      DONOR: { variant: "default", label: "Donor" },
      VENDOR: { variant: "secondary", label: "Vendor" },
    };
    const config = variants[role] || { variant: "default" as const, label: role };
    return (
      <Badge key={role} variant={config.variant} className="mr-1">
        {config.label}
      </Badge>
    );
  };

  if (loading && contacts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading contacts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-white p-4">
        <div className="min-w-[200px] flex-1">
          <label className="mb-2 block text-sm font-medium text-gray-700">Search</label>
          <div className="flex gap-2">
            <Input
              placeholder="Name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} size="sm">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-w-[150px]">
          <label className="mb-2 block text-sm font-medium text-gray-700">Role</label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="DONOR">Donors</SelectItem>
              <SelectItem value="VENDOR">Vendors</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Contact Count */}
      <div className="text-sm text-gray-600">
        Showing {contacts.length} of {totalCount} contacts
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-gray-500">
                  No contacts found. Add your first contact to get started.
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedContact(contact)}
                >
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {contact.type === "INDIVIDUAL" ? "Individual" : "Organization"}
                  </TableCell>
                  <TableCell>{contact.roles.map(getRoleBadge)}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {contact.email || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {contact.phone || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={contact.isActive ? "default" : "outline"}>
                      {contact.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Contact Detail Dialog */}
      <Dialog
        open={!!selectedContact}
        onOpenChange={(open) => !open && setSelectedContact(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
            <DialogDescription>
              {selectedContact?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedContact && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Name</label>
                  <div className="mt-1 text-gray-900">{selectedContact.name}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Type</label>
                  <div className="mt-1 text-gray-900">
                    {selectedContact.type === "INDIVIDUAL" ? "Individual" : "Organization"}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Roles</label>
                <div className="mt-1">{selectedContact.roles.map(getRoleBadge)}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <div className="mt-1 rounded-lg border bg-gray-50 p-3 text-sm">
                    {selectedContact.email || "—"}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  <div className="mt-1 rounded-lg border bg-gray-50 p-3 text-sm">
                    {selectedContact.phone || "—"}
                  </div>
                </div>
              </div>

              {selectedContact.address && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Address</label>
                  <div className="mt-1 whitespace-pre-line rounded-lg border bg-gray-50 p-3 text-sm">
                    {selectedContact.address}
                  </div>
                </div>
              )}

              {selectedContact.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Notes</label>
                  <div className="mt-1 whitespace-pre-line rounded-lg border bg-gray-50 p-3 text-sm">
                    {selectedContact.notes}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1">
                  <Badge variant={selectedContact.isActive ? "default" : "outline"}>
                    {selectedContact.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                <div>
                  <span className="font-medium">Created:</span>{" "}
                  {new Date(selectedContact.createdAt).toLocaleString()}
                </div>
                <div>
                  <span className="font-medium">ID:</span> {selectedContact.id.slice(0, 8)}...
                </div>
              </div>

              <div className="flex gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditClick(selectedContact)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Contact
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog
        open={!!editingContact}
        onOpenChange={(open) => !open && setEditingContact(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update the contact details.
            </DialogDescription>
          </DialogHeader>
          {editingContact && (
            <ContactForm
              organizationSlug={organizationSlug}
              contact={editingContact}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingContact(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
