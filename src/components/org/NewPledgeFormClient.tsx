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
import { Loader2, CheckCircle, Target, Gift, CalendarClock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils/account-tree';

const donationSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Please provide a description'),
  donorMessage: z.string().optional(),
  dueDate: z.string().optional(),
});

type DonationFormData = z.infer<typeof donationSchema>;

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
  const [donationCreated, setDonationCreated] = useState(false);
  const [donationType, setDonationType] = useState<'PLEDGE' | 'ONE_TIME'>('PLEDGE');
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

  const form = useForm<DonationFormData>({
    resolver: zodResolver(donationSchema),
    defaultValues: {
      amount: 0,
      description: '',
      donorMessage: '',
      dueDate: '',
    },
  });

  const onSubmit = async (data: DonationFormData) => {
    try {
      setIsSubmitting(true);

      const response = await fetch(
        `/api/organizations/${organizationSlug}/donations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: donationType,
            amount: data.amount,
            description: data.description,
            donorMessage: data.donorMessage || undefined,
            dueDate: donationType === 'PLEDGE' ? (data.dueDate || null) : null,
            campaignId: selectedCampaignId || null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create donation');
      }

      setDonationCreated(true);
      trackEvent('donation_created', {
        type: donationType,
        amount: data.amount,
        orgSlug: organizationSlug,
        campaignId: selectedCampaignId || undefined,
      });
      toast({
        title: donationType === 'PLEDGE' ? 'Pledge Created!' : 'Donation Recorded!',
        description: donationType === 'PLEDGE'
          ? 'Your donation pledge has been recorded.'
          : 'Your one-time donation has been recorded. Thank you!',
      });
    } catch (error) {
      console.error('Error creating donation:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create donation',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (donationCreated) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-lg border bg-white p-8 text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            {donationType === 'PLEDGE' ? 'Pledge Created Successfully!' : 'Donation Recorded!'}
          </h2>
          <p className="mt-2 text-gray-600">
            Thank you for your {donationType === 'PLEDGE' ? 'pledge' : 'donation'} to {organizationName}.
          </p>

          {donationType === 'PLEDGE' && paymentInstructions && (
            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-6 text-left">
              <h3 className="mb-2 font-semibold text-blue-900">
                How to Submit Your Payment
              </h3>
              <p className="whitespace-pre-wrap text-sm text-blue-800">
                {paymentInstructions}
              </p>
            </div>
          )}

          {donationType === 'PLEDGE' && !paymentInstructions && (
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
            <Button onClick={() => setDonationCreated(false)}>
              Create Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">New Donation</h1>
        <p className="mt-2 text-gray-600">
          Support {organizationName} with a donation or pledge
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6">
        {/* Donation Type Toggle */}
        <div className="mb-6 space-y-3">
          <label className="text-sm font-medium">Donation Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDonationType('ONE_TIME')}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                donationType === 'ONE_TIME'
                  ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Gift className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-gray-900">One-Time Donation</p>
                <p className="text-xs text-gray-500">Immediate contribution</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setDonationType('PLEDGE')}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                donationType === 'PLEDGE'
                  ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <CalendarClock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">Pledge</p>
                <p className="text-xs text-gray-500">Promise to pay later</p>
              </div>
            </button>
          </div>
        </div>

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
                  <FormLabel>Amount ($)</FormLabel>
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
                    {donationType === 'PLEDGE'
                      ? 'The amount you intend to donate'
                      : 'The amount you are donating now'}
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
                      placeholder="e.g., Annual giving, Capital campaign contribution..."
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
              name="donorMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal Message (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="A message to the organization..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {donationType === 'PLEDGE' && (
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
            )}

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
                {donationType === 'PLEDGE' ? 'Create Pledge' : 'Submit Donation'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
