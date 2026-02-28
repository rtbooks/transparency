'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { DollarSign, Clock, CheckCircle, AlertCircle, Plus, Target, UserCheck, Loader2, Pencil, X, CreditCard, Smartphone, Mail, Link2, Building2, Wallet, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/account-tree';
import { trackEvent } from '@/lib/analytics';
import { VenmoQRCode } from '@/components/donations/VenmoQRCode';

interface Payment {
  id: string;
  amount: number;
  date: string;
  notes?: string | null;
  description?: string | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
}

type PaymentMethodType =
  | 'STRIPE'
  | 'VENMO'
  | 'PAYPAL'
  | 'CHECK'
  | 'CASH'
  | 'CASH_APP'
  | 'ZELLE'
  | 'BANK_TRANSFER'
  | 'OTHER';

interface PaymentMethodInfo {
  id: string;
  type: PaymentMethodType;
  label: string | null;
  instructions: string | null;
  handle: string | null;
  payableTo: string | null;
  mailingAddress: string | null;
}

const METHOD_ICONS: Record<PaymentMethodType, React.ElementType> = {
  STRIPE: CreditCard,
  VENMO: Smartphone,
  PAYPAL: Link2,
  CHECK: Mail,
  CASH: Building2,
  CASH_APP: Smartphone,
  ZELLE: Building2,
  BANK_TRANSFER: Building2,
  OTHER: Plus,
};

const METHOD_LABELS: Record<PaymentMethodType, string> = {
  STRIPE: 'Credit / Debit Card',
  VENMO: 'Venmo',
  PAYPAL: 'PayPal',
  CHECK: 'Check',
  CASH: 'Cash',
  CASH_APP: 'Cash App',
  ZELLE: 'Zelle',
  BANK_TRANSFER: 'Bank Transfer',
  OTHER: 'Other',
};

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
  payments: Payment[];
  campaignName?: string | null;
  campaignId?: string | null;
  donorMessage?: string | null;
}

interface DonationsData {
  donations: DonationItem[];
  summary: {
    totalPledged: number;
    totalPaid: number;
    outstanding: number;
  };
  isAdmin?: boolean;
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
  PLEDGED: { label: 'Pledged', variant: 'outline' },
  PARTIAL: { label: 'Partially Received', variant: 'default' },
  RECEIVED: { label: 'Received', variant: 'default' },
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
  const [editingDonation, setEditingDonation] = useState<DonationItem | null>(null);
  const [editAmount, setEditAmount] = useState('');
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodInfo[]>([]);
  const [payNowDonation, setPayNowDonation] = useState<DonationItem | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [paymentMethodType, setPaymentMethodType] = useState('OTHER');
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());

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

  // Fetch available payment methods for "Pay Now"
  useEffect(() => {
    async function fetchPaymentMethods() {
      try {
        const res = await fetch(`/api/organizations/${organizationSlug}/payment-methods`);
        if (res.ok) {
          const json = await res.json();
          setPaymentMethods(json.paymentMethods || []);
        }
      } catch {
        // ignore
      }
    }
    fetchPaymentMethods();
  }, [organizationSlug]);

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
      trackEvent('contact_linked', { orgSlug: organizationSlug });
      // Refresh donations now that we're linked
      setLoading(true);
      await fetchDonations();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  };

  const canModifyDonation = (donation: DonationItem) => {
    if (donation.status === 'CANCELLED' || donation.status === 'RECEIVED') return false;
    // Admins can edit any non-terminal donation
    if (data?.isAdmin) return true;
    // Regular users can only edit their own pledged donations with no payments
    return donation.status === 'PLEDGED' && donation.amountReceived === 0;
  };

  const isAdmin = data?.isAdmin ?? false;

  // Fetch cash/bank accounts for payment dialog (admin only)
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
    setPaymentMethodType('OTHER');
  };

  const handleStripeCheckout = async (donation: DonationItem) => {
    setStripeLoading(true);
    try {
      const remaining = donation.amount - donation.amountReceived;
      const res = await fetch(
        `/api/organizations/${organizationSlug}/donations/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: remaining,
            donationId: donation.id,
            campaignId: donation.campaignId || undefined,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to start checkout');
      }
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      setError(err.message);
      setStripeLoading(false);
    }
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
            paymentMethod: paymentMethodType,
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
            dueDate: editDueDate || null,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to update donation');
      }
      trackEvent('pledge_updated', { orgSlug: organizationSlug });
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
      trackEvent('pledge_cancelled', { orgSlug: organizationSlug });
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Donations</h1>
          <p className="mt-1 text-gray-600">{organizationName}</p>
        </div>
        <Link href={`/org/${organizationSlug}/my-donations/new`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Donation
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

      {/* Donation List */}
      {donations.length === 0 ? (
        <div className="rounded-lg border bg-white p-12 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No donations yet
          </h3>
          <p className="mt-2 text-gray-600">
            Create a donation or pledge to get started.
          </p>
          <Link href={`/org/${organizationSlug}/my-donations/new`}>
            <Button className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              New Donation
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Your Donations</h2>
          {donations.map((donation) => {
            const config = statusConfig[donation.status] || statusConfig.PLEDGED;
            return (
              <div key={donation.id} className="rounded-lg border bg-white p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">
                        {formatCurrency(donation.amount)}
                      </h3>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                    {donation.campaignName && (
                      <div className="mt-1 flex items-center gap-1">
                        <Target className="h-3 w-3 text-green-600" />
                        <span className="text-xs font-medium text-green-700">
                          {donation.campaignName}
                        </span>
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Pledged on{' '}
                      {new Date(donation.donationDate).toLocaleDateString()}
                      {donation.dueDate && (
                        <> · Due {new Date(donation.dueDate).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      Received: {formatCurrency(donation.amountReceived)} / {formatCurrency(donation.amount)}
                    </p>
                      {/* Pay Now button — visible to all users for unpaid pledges */}
                      {(donation.status === 'PLEDGED' || donation.status === 'PARTIAL') && paymentMethods.length > 0 && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => setPayNowDonation(donation)}
                          >
                            <Wallet className="mr-1 h-3 w-3" />
                            Pay Now
                          </Button>
                        </div>
                      )}
                      {canModifyDonation(donation) && (
                        <div className="mt-2 flex justify-end gap-2">
                          {isAdmin && (donation.status === 'PLEDGED' || donation.status === 'PARTIAL') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => openPaymentDialog(donation)}
                            >
                              <CreditCard className="mr-1 h-3 w-3" />
                              Record Payment
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(donation)}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setCancellingDonationId(donation.id)}
                          >
                            <X className="mr-1 h-3 w-3" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                </div>

                {/* Payment history */}
                {donation.payments.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <button
                      className="flex w-full items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
                      onClick={() => setExpandedPayments((prev) => {
                        const next = new Set(prev);
                        if (next.has(donation.id)) {
                          next.delete(donation.id);
                        } else {
                          next.add(donation.id);
                        }
                        return next;
                      })}
                    >
                      {expandedPayments.has(donation.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      Payments ({donation.payments.length})
                    </button>
                    {expandedPayments.has(donation.id) && (
                      <div className="mt-2 space-y-2">
                      {donation.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="rounded-md bg-gray-50 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">
                              {new Date(payment.date).toLocaleDateString()}
                            </span>
                            <span className="font-medium text-gray-900">
                              {formatCurrency(payment.amount)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                            {payment.paymentMethod && (
                              <span>{METHOD_LABELS[payment.paymentMethod as PaymentMethodType] || payment.paymentMethod}</span>
                            )}
                            {payment.referenceNumber && (
                              <span>Ref: {payment.referenceNumber.length > 20 ? payment.referenceNumber.slice(0, 20) + '…' : payment.referenceNumber}</span>
                            )}
                          </div>
                          {payment.description && (
                            <p className="mt-1 text-xs text-gray-500">{payment.description}</p>
                          )}
                          {payment.notes && (
                            <p className="mt-1 text-xs italic text-gray-400">{payment.notes}</p>
                          )}
                        </div>
                      ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      {editingDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Edit Pledge</h3>
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
              This will cancel your pledge and reverse the accounting entry. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCancellingDonationId(null)} disabled={actionLoading}>
                Keep Pledge
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
                <label className="mb-1 block text-sm font-medium text-gray-700">Payment Method</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={paymentMethodType}
                  onChange={(e) => setPaymentMethodType(e.target.value)}
                >
                  {(Object.keys(METHOD_LABELS) as PaymentMethodType[]).map((key) => (
                    <option key={key} value={key}>{METHOD_LABELS[key]}</option>
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

      {/* Pay Now Dialog — shows payment methods for donors */}
      {payNowDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-1 text-lg font-semibold text-gray-900">Pay Your Pledge</h3>
            <p className="mb-4 text-sm text-gray-600">
              {formatCurrency(payNowDonation.amount - payNowDonation.amountReceived)} remaining
              {payNowDonation.campaignName && (
                <span className="text-green-700"> · {payNowDonation.campaignName}</span>
              )}
            </p>
            <div className="space-y-3">
              {paymentMethods.map((method) => {
                const Icon = METHOD_ICONS[method.type] || Plus;
                return (
                  <div key={method.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-gray-600" />
                      <span className="font-medium text-gray-900">
                        {method.label || METHOD_LABELS[method.type]}
                      </span>
                    </div>
                    {method.handle && (
                      <p className="mt-2 text-sm text-gray-700">
                        Send to: <span className="font-medium">{method.handle}</span>
                      </p>
                    )}
                    {method.payableTo && (
                      <p className="mt-1 text-sm text-gray-700">
                        Make payable to: <span className="font-medium">{method.payableTo}</span>
                      </p>
                    )}
                    {method.mailingAddress && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                        Mail to: {method.mailingAddress}
                      </p>
                    )}
                    {method.instructions && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                        {method.instructions}
                      </p>
                    )}
                    {method.type === 'VENMO' && method.handle && (
                      <VenmoQRCode
                        handle={method.handle}
                        amount={payNowDonation.amount - payNowDonation.amountReceived}
                        note={`Donation${payNowDonation.campaignName ? ` — ${payNowDonation.campaignName}` : ''}`}
                      />
                    )}
                    {method.type !== 'STRIPE' && (
                      <p className="mt-3 text-xs italic text-gray-400">
                        Your donation will be recorded by the organization once they confirm receipt.
                      </p>
                    )}
                    {method.type === 'STRIPE' && (() => {
                      const remaining = payNowDonation.amount - payNowDonation.amountReceived;
                      const pct = (method as any).stripeFeePercent ?? 2.9;
                      const fixed = (method as any).stripeFeeFixed ?? 0.30;
                      const rate = pct / 100;
                      const total = Math.ceil(((remaining + fixed) / (1 - rate)) * 100) / 100;
                      const fee = total - remaining;
                      return (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-gray-500">
                            A processing fee of {formatCurrency(fee)} will be added — you&apos;ll pay {formatCurrency(total)} so the org receives the full {formatCurrency(remaining)}.
                          </p>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleStripeCheckout(payNowDonation)}
                            disabled={stripeLoading}
                          >
                            {stripeLoading ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <CreditCard className="mr-1 h-3 w-3" />
                            )}
                            Pay {formatCurrency(total)} with Card
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => { setPayNowDonation(null); setStripeLoading(false); }}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
