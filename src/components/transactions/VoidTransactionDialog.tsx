'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatTransactionAmount } from '@/lib/utils/account-tree';

interface VoidTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSlug: string;
  transaction: {
    id: string;
    transactionDate: string | Date;
    amount: number | string | { toString(): string };
    description: string;
    type: string;
    debitAccount?: { code: string; name: string; type?: string };
    creditAccount?: { code: string; name: string; type?: string };
  };
  onSuccess?: () => void;
}

export function VoidTransactionDialog({
  open,
  onOpenChange,
  organizationSlug,
  transaction,
  onSuccess,
}: VoidTransactionDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [voidReason, setVoidReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVoid = async () => {
    if (!voidReason.trim()) {
      setError('A reason for voiding is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/organizations/${organizationSlug}/transactions/${transaction.id}/void`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voidReason: voidReason.trim() }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to void transaction');
      }

      toast({
        title: 'Transaction Voided',
        description: 'The transaction has been voided and balances have been reversed.',
      });

      router.refresh();
      onOpenChange(false);
      setVoidReason('');
      onSuccess?.();
    } catch (err) {
      console.error('Error voiding transaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to void transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setVoidReason('');
        setError(null);
      }
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void Transaction</AlertDialogTitle>
          <AlertDialogDescription>
            This action will reverse the balance effects of this transaction. The transaction will remain visible in the ledger as voided for audit purposes.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Transaction summary */}
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="destructive">Voiding</Badge>
            <span className="font-medium">
              {formatTransactionAmount(transaction.amount, transaction.type, transaction.creditAccount?.type)}
            </span>
          </div>
          <p className="text-gray-700">{transaction.description}</p>
          <p className="mt-1 text-gray-600">
            {new Date(transaction.transactionDate).toLocaleDateString()} — {transaction.debitAccount?.code} → {transaction.creditAccount?.code}
          </p>
        </div>

        {/* Reason input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Reason for voiding <span className="text-red-500">*</span>
          </label>
          <Textarea
            placeholder="Why is this transaction being voided?"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            disabled={isSubmitting}
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleVoid}
            disabled={isSubmitting || !voidReason.trim()}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Void Transaction
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
