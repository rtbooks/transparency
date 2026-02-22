'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Organization } from '@/generated/prisma/client';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Loader2, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const organizationSettingsSchema = z.object({
  name: z.string().min(3, 'Organization name must be at least 3 characters'),
  ein: z.string().optional(),
  mission: z.string().optional(),
  fiscalYearStart: z.date(),
  logoUrl: z.string().optional(),
  donorAccessMode: z.enum(['AUTO_APPROVE', 'REQUIRE_APPROVAL']),
  paymentInstructions: z.string().optional(),
  donationsAccountId: z.string().nullable().optional(),
});

type OrganizationSettingsData = z.infer<typeof organizationSettingsSchema>;

interface OrganizationSettingsFormProps {
  organization: Organization;
}

export function OrganizationSettingsForm({
  organization,
}: OrganizationSettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OrganizationSettingsData>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: {
      name: organization.name,
      ein: organization.ein || '',
      mission: organization.mission || '',
      fiscalYearStart: new Date(organization.fiscalYearStart),
      logoUrl: organization.logoUrl || '',
      donorAccessMode: organization.donorAccessMode || 'REQUIRE_APPROVAL',
      paymentInstructions: organization.paymentInstructions || '',
      donationsAccountId: organization.donationsAccountId || null,
    },
  });

  // Fetch Revenue accounts for donations account dropdown
  const [revenueAccounts, setRevenueAccounts] = useState<Array<{ id: string; name: string; code: string }>>([]);
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch(`/api/organizations/${organization.slug}/accounts`);
        if (res.ok) {
          const data = await res.json();
          const accounts = (data.accounts || data || []).filter(
            (a: any) => a.type === 'REVENUE' && !a.parentAccountId
          );
          setRevenueAccounts(accounts.map((a: any) => ({ id: a.id, name: a.name, code: a.code })));
        }
      } catch (e) {
        console.error('Failed to load accounts:', e);
      }
    }
    fetchAccounts();
  }, [organization.slug]);

  const onSubmit = async (data: OrganizationSettingsData) => {
    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/organizations/${organization.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          ein: data.ein || null,
          mission: data.mission || null,
          fiscalYearStart: data.fiscalYearStart.toISOString(),
          logoUrl: data.logoUrl || null,
          donorAccessMode: data.donorAccessMode,
          paymentInstructions: data.paymentInstructions || null,
          donationsAccountId: data.donationsAccountId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update organization');
      }

      toast({
        title: 'Success!',
        description: 'Organization settings have been updated.',
      });

      router.refresh();
    } catch (error) {
      console.error('Error updating organization:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to update organization',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">
          Basic Information
        </h2>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Organization name" {...field} />
                  </FormControl>
                  <FormDescription>
                    The full legal name of your nonprofit organization
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">URL Slug</p>
                  <p className="text-sm text-gray-600">
                    /{organization.slug}
                  </p>
                </div>
                <div className="rounded-md bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                  Cannot be changed
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="ein"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>EIN / Tax ID (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 12-3456789" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your organization's Employer Identification Number
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mission"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mission Statement (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your organization's mission and goals..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A brief description of your organization's purpose
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fiscalYearStart"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fiscal Year Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className="w-full pl-3 text-left font-normal"
                        >
                          {field.value ? (
                            format(field.value, 'MMMM d, yyyy')
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
                  <FormDescription>
                    Most nonprofits use January 1st or July 1st. Changing this
                    affects financial reports.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/${organization.slug}/dashboard`)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Donor Settings */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">
          Donor Settings
        </h2>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="donorAccessMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Donor Access Mode</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={field.value}
                      onChange={field.onChange}
                    >
                      <option value="REQUIRE_APPROVAL">
                        Require admin approval for donor access requests
                      </option>
                      <option value="AUTO_APPROVE">
                        Auto-approve donor access requests
                      </option>
                    </select>
                  </FormControl>
                  <FormDescription>
                    Controls whether donors who request access are automatically
                    approved or need manual review by an admin.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="donationsAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Donations Account</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    >
                      <option value="">None (auto-detect)</option>
                      {revenueAccounts.map((acct) => (
                        <option key={acct.id} value={acct.id}>
                          {acct.code} - {acct.name}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormDescription>
                    Designate a top-level Revenue account for donations. Child
                    accounts under it can be used as fundraising campaigns.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Instructions (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Mail checks to 123 Main St... or Venmo @org-name..."
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Instructions shown to donors on how to submit donations
                    (check, wire transfer, Venmo, etc.)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Donor Settings
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Logo Upload Section */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">
          Organization Logo
        </h2>

        <div className="space-y-4">
          {organization.logoUrl ? (
            <div className="flex items-center gap-4">
              <img
                src={organization.logoUrl}
                alt={organization.name}
                className="h-20 w-20 rounded-lg border object-cover"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Current Logo
                </p>
                <p className="text-sm text-gray-600">{organization.logoUrl}</p>
              </div>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">No logo uploaded</p>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-800">
              <strong>Coming soon:</strong> Logo upload functionality will be
              available in the next update. You can manually set a logo URL
              above for now.
            </p>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-red-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-red-900">Danger Zone</h2>
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-red-900">Delete Organization</p>
              <p className="text-sm text-red-700">
                Permanently delete this organization and all its data. This
                action cannot be undone.
              </p>
            </div>
            <Button variant="destructive" disabled>
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
