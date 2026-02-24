'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Link2 } from 'lucide-react';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  transactionDate: string;
  type: string;
  debitAccount?: { name: string };
  creditAccount?: { name: string };
}

interface LinkTransactionDialogProps {
  organizationSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
  spendingItemId: string;
  existingTransactionIds: string[];
}

export function LinkTransactionDialog({
  organizationSlug,
  open,
  onOpenChange,
  onLinked,
  spendingItemId,
  existingTransactionIds,
}: LinkTransactionDialogProps) {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);

      const res = await fetch(
        `/api/organizations/${organizationSlug}/transactions?${params}`
      );
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      // Filter out already-linked transactions
      const filtered = (data.transactions || []).filter(
        (tx: Transaction) => !existingTransactionIds.includes(tx.id)
      );
      setTransactions(filtered);
    } catch {
      toast({ title: 'Error', description: 'Failed to load transactions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [organizationSlug, search, existingTransactionIds, toast]);

  useEffect(() => {
    if (open) fetchTransactions();
  }, [open, fetchTransactions]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const handleLink = async (tx: Transaction) => {
    try {
      setLinking(tx.id);
      const res = await fetch(
        `/api/organizations/${organizationSlug}/program-spending/${spendingItemId}/transactions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: tx.id,
            amount: tx.amount,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to link');
      }
      toast({ title: 'Linked', description: `Transaction "${tx.description}" linked` });
      onLinked();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to link transaction',
        variant: 'destructive',
      });
    } finally {
      setLinking(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Transaction</DialogTitle>
          <DialogDescription>
            Search and select a transaction to link to this spending item.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No available transactions found.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(tx.transactionDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm">{tx.description}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLink(tx)}
                      disabled={linking === tx.id}
                    >
                      <Link2 className="mr-1 h-3 w-3" />
                      {linking === tx.id ? 'Linking...' : 'Link'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
