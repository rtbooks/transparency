'use client';

import { useEffect, useState, useCallback } from 'react';
import { DollarSign, Clock, CheckCircle, AlertCircle, Target, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/account-tree';

interface Payment {
  id: string;
  amount: number;
  date: string;
  notes?: string | null;
}

interface Pledge {
  id: string;
  contactName: string;
  amount: number;
  amountPaid: number;
  description: string;
  status: string;
  issueDate: string;
  dueDate?: string | null;
  payments: Payment[];
  campaignName?: string | null;
}

interface DonationsData {
  pledges: Pledge[];
  summary: {
    totalPledged: number;
    totalPaid: number;
    outstanding: number;
  };
}

interface AllDonationsPageClientProps {
  organizationSlug: string;
  organizationName: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  PENDING: { label: 'Pending', variant: 'outline' },
  PARTIAL: { label: 'Partially Paid', variant: 'default' },
  PAID: { label: 'Paid', variant: 'default' },
  OVERDUE: { label: 'Overdue', variant: 'destructive' },
  CANCELLED: { label: 'Cancelled', variant: 'secondary' },
};

export function AllDonationsPageClient({
  organizationSlug,
  organizationName,
}: AllDonationsPageClientProps) {
  const [data, setData] = useState<DonationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');

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

  const { pledges, summary } = data;

  const filteredPledges = statusFilter === 'ALL'
    ? pledges
    : statusFilter === 'ACTIVE'
      ? pledges.filter(p => !['PAID', 'CANCELLED'].includes(p.status))
      : pledges.filter(p => p.status === statusFilter);

  const donorCount = new Set(pledges.map(p => p.contactName)).size;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Donations</h1>
        <p className="mt-1 text-gray-600">
          All donations and pledges for {organizationName}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">Donors</p>
              <p className="text-2xl font-bold text-gray-900">{donorCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Pledged</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.totalPledged)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Total Received</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.totalPaid)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-6">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-sm text-gray-600">Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.outstanding)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Filter */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Status:</label>
        <select
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ACTIVE">Active (Outstanding)</option>
          <option value="ALL">All</option>
          <option value="PENDING">Pending</option>
          <option value="PARTIAL">Partially Paid</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <span className="text-sm text-gray-500">
          {filteredPledges.length} pledge{filteredPledges.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Pledge Table */}
      {filteredPledges.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No donations found</h3>
          <p className="mt-2 text-gray-600">
            {statusFilter === 'ACTIVE'
              ? 'No outstanding pledges at this time.'
              : 'No donations match the selected filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Donor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Campaign
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Pledged
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Paid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPledges.map((pledge) => {
                const config = statusConfig[pledge.status] || statusConfig.PENDING;
                return (
                  <tr key={pledge.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {pledge.contactName}
                    </td>
                    <td className="max-w-xs truncate px-6 py-4 text-sm text-gray-600">
                      {pledge.description}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {pledge.campaignName ? (
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3 text-green-600" />
                          <span className="text-green-700">{pledge.campaignName}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(pledge.amount)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-600">
                      {formatCurrency(pledge.amountPaid)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(pledge.issueDate).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
