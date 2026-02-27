'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  CreditCard,
  Smartphone,
  Mail,
  Building2,
  Plus,
  Link2,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

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

interface AvailablePaymentMethod {
  id: string;
  type: PaymentMethodType;
  label: string | null;
  instructions: string | null;
  handle: string | null;
  paymentUrl: string | null;
  payableTo: string | null;
  mailingAddress: string | null;
  stripeFeePercent?: number;
  stripeFeeFixed?: number;
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

interface DonationFlowProps {
  organizationSlug: string;
  organizationName: string;
  campaignId?: string | null;
  campaignName?: string | null;
  suggestedAmount?: number | null;
  primaryColor?: string | null;
}

type FlowStep = 'amount' | 'method' | 'details' | 'manual-confirm';

export function DonationFlow({
  organizationSlug,
  organizationName,
  campaignId,
  campaignName,
  suggestedAmount,
  primaryColor,
}: DonationFlowProps) {
  const [step, setStep] = useState<FlowStep>('amount');
  const [methods, setMethods] = useState<AvailablePaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [amount, setAmount] = useState(suggestedAmount?.toString() || '');
  const [selectedMethod, setSelectedMethod] = useState<AvailablePaymentMethod | null>(null);
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorMessage, setDonorMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    fetch(`/api/organizations/${organizationSlug}/payment-methods`)
      .then((res) => res.json())
      .then((data) => {
        setMethods(data.paymentMethods || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [organizationSlug]);

  const parsedAmount = parseFloat(amount);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount >= 1;

  // Fee calculation using the selected Stripe method's configured rates
  const stripeMethod = methods.find((m) => m.type === 'STRIPE');
  const feePercent = stripeMethod?.stripeFeePercent ?? 2.9;
  const feeFixed = stripeMethod?.stripeFeeFixed ?? 0.30;
  const feeRate = feePercent / 100;
  const totalWithFees = isValidAmount
    ? Math.ceil(((parsedAmount + feeFixed) / (1 - feeRate)) * 100) / 100
    : 0;
  const feeAmount = isValidAmount ? totalWithFees - parsedAmount : 0;

  const handleStripeCheckout = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/donations/checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: parsedAmount,
            campaignId: campaignId || null,
            donorName,
            donorEmail,
            donorMessage: donorMessage || undefined,
            isAnonymous,
          }),
        }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to start checkout');
      }
    } catch {
      alert('Failed to start checkout');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualDonation = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/organizations/${organizationSlug}/donations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'ONE_TIME',
            amount: parsedAmount,
            donorName,
            donorEmail,
            donorMessage: donorMessage || undefined,
            isAnonymous,
            paymentMethod: selectedMethod?.type,
            campaignId: campaignId || null,
            selfReported: true,
          }),
        }
      );
      if (res.ok) {
        setStep('manual-confirm');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to record donation');
      }
    } catch {
      alert('Failed to record donation');
    } finally {
      setSubmitting(false);
    }
  };

  const accentStyle = primaryColor
    ? { backgroundColor: primaryColor, borderColor: primaryColor }
    : {};

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <p className="text-gray-600">
          This organization has not set up donation methods yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        {/* Header */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Donate to {organizationName}
          </h2>
          {campaignName && (
            <p className="mt-1 text-gray-600">{campaignName}</p>
          )}
        </div>

        {/* Step 1: Amount */}
        {step === 'amount' && (
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Donation Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7 text-lg"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              {/* Quick amounts */}
              <div className="mt-3 flex gap-2">
                {[25, 50, 100, 250].map((val) => (
                  <button
                    key={val}
                    className="flex-1 rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                    onClick={() => setAmount(val.toString())}
                  >
                    ${val}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              style={accentStyle}
              disabled={!isValidAmount}
              onClick={() => setStep('method')}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 2: Payment Method */}
        {step === 'method' && (
          <div className="space-y-4">
            <button
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              onClick={() => setStep('amount')}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <p className="text-sm text-gray-600">
              Donating <span className="font-semibold">${parsedAmount.toFixed(2)}</span> — choose a payment method:
            </p>
            <div className="space-y-2">
              {methods.map((method) => {
                const Icon = METHOD_ICONS[method.type] || Plus;
                return (
                  <button
                    key={method.id}
                    className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition hover:border-gray-400 ${
                      selectedMethod?.id === method.id
                        ? 'border-blue-500 bg-blue-50'
                        : ''
                    }`}
                    onClick={() => {
                      setSelectedMethod(method);
                      setStep('details');
                    }}
                  >
                    <Icon className="h-5 w-5 text-gray-600" />
                    <span className="font-medium">
                      {method.label || method.type}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Donor Details */}
        {step === 'details' && selectedMethod && (
          <div className="space-y-4">
            <button
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              onClick={() => setStep('method')}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">${parsedAmount.toFixed(2)}</span> via{' '}
              <span className="font-semibold">
                {selectedMethod.label || selectedMethod.type}
              </span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Your Name
                </label>
                <Input
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <Input
                  type="email"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Message (optional)
                </label>
                <Textarea
                  value={donorMessage}
                  onChange={(e) => setDonorMessage(e.target.value)}
                  placeholder="Add a message..."
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={isAnonymous}
                  onCheckedChange={setIsAnonymous}
                />
                <span className="text-sm text-gray-700">
                  Make my donation anonymous
                </span>
              </div>
            </div>

            {/* Stripe: show fee info + direct checkout */}
            {selectedMethod.type === 'STRIPE' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  A processing fee of ${feeAmount.toFixed(2)} will be added — you&apos;ll be charged ${totalWithFees.toFixed(2)} so {organizationName} receives the full ${parsedAmount.toFixed(2)}.
                </p>
                <Button
                  className="w-full"
                  style={accentStyle}
                  disabled={!donorName || !donorEmail || submitting}
                  onClick={handleStripeCheckout}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Pay ${totalWithFees.toFixed(2)} with Card
                </Button>
              </div>
            )}

            {/* Manual methods: show instructions + confirm */}
            {selectedMethod.type !== 'STRIPE' && (
              <div className="space-y-4">
                <div className="rounded-md bg-gray-50 p-4">
                  <h4 className="mb-2 font-medium text-gray-900">
                    Payment Instructions
                  </h4>
                  {selectedMethod.handle && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Send to:</span>{' '}
                      {selectedMethod.handle}
                    </p>
                  )}
                  {selectedMethod.payableTo && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Make checks payable to:</span>{' '}
                      {selectedMethod.payableTo}
                    </p>
                  )}
                  {selectedMethod.mailingAddress && (
                    <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
                      <span className="font-medium">Mail to:</span>{' '}
                      {selectedMethod.mailingAddress}
                    </p>
                  )}
                  {selectedMethod.instructions && (
                    <p className="mt-2 text-sm text-gray-600">
                      {selectedMethod.instructions}
                    </p>
                  )}
                  {selectedMethod.paymentUrl && (
                    <a
                      href={selectedMethod.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open {selectedMethod.label || selectedMethod.type}
                    </a>
                  )}
                </div>

                <Button
                  className="w-full"
                  style={accentStyle}
                  disabled={!donorName || !donorEmail || submitting}
                  onClick={handleManualDonation}
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  I&apos;ve Sent My Donation
                </Button>
                <p className="text-center text-xs text-gray-500">
                  The organization will confirm receipt of your payment.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Manual confirmation */}
        {step === 'manual-confirm' && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="text-xl font-bold text-gray-900">Thank You!</h3>
            <p className="text-gray-600">
              Your donation of <span className="font-semibold">${parsedAmount.toFixed(2)}</span> to{' '}
              {organizationName} has been recorded. The organization will
              confirm receipt of your payment.
            </p>
            <Button
              variant="outline"
              onClick={() => (window.location.href = `/org/${organizationSlug}`)}
            >
              Back to Organization
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
