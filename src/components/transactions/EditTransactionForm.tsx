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

const editFormSchema = z.object({
  transactionDate: z.date(),
  amount: z.number().positive('Amount must be greater than zero'),
  description: z.string().min(1, 'Description is required'),
  debitAccountId: z.string().min(1, 'Please select a debit account'),
  creditAccountId: z.string().min(1, 'Please select a credit account'),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  changeReason: z.string().min(1, 'A reason for the change is required'),
});

type EditFormValues = z.infer<typeof editFormSchema>;

interface EditTransactionFormProps {
  organizationSlug: string;
  transaction: {
    id: string;
    transactionDate: string | Date;
    amount: number | string | { toString(): string };
    description: string;
    debitAccountId: string;
    creditAccountId: string;
    referenceNumber?: string | null;
    notes?: string | null;
    contactId?: string | null;
    debitAccount?: { code: string; name: string };
    creditAccount?: { code: string; name: string };
  };
  accounts: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
  }>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EditTransactionForm({
  organizationSlug,
  transaction,
  accounts,
  onSuccess,
  onCancel,
}: EditTransactionFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactId, setContactId] = useState<string | null>(transaction.contactId || null);

  const amount = typeof transaction.amount === 'number'
    ? transaction.amount
    : parseFloat(transaction.amount.toString());

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      transactionDate: new Date(transaction.transactionDate),
      amount,
      description: transaction.description,
      debitAccountId: transaction.debitAccountId,
      creditAccountId: transaction.creditAccountId,
      referenceNumber: transaction.referenceNumber || '',
      notes: transaction.notes || '',
      changeReason: '',
    },
  });

  async function onSubmit(values: EditFormValues) {
    if (values.debitAccountId === values.creditAccountId) {
      form.setError('root', { message: 'Debit and credit accounts must be different' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/organizations/${organizationSlug}/transactions/${transaction.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionDate: values.transactionDate.toISOString(),
            amount: values.amount,
            description: values.description,
            debitAccountId: values.debitAccountId,
            creditAccountId: values.creditAccountId,
            referenceNumber: values.referenceNumber || null,
            notes: values.notes || null,
            contactId,
            changeReason: values.changeReason,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to edit transaction');
      }

      toast({
        title: 'Transaction Updated',
        description: 'The transaction has been successfully updated.',
      });

      router.refresh();
      onSuccess?.();
    } catch (error) {
      console.error('Error editing transaction:', error);
      form.setError('root', {
        message: error instanceof Error ? error.message : 'Failed to edit transaction',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Original values banner */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <p className="font-medium">Editing Transaction</p>
          <p className="mt-1 text-blue-700">
            Original: {transaction.debitAccount?.code} → {transaction.creditAccount?.code} for ${amount.toFixed(2)}
          </p>
        </div>

        <FormField
          control={form.control}
          name="transactionDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button variant="outline" className="w-full pl-3 text-left font-normal">
                      {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
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
          name="debitAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Debit Account</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select debit account" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {accounts.map((account) => (
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
          name="creditAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Credit Account</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select credit account" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {accounts.map((account) => (
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
                <Textarea placeholder="Enter transaction description..." {...field} />
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
            onChange={setContactId}
          />
        </div>

        <FormField
          control={form.control}
          name="referenceNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reference Number (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Check #, Invoice #, etc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Additional notes..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="changeReason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason for Change *</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Why are you editing this transaction?"
                  {...field}
                />
              </FormControl>
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
            Save Changes
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
