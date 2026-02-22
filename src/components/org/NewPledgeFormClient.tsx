'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const pledgeSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Please provide a description'),
  dueDate: z.string().optional(),
});

type PledgeFormData = z.infer<typeof pledgeSchema>;

interface NewPledgeFormClientProps {
  organizationSlug: string;
  organizationName: string;
  paymentInstructions: string | null;
}

export function NewPledgeFormClient({
  organizationSlug,
  organizationName,
  paymentInstructions,
}: NewPledgeFormClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pledgeCreated, setPledgeCreated] = useState(false);

  const form = useForm<PledgeFormData>({
    resolver: zodResolver(pledgeSchema),
    defaultValues: {
      amount: 0,
      description: '',
      dueDate: '',
    },
  });

  const onSubmit = async (data: PledgeFormData) => {
    try {
      setIsSubmitting(true);

      const response = await fetch(
        `/api/organizations/${organizationSlug}/donations/pledge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: data.amount,
            description: data.description,
            dueDate: data.dueDate || null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create pledge');
      }

      setPledgeCreated(true);
      toast({
        title: 'Pledge Created!',
        description: 'Your donation pledge has been recorded.',
      });
    } catch (error) {
      console.error('Error creating pledge:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create pledge',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pledgeCreated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-lg border bg-white p-8 text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Pledge Created Successfully!
          </h2>
          <p className="mt-2 text-gray-600">
            Thank you for your pledge to {organizationName}.
          </p>

          {paymentInstructions && (
            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-6 text-left">
              <h3 className="mb-2 font-semibold text-blue-900">
                How to Submit Your Payment
              </h3>
              <p className="whitespace-pre-wrap text-sm text-blue-800">
                {paymentInstructions}
              </p>
            </div>
          )}

          {!paymentInstructions && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-6 text-left">
              <p className="text-sm text-gray-600">
                Please contact the organization for payment submission details.
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/org/${organizationSlug}/donations`)}
            >
              View My Donations
            </Button>
            <Button onClick={() => setPledgeCreated(false)}>
              Create Another Pledge
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">New Donation Pledge</h1>
        <p className="mt-2 text-gray-600">
          Pledge a donation to {organizationName}
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pledge Amount ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    The amount you intend to donate
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description / Purpose</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Annual giving pledge, Capital campaign contribution..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Briefly describe the purpose of your donation
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Date (Optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    When you plan to fulfill this pledge
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/org/${organizationSlug}/donations`)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Pledge
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
