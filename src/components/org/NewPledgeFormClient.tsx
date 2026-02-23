'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { trackEvent } from '@/lib/analytics';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, CheckCircle, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils/account-tree';

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
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch(`/api/organizations/${organizationSlug}/campaigns`);
        if (res.ok) {
          const data = await res.json();
          setCampaigns((data.campaigns || []).filter((c: any) => c.status === 'ACTIVE'));
        }
      } catch (e) {
        // Ignore — campaigns are optional
      } finally {
        setLoadingCampaigns(false);
      }
    }
    fetchCampaigns();
  }, [organizationSlug]);

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
            campaignId: selectedCampaignId || null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create pledge');
      }

      setPledgeCreated(true);
      trackEvent('pledge_created', {
        amount: data.amount,
        orgSlug: organizationSlug,
        campaignId: selectedCampaignId || undefined,
      });
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
            {/* Campaign Picker */}
            {!loadingCampaigns && campaigns.length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-medium">
                  Direct Your Donation (Optional)
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCampaignId(null)}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      !selectedCampaignId
                        ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">General Donation</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Support the organization&apos;s overall mission
                    </p>
                  </button>
                  {campaigns.map((campaign) => (
                    <button
                      key={campaign.id}
                      type="button"
                      onClick={() => setSelectedCampaignId(campaign.id)}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        selectedCampaignId === campaign.id
                          ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-green-600" />
                        <p className="font-medium text-gray-900">{campaign.name}</p>
                      </div>
                      {campaign.description && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                          {campaign.description}
                        </p>
                      )}
                      {campaign.targetAmount && (
                        <div className="mt-2">
                          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-green-500"
                              style={{ width: `${campaign.progressPercent || 0}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500">
                            {formatCurrency(campaign.amountRaised)} of{' '}
                            {formatCurrency(campaign.targetAmount)} raised
                          </p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
