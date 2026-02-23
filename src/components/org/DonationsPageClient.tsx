'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { DollarSign, Clock, CheckCircle, AlertCircle, Plus, Target, UserCheck, Loader2 } from 'lucide-react';
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
  campaignName?: string | null;
  campaignId?: string | null;
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

interface ClaimableContact {
  id: string;
  name: string;
  email: string | null;
  roles: string[];
  type: string;
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
  const [claimable, setClaimable] = useState<ClaimableContact[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [hasLinkedContact, setHasLinkedContact] = useState<boolean | null>(null);

  const fetchDonations = useCallback(async () => {
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
  }, [organizationSlug]);

  useEffect(() => {
    fetchDonations();
  }, [fetchDonations]);

  // Check if user has a linked contact; if not, look for claimable ones
  useEffect(() => {
    async function checkContactLink() {
      try {
        const res = await fetch(`/api/organizations/${organizationSlug}/contacts/me`);
        if (res.ok) {
          setHasLinkedContact(true);
        } else {
          setHasLinkedContact(false);
          const body = await res.json();
          if (body.claimable && body.claimable.length > 0) {
            setClaimable(body.claimable);
          }
        }
      } catch {
        // ignore
      }
    }
    checkContactLink();
  }, [organizationSlug]);

  const handleClaim = async (contactId: string) => {
    setClaiming(true);
    try {
      const res = await fetch(`/api/organizations/${organizationSlug}/contacts/me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to link contact');
      }
      setHasLinkedContact(true);
      setClaimable([]);
      // Refresh donations now that we're linked
      setLoading(true);
      await fetchDonations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClaiming(false);
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

      {/* Claimable Contact Banner */}
      {hasLinkedContact === false && claimable.length > 0 && (
        <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-start gap-3">
            <UserCheck className="mt-0.5 h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">
                We found a contact matching your email
              </h3>
              <p className="mt-1 text-sm text-blue-800">
                Link your account to see your donation history and manage your pledges.
              </p>
              <div className="mt-3 space-y-2">
                {claimable.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between rounded-md border border-blue-200 bg-white px-4 py-3"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{contact.name}</div>
                      <div className="text-sm text-gray-500">{contact.email}</div>
                      <div className="mt-1 flex gap-1">
                        {contact.roles.map((r) => (
                          <Badge key={r} variant="outline" className="text-xs">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleClaim(contact.id)}
                      disabled={claiming}
                    >
                      {claiming ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <UserCheck className="mr-1 h-3 w-3" />
                      )}
                      Link to My Account
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
                    {pledge.campaignName && (
                      <div className="mt-1 flex items-center gap-1">
                        <Target className="h-3 w-3 text-green-600" />
                        <span className="text-xs font-medium text-green-700">
                          {pledge.campaignName}
                        </span>
                      </div>
                    )}
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
