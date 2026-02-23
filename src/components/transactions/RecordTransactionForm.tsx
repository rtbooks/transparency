'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ContactSelector } from '@/components/contacts/ContactSelector';
import { formatCurrency } from '@/lib/utils/account-tree';
import { trackEvent } from '@/lib/analytics';
import {
  TransactionType,
  getAccountTypesForTransaction,
  validateTransaction,
  prepareTransactionPayload,
} from '@/lib/utils/transaction-utils';

const formSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER', 'GENERAL']),
  date: z.date(),
  amount: z.number().positive('Amount must be greater than zero'),
  description: z.string().min(1, 'Description is required'),
  referenceNumber: z.string().optional(),
  fromAccountId: z.string().min(1, 'Please select an account'),
  toAccountId: z.string().min(1, 'Please select an account'),
});

type FormValues = z.infer<typeof formSchema>;

interface RecordTransactionFormProps {
  organizationSlug: string;
  accounts: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
  }>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function RecordTransactionForm({
  organizationSlug,
  accounts,
  onSuccess,
  onCancel,
}: RecordTransactionFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);
  const [outstandingBills, setOutstandingBills] = useState<Array<{
    id: string;
    description: string | null;
    direction: string;
    amount: number;
    amountPaid: number;
    dueDate: string | null;
  }>>([]);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [loadingBills, setLoadingBills] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'INCOME',
      date: new Date(),
      amount: 0,
      description: '',
      referenceNumber: '',
      fromAccountId: '',
      toAccountId: '',
    },
  });

  const selectedType = form.watch('type') as TransactionType;
  const accountConfig = getAccountTypesForTransaction(selectedType);

  const fromAccounts = accounts.filter((a) =>
    accountConfig.fromTypes.includes(a.type)
  );
  const toAccounts = accounts.filter((a) =>
    accountConfig.toTypes.includes(a.type)
  );

  // Fetch outstanding bills when contact changes
  const handleContactChange = async (newContactId: string | null) => {
    setContactId(newContactId);
    setSelectedBillId(null);
    setOutstandingBills([]);

    if (!newContactId) return;

    try {
      setLoadingBills(true);
      const res = await fetch(
        `/api/organizations/${organizationSlug}/bills?contactId=${newContactId}&limit=50`
      );
      if (res.ok) {
        const data = await res.json();
        // Filter to only outstanding (non-PAID, non-CANCELLED) bills
        const outstanding = (data.bills || []).filter(
          (b: { status: string; amount: number; amountPaid: number }) =>
            !['PAID', 'CANCELLED'].includes(b.status) &&
            parseFloat(String(b.amount)) - parseFloat(String(b.amountPaid)) > 0
        );
        setOutstandingBills(outstanding);
      }
    } catch {
      // Silently fail — bill linking is optional
    } finally {
      setLoadingBills(false);
    }
  };

  async function onSubmit(values: FormValues) {
    const error = validateTransaction({
      type: values.type as TransactionType,
      date: values.date,
      amount: values.amount,
      description: values.description,
      referenceNumber: values.referenceNumber,
      fromAccountId: values.fromAccountId,
      toAccountId: values.toAccountId,
    });

    if (error) {
      form.setError('root', { message: error });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = prepareTransactionPayload({
        type: values.type as TransactionType,
        date: values.date,
        amount: values.amount,
        description: values.description,
        referenceNumber: values.referenceNumber,
        fromAccountId: values.fromAccountId,
        toAccountId: values.toAccountId,
      });

      const response = await fetch(
        `/api/organizations/${organizationSlug}/transactions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, contactId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to record transaction');
      }

      const transaction = await response.json();

      // Link to bill if one was selected
      if (selectedBillId && transaction.id) {
        try {
          await fetch(
            `/api/organizations/${organizationSlug}/bills/${selectedBillId}/payments`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transactionId: transaction.id,
              }),
            }
          );
        } catch {
          // Payment link failed but transaction was created — notify user
          toast({
            title: 'Transaction Recorded',
            description: 'Transaction created but could not be linked to the bill. You can link it manually from the bill detail.',
            variant: 'destructive',
          });
          router.refresh();
          if (onSuccess) onSuccess();
          return;
        }
      }

      toast({
        title: 'Transaction Recorded',
        description: `Successfully recorded ${values.type.toLowerCase()} transaction of $${values.amount.toFixed(2)}`,
      });
      trackEvent('transaction_created', {
        amount: values.amount,
        type: values.type,
        orgSlug: organizationSlug,
      });

      router.refresh();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error recording transaction:', error);
      form.setError('root', {
        message:
          error instanceof Error ? error.message : 'Failed to record transaction',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transaction Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select transaction type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="INCOME">Income (Revenue → Cash)</SelectItem>
                  <SelectItem value="EXPENSE">Expense (Cash → Expense)</SelectItem>
                  <SelectItem value="TRANSFER">Transfer (Cash → Cash)</SelectItem>
                  <SelectItem value="GENERAL">General Journal Entry</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                {selectedType === 'INCOME' && 'Record donations, grants, or other revenue'}
                {selectedType === 'EXPENSE' && 'Record expenses paid from cash/bank'}
                {selectedType === 'TRANSFER' && 'Transfer funds between accounts'}
                {selectedType === 'GENERAL' && 'Advanced: Create custom debit/credit entry'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className="w-full pl-3 text-left font-normal"
                    >
                      {field.value ? (
                        format(field.value, 'PPP')
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date > new Date() || date < new Date('1900-01-01')
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="fromAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{accountConfig.fromLabel}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {fromAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="toAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{accountConfig.toLabel}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {toAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter transaction description..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <label className="text-sm font-medium">Contact (Optional)</label>
          <p className="text-sm text-muted-foreground mb-2">Link this transaction to a payee or donor</p>
          <ContactSelector
            organizationSlug={organizationSlug}
            value={contactId}
            onChange={handleContactChange}
          />
        </div>

        {/* Outstanding Bills for selected contact */}
        {contactId && outstandingBills.length > 0 && (
          <div>
            <label className="text-sm font-medium">Link to Bill (Optional)</label>
            <p className="text-sm text-muted-foreground mb-2">Apply this transaction as payment against an outstanding bill</p>
            <Select
              value={selectedBillId ?? "__none__"}
              onValueChange={(v) => setSelectedBillId(v === "__none__" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a bill..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No bill — standalone transaction</SelectItem>
                {outstandingBills.map((bill) => {
                  const remaining = (parseFloat(String(bill.amount)) || 0) - (parseFloat(String(bill.amountPaid)) || 0);
                  return (
                    <SelectItem key={bill.id} value={bill.id}>
                      {bill.description || 'Unnamed'} — {formatCurrency(remaining)} remaining
                      {bill.dueDate ? ` (due ${new Date(bill.dueDate).toLocaleDateString()})` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
        {contactId && loadingBills && (
          <p className="text-xs text-muted-foreground">Checking for outstanding bills...</p>
        )}

        <FormField
          control={form.control}
          name="referenceNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reference Number (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Check #, Invoice #, etc."
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Check number, invoice number, or other reference
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <div className="text-sm font-medium text-destructive">
            {form.formState.errors.root.message}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Transaction
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
