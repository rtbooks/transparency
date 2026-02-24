'use client';

import { useEffect, useState, useCallback } from 'react';
import { DollarSign, Users, CheckCircle, Clock, AlertCircle, Target, Pencil, X, Loader2 } from 'lucide-react';
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
                        {canModifyDonation(donation) && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(donation)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setCancellingDonationId(donation.id)}
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
    </div>
  );
}
