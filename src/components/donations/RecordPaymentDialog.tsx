'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

export type PaymentMethodType =
  | 'STRIPE'
  | 'VENMO'
  | 'PAYPAL'
  | 'CHECK'
  | 'CASH'
  | 'CASH_APP'
  | 'ZELLE'
  | 'BANK_TRANSFER'
  | 'OTHER';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
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

interface CashAccount {
  id: string;
  name: string;
  code: string;
}

interface RecordPaymentDialogProps {
  donorLabel: string;
  amount: number;
  amountReceived: number;
  cashAccounts: CashAccount[];
  loading: boolean;
  onSubmit: (data: {
    amount: number;
    transactionDate: string;
    cashAccountId: string;
    description?: string;
    notes?: string;
    paymentMethod: string;
  }) => void;
  onCancel: () => void;
}

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export function RecordPaymentDialog({
  donorLabel,
  amount,
  amountReceived,
  cashAccounts,
  loading,
  onSubmit,
  onCancel,
}: RecordPaymentDialogProps) {
  const remaining = amount - amountReceived;
  const [paymentAmount, setPaymentAmount] = useState(remaining.toFixed(2));
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashAccountId, setCashAccountId] = useState(cashAccounts[0]?.id || '');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('OTHER');

  const handleSubmit = () => {
    onSubmit({
      amount: parseFloat(paymentAmount),
      transactionDate: paymentDate,
      cashAccountId,
      description: description || undefined,
      notes: notes || undefined,
      paymentMethod,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h3 className="mb-1 text-lg font-semibold text-gray-900">Record Payment</h3>
        <p className="mb-4 text-sm text-gray-600">
          {donorLabel} — {formatCurrency(amountReceived)} of {formatCurrency(amount)} received
        </p>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Amount ($)</label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Remaining: {formatCurrency(remaining)}
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
              className={selectClassName}
              value={cashAccountId}
              onChange={(e) => setCashAccountId(e.target.value)}
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
              className={selectClassName}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethodType[]).map((key) => (
                <option key={key} value={key}>{PAYMENT_METHOD_LABELS[key]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description (Optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Check #1234"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes (Optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Internal notes about this payment"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !cashAccountId || !paymentAmount}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
