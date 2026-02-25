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
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [unitCount, setUnitCount] = useState(1);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

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

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
  const isFixedUnit = selectedCampaign?.campaignType === 'FIXED_UNIT';
  const isTiered = selectedCampaign?.campaignType === 'TIERED';

  const onSubmit = async (data: DonationFormData) => {
    try {
      setIsSubmitting(true);

      // For FIXED_UNIT, calculate amount from units
      let finalAmount = data.amount;
      if (isFixedUnit && selectedCampaign?.unitPrice) {
        finalAmount = selectedCampaign.unitPrice * unitCount;
      }
      // For TIERED, use tier amount
      if (isTiered && selectedTierId) {
        const tier = selectedCampaign?.tiers?.find((t: any) => t.id === selectedTierId);
        if (tier) finalAmount = tier.amount;
      }

      const response = await fetch(
        `/api/organizations/${organizationSlug}/donations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'PLEDGE',
            amount: finalAmount,
            description: data.description,
            donorMessage: data.donorMessage || undefined,
            dueDate: data.dueDate || null,
            campaignId: selectedCampaignId || null,
            unitCount: isFixedUnit ? unitCount : null,
            tierId: isTiered ? selectedTierId : null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create donation');
      }

      setDonationCreated(true);
      trackEvent('donation_created', {
        type: 'PLEDGE',
        amount: data.amount,
        orgSlug: organizationSlug,
        campaignId: selectedCampaignId || undefined,
      });
      toast({
        title: 'Pledge Created!',
        description: 'Your donation pledge has been recorded.',
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
              onClick={() => router.push(`/org/${organizationSlug}/my-donations`)}
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
                      onClick={() => {
                        setSelectedCampaignId(campaign.id);
                        setUnitCount(1);
                        setSelectedTierId(null);
                      }}
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
                      {campaign.campaignType === 'FIXED_UNIT' && (
                        <p className="mt-1 text-xs text-blue-600">
                          {formatCurrency(campaign.unitPrice)} per {campaign.unitLabel || 'unit'}
                          {campaign.maxUnits ? ` · ${campaign.maxUnits} available` : ''}
                        </p>
                      )}
                      {campaign.campaignType === 'TIERED' && campaign.tiers?.length > 0 && (
                        <p className="mt-1 text-xs text-purple-600">
                          {campaign.tiers.length} tier{campaign.tiers.length !== 1 ? 's' : ''} available
                        </p>
                      )}
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

            {/* FIXED_UNIT: Unit quantity selector */}
            {isFixedUnit && selectedCampaign && (
              <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <label className="text-sm font-medium text-blue-800">
                  How many {selectedCampaign.unitLabel || 'unit'}(s)?
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="1"
                    max={selectedCampaign.allowMultiUnit ? (selectedCampaign.maxUnits || 999) : 1}
                    step="1"
                    value={unitCount}
                    onChange={(e) => setUnitCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24"
                    disabled={!selectedCampaign.allowMultiUnit}
                  />
                  <span className="text-sm text-blue-700">
                    × {formatCurrency(selectedCampaign.unitPrice)} = {formatCurrency(selectedCampaign.unitPrice * unitCount)}
                  </span>
                </div>
                {selectedCampaign.maxUnits && (
                  <p className="text-xs text-blue-600">
                    {selectedCampaign.unitsRemaining ?? selectedCampaign.maxUnits} of {selectedCampaign.maxUnits} remaining
                  </p>
                )}
              </div>
            )}

            {/* TIERED: Tier picker */}
            {isTiered && selectedCampaign?.tiers?.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select a Tier</label>
                <div className="grid gap-2">
                  {selectedCampaign.tiers.map((tier: any) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setSelectedTierId(tier.id)}
                      className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                        selectedTierId === tier.id
                          ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div>
                        <p className="font-medium">{tier.name}</p>
                        {tier.maxSlots && (
                          <p className="text-xs text-gray-500">
                            {tier.maxSlots - (tier.slotsFilled || 0)} of {tier.maxSlots} slots remaining
                          </p>
                        )}
                      </div>
                      <p className="text-lg font-bold text-purple-700">
                        {formatCurrency(tier.amount)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Amount field — hidden for constrained campaigns */}
            {!isFixedUnit && !isTiered && (
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
                    The amount you intend to donate
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            )}

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
                onClick={() => router.push(`/org/${organizationSlug}/my-donations`)}
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
