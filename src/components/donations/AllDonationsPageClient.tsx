'use client';

import { useEffect, useState, useCallback } from 'react';
import { DollarSign, Users, CheckCircle, Clock, AlertCircle, Target, Pencil, X, Loader2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/account-tree';

interface DonationItem {
  id: string;
  contactName: string;
  amount: number;
  amountReceived: number;
  description: string | null;
  status: string;
  type: string;
  donationDate: string;
  dueDate?: string | null;
  campaignName?: string | null;
  isAnonymous?: boolean;
}

interface DonationsOverviewData {
  donations: DonationItem[];
  summary: {
    totalPledged: number;
    totalPaid: number;
    outstanding: number;
  };
  isAdmin?: boolean;
}

interface AllDonationsPageClientProps {
  organizationSlug: string;
  organizationName: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PLEDGED: { label: 'Pledged', variant: 'outline' },
  PARTIAL: { label: 'Partial', variant: 'default' },
  RECEIVED: { label: 'Received', variant: 'default' },
  CANCELLED: { label: 'Cancelled', variant: 'secondary' },
};

const typeConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  ONE_TIME: { label: 'One-Time', variant: 'secondary' },
  PLEDGE: { label: 'Pledge', variant: 'outline' },
};

export function AllDonationsPageClient({
  organizationSlug,
  organizationName,
}: AllDonationsPageClientProps) {
  const [data, setData] = useState<DonationsOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [editingDonation, setEditingDonation] = useState<DonationItem | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [cancellingDonationId, setCancellingDonationId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [payingDonation, setPayingDonation] = useState<DonationItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentCashAccountId, setPaymentCashAccountId] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [cashAccounts, setCashAccounts] = useState<Array<{ id: string; name: string; code: string }>>([]);

  const fetchDonations = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${organizationSlug}/donations?view=all`);
      if (!res.ok) throw new Error('Failed to load donations');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [organizationSlug]);

  useEffect(() => {
    fetchDonations();
  }, [fetchDonations]);

  const isAdmin = data?.isAdmin ?? false;

  const canModifyDonation = (donation: DonationItem) => {
    if (!isAdmin) return false;
    return donation.status !== 'CANCELLED' && donation.status !== 'RECEIVED';
  };

  const canRecordPayment = (donation: DonationItem) => {
    if (!isAdmin) return false;
    return donation.status === 'PLEDGED' || donation.status === 'PARTIAL';
  };

  // Fetch cash/bank accounts for payment dialog
  useEffect(() => {
    if (!isAdmin) return;
    async function fetchCashAccounts() {
      try {
        const res = await fetch(`/api/organizations/${organizationSlug}/accounts`);
        if (res.ok) {
          const json = await res.json();
          const accounts = (json.accounts || json || []).filter(
            (a: any) => a.type === 'ASSET' && a.isActive
          );
          setCashAccounts(accounts.map((a: any) => ({ id: a.id, name: a.name, code: a.code })));
          if (accounts.length > 0) setPaymentCashAccountId(accounts[0].id);
        }
      } catch { /* ignore */ }
    }
    fetchCashAccounts();
  }, [organizationSlug, isAdmin]);

  const openPaymentDialog = (donation: DonationItem) => {
    const remaining = donation.amount - donation.amountReceived;
    setPayingDonation(donation);
    setPaymentAmount(remaining.toFixed(2));
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentDescription('');
    setPaymentNotes('');
  };

  const handlePaymentSubmit = async () => {
    if (!payingDonation || !paymentCashAccountId) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/donations/${payingDonation.id}/payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(paymentAmount),
            transactionDate: paymentDate,
            cashAccountId: paymentCashAccountId,
            description: paymentDescription || undefined,
            notes: paymentNotes || undefined,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to record payment');
      }
      setPayingDonation(null);
      setLoading(true);
      await fetchDonations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditDialog = (donation: DonationItem) => {
    setEditingDonation(donation);
    setEditAmount(String(donation.amount));
    setEditDescription(donation.description || '');
    setEditDueDate(donation.dueDate ? donation.dueDate.split('T')[0] : '');
  };

  const handleEditSubmit = async () => {
    if (!editingDonation) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/donations/${editingDonation.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parseFloat(editAmount),
            description: editDescription,
            dueDate: editDueDate || null,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to update donation');
      }
      setEditingDonation(null);
      setLoading(true);
      await fetchDonations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (donationId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/donations/${donationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cancel: true }),
        }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to cancel donation');
      }
      setCancellingDonationId(null);
      setLoading(true);
      await fetchDonations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center text-red-600">
          <AlertCircle className="mx-auto h-8 w-8" />
          <p className="mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { donations, summary } = data;

  const filtered = statusFilter === 'ALL'
    ? donations
    : donations.filter((d) => d.status === statusFilter);

  const uniqueDonors = new Set(donations.filter(d => !d.isAnonymous).map(d => d.contactName)).size;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Donations Overview</h1>
        <p className="mt-1 text-gray-600">{organizationName}</p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">Donors</p>
              <p className="text-2xl font-bold text-gray-900">{uniqueDonors}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Pledged</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalPledged)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Total Received</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalPaid)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-sm text-gray-600">Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.outstanding)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4 flex gap-2">
        {['ALL', 'PLEDGED', 'PARTIAL', 'RECEIVED', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'ALL' ? 'All' : (statusConfig[s]?.label || s)}
          </button>
        ))}
      </div>

      {/* Donations Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No donations found</h3>
          <p className="mt-2 text-gray-600">
            {statusFilter !== 'ALL' ? 'Try changing the filter.' : 'No donations have been made yet.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Donor</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Received</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Campaign</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((donation) => {
                const sc = statusConfig[donation.status] || statusConfig.PLEDGED;
                const tc = typeConfig[donation.type] || typeConfig.PLEDGE;
                return (
                  <tr key={donation.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {donation.isAnonymous ? 'Anonymous' : donation.contactName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <Badge variant={tc.variant}>{tc.label}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{formatCurrency(donation.amount)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{formatCurrency(donation.amountReceived)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {donation.campaignName ? (
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3 text-green-600" />
                          {donation.campaignName}
                        </span>
                      ) : (
                        <span className="text-gray-400">General</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                      {new Date(donation.donationDate).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {canRecordPayment(donation) && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => openPaymentDialog(donation)}
                              title="Record Payment"
                            >
                              <CreditCard className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(donation)} title="Edit">
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setCancellingDonationId(donation.id)}
                              title="Cancel"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Dialog */}
      {editingDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Edit Donation</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Amount ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Due Date (Optional)</label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditingDonation(null)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button onClick={handleEditSubmit} disabled={actionLoading}>
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation */}
      {cancellingDonationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">Cancel Donation?</h3>
            <p className="mb-6 text-sm text-gray-600">
              This will cancel the donation and reverse the accounting entry. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCancellingDonationId(null)} disabled={actionLoading}>
                Keep Donation
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleCancel(cancellingDonationId)}
                disabled={actionLoading}
              >
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Dialog */}
      {payingDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-1 text-lg font-semibold text-gray-900">Record Payment</h3>
            <p className="mb-4 text-sm text-gray-600">
              {payingDonation.isAnonymous ? 'Anonymous' : payingDonation.contactName} —{' '}
              {formatCurrency(payingDonation.amountReceived)} of {formatCurrency(payingDonation.amount)} received
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Amount ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={payingDonation.amount - payingDonation.amountReceived}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Remaining: {formatCurrency(payingDonation.amount - payingDonation.amountReceived)}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Transaction Date</label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Cash / Bank Account</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={paymentCashAccountId}
                  onChange={(e) => setPaymentCashAccountId(e.target.value)}
                >
                  {cashAccounts.length === 0 && <option value="">No accounts available</option>}
                  {cashAccounts.map((acct) => (
                    <option key={acct.id} value={acct.id}>
                      {acct.code} - {acct.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description (Optional)</label>
                <Input
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                  placeholder="e.g., Check #1234"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes (Optional)</label>
                <Textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  placeholder="Internal notes about this payment"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setPayingDonation(null)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                onClick={handlePaymentSubmit}
                disabled={actionLoading || !paymentCashAccountId || !paymentAmount}
              >
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
