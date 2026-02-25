'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Building2, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BankAccountItem {
  id: string;
  accountId: string;
  bankName: string;
  accountNumberLast4: string;
  accountType: string | null;
  isActive: boolean;
  accountName: string;
  accountCode: string;
  ledgerAccountType: string;
}

interface LedgerAccount {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface BankAccountManagerProps {
  slug: string;
  onBankAccountsChanged: () => void;
}

export function BankAccountManager({ slug, onBankAccountsChanged }: BankAccountManagerProps) {
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state
  const [formAccountId, setFormAccountId] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formLast4, setFormLast4] = useState('');
  const [formType, setFormType] = useState<string>('checking');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [slug]);

  async function fetchData() {
    setLoading(true);
    try {
      const [baRes, acctRes] = await Promise.all([
        fetch(`/api/organizations/${slug}/bank-accounts`),
        fetch(`/api/organizations/${slug}/accounts`),
      ]);
      if (baRes.ok) setBankAccounts(await baRes.json());
      if (acctRes.ok) {
        const allAccounts = await acctRes.json();
        // Only show ASSET accounts that are active as candidates for bank linking
        const assetAccounts = (allAccounts.accounts || allAccounts || []).filter(
          (a: LedgerAccount) => a.type === 'ASSET'
        );
        setLedgerAccounts(assetAccounts);
      }
    } finally {
      setLoading(false);
    }
  }

  const linkedAccountIds = new Set(bankAccounts.map((ba) => ba.accountId));
  const availableAccounts = ledgerAccounts.filter((a) => !linkedAccountIds.has(a.id));

  async function handleCreate() {
    if (!formAccountId || !formBankName || formLast4.length !== 4) {
      setFormError('Please fill in all required fields. Last 4 digits must be exactly 4 characters.');
      return;
    }

    setActionLoading('create');
    setFormError(null);
    try {
      const res = await fetch(`/api/organizations/${slug}/bank-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: formAccountId,
          bankName: formBankName,
          accountNumberLast4: formLast4,
          accountType: formType || undefined,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        resetForm();
        await fetchData();
        onBankAccountsChanged();
      } else {
        const data = await res.json();
        setFormError(data.error || 'Failed to create bank account');
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/organizations/${slug}/bank-accounts/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchData();
        onBankAccountsChanged();
      }
    } finally {
      setActionLoading(null);
    }
  }

  function resetForm() {
    setFormAccountId('');
    setFormBankName('');
    setFormLast4('');
    setFormType('checking');
    setFormError(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Link your ledger accounts (ASSET type) to real bank accounts for reconciliation.
        </p>
        <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Add Bank Account
        </Button>
      </div>

      {bankAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No bank accounts linked yet.</p>
            <p className="text-sm mt-1">
              Click &quot;Add Bank Account&quot; to link a ledger account to your bank.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {bankAccounts.map((ba) => (
            <Card key={ba.id} className={!ba.isActive ? 'opacity-50' : ''}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{ba.bankName}</p>
                    <p className="text-xs text-muted-foreground">
                      {ba.accountName} ({ba.accountCode}) · ···{ba.accountNumberLast4}
                      {ba.accountType && ` · ${ba.accountType}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!ba.isActive && <Badge variant="secondary">Inactive</Badge>}
                  {ba.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(ba.id)}
                      disabled={actionLoading === ba.id}
                    >
                      {actionLoading === ba.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      {showAdd && (
        <Dialog open onOpenChange={(open) => !open && setShowAdd(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Bank Account</DialogTitle>
              <DialogDescription>
                Link a ledger account to a real bank account for statement reconciliation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Ledger Account (ASSET accounts only)</Label>
                <Select value={formAccountId} onValueChange={setFormAccountId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select an account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAccounts.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No available ASSET accounts
                      </SelectItem>
                    ) : (
                      availableAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Bank Name</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Chase, Wells Fargo, PNC"
                  value={formBankName}
                  onChange={(e) => setFormBankName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Last 4 Digits of Account #</Label>
                  <Input
                    className="mt-1"
                    placeholder="1234"
                    maxLength={4}
                    value={formLast4}
                    onChange={(e) => setFormLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                </div>
                <div>
                  <Label>Account Type</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                  <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={actionLoading === 'create'}>
                {actionLoading === 'create' ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
