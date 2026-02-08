'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RecordTransactionForm } from './RecordTransactionForm';
import { Plus } from 'lucide-react';

interface RecordTransactionButtonProps {
  organizationSlug: string;
}

export function RecordTransactionButton({
  organizationSlug,
}: RecordTransactionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${organizationSlug}/accounts`
      );
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Record Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Transaction</DialogTitle>
          <DialogDescription>
            Record income, expenses, or transfers using double-entry bookkeeping.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-gray-500">
            Loading accounts...
          </div>
        ) : (
          <RecordTransactionForm
            organizationSlug={organizationSlug}
            accounts={accounts.map((a) => ({
              id: a.id,
              code: a.code,
              name: a.name,
              type: a.type,
            }))}
            onSuccess={handleSuccess}
            onCancel={() => setIsOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
