"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X, User, Building2 } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  type: string;
  roles: string[];
  email: string | null;
}

interface ContactSelectorProps {
  organizationSlug: string;
  value?: string | null;
  onChange: (contactId: string | null) => void;
  className?: string;
  placeholder?: string;
  roleFilter?: string;
}

export function ContactSelector({
  organizationSlug,
  value,
  onChange,
  className,
  placeholder = "Search contacts...",
  roleFilter,
}: ContactSelectorProps) {
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchContacts = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "10" });
      if (query) params.append("search", query);
      if (roleFilter) params.append("role", roleFilter);

      const res = await fetch(
        `/api/organizations/${organizationSlug}/contacts?${params}`
      );
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [organizationSlug, roleFilter]);

  // Fetch selected contact on mount if value is set
  useEffect(() => {
    if (value && !selectedContact) {
      fetch(`/api/organizations/${organizationSlug}/contacts/${value}`)
        .then((r) => r.ok ? r.json() : null)
        .then((c) => c && setSelectedContact(c))
        .catch(() => {});
    }
  }, [value, organizationSlug, selectedContact]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => fetchContacts(search), 200);
    return () => clearTimeout(timer);
  }, [search, isOpen, fetchContacts]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (contact: Contact) => {
    setSelectedContact(contact);
    onChange(contact.id);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    setSelectedContact(null);
    onChange(null);
    setSearch("");
  };

  if (selectedContact) {
    return (
      <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${className || ""}`}>
        {selectedContact.type === "ORGANIZATION" ? (
          <Building2 className="h-4 w-4 text-gray-400" />
        ) : (
          <User className="h-4 w-4 text-gray-400" />
        )}
        <span className="flex-1 text-sm">{selectedContact.name}</span>
        {selectedContact.roles.map((r) => (
          <Badge key={r} variant="outline" className="text-xs">
            {r}
          </Badge>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={handleClear}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={`relative ${className || ""}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => {
            setIsOpen(true);
            if (contacts.length === 0) fetchContacts("");
          }}
          className="pl-9"
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg">
          {loading ? (
            <div className="p-3 text-center text-sm text-gray-500">Searching...</div>
          ) : contacts.length === 0 ? (
            <div className="p-3 text-center text-sm text-gray-500">No contacts found</div>
          ) : (
            <ul className="max-h-48 overflow-auto py-1">
              {contacts.map((c) => (
                <li
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-100"
                  onClick={() => handleSelect(c)}
                >
                  {c.type === "ORGANIZATION" ? (
                    <Building2 className="h-4 w-4 text-gray-400" />
                  ) : (
                    <User className="h-4 w-4 text-gray-400" />
                  )}
                  <div className="flex-1">
                    <div className="text-sm font-medium">{c.name}</div>
                    {c.email && (
                      <div className="text-xs text-gray-500">{c.email}</div>
                    )}
                  </div>
                  {c.roles.map((r) => (
                    <Badge key={r} variant="outline" className="text-xs">
                      {r}
                    </Badge>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
