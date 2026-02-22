'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DollarSign, Clock, CheckCircle, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

interface DonationsData {
  pledges: Pledge[];
  summary: {
    totalPledged: number;
    totalPaid: number;
    outstanding: number;
  };
  paymentInstructions: string | null;
}

interface DonationsPageClientProps {
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

export function DonationsPageClient({
  organizationSlug,
  organizationName,
}: DonationsPageClientProps) {
  const [data, setData] = useState<DonationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDonations() {
      try {
        const res = await fetch(`/api/organizations/${organizationSlug}/donations`);
        if (!res.ok) throw new Error('Failed to load donations');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDonations();
  }, [organizationSlug]);

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

  const { pledges, summary, paymentInstructions } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Donations</h1>
          <p className="mt-1 text-gray-600">{organizationName}</p>
        </div>
        <Link href={`/org/${organizationSlug}/donations/new`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Pledge
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              <p className="text-sm text-gray-600">Total Paid</p>
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

      {/* Payment Instructions */}
      {paymentInstructions && (
        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-2 font-semibold text-blue-900">Payment Instructions</h3>
          <p className="whitespace-pre-wrap text-sm text-blue-800">{paymentInstructions}</p>
        </div>
      )}

      {/* Pledge List */}
      {pledges.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No pledges yet
          </h3>
          <p className="mt-2 text-gray-600">
            Create a pledge to get started with your donation.
          </p>
          <Link href={`/org/${organizationSlug}/donations/new`}>
            <Button className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Create Pledge
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Your Pledges</h2>
          {pledges.map((pledge) => {
            const config = statusConfig[pledge.status] || statusConfig.PENDING;
            return (
              <div key={pledge.id} className="rounded-lg border bg-white p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">
                        {formatCurrency(pledge.amount)}
                      </h3>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{pledge.description}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Pledged on {new Date(pledge.issueDate).toLocaleDateString()}
                      {pledge.dueDate && (
                        <> · Due {new Date(pledge.dueDate).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      Paid: {formatCurrency(pledge.amountPaid)} / {formatCurrency(pledge.amount)}
                    </p>
                  </div>
                </div>

                {/* Payment history */}
                {pledge.payments.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <p className="mb-2 text-sm font-medium text-gray-700">Payments</p>
                    <div className="space-y-2">
                      {pledge.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-gray-600">
                            {new Date(payment.date).toLocaleDateString()}
                          </span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(payment.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
