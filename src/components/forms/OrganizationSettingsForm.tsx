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
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Loader2, Upload, X, Palette } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

const organizationSettingsSchema = z.object({
  name: z.string().min(3, 'Organization name must be at least 3 characters'),
  ein: z.string().optional(),
  mission: z.string().optional(),
  fiscalYearStart: z.date(),
  primaryColor: z.string().regex(HEX_COLOR_REGEX, 'Must be a valid hex color').optional().or(z.literal('')),
  accentColor: z.string().regex(HEX_COLOR_REGEX, 'Must be a valid hex color').optional().or(z.literal('')),
  donorAccessMode: z.enum(['AUTO_APPROVE', 'REQUIRE_APPROVAL']),
  paymentInstructions: z.string().optional(),
  donationsAccountId: z.string().nullable().optional(),
  publicTransparency: z.boolean(),
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
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(
    organization.logoUrl ? `/api/organizations/${organization.slug}/logo` : ''
  );

  const form = useForm<OrganizationSettingsData>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: {
      name: organization.name,
      ein: organization.ein || '',
      mission: organization.mission || '',
      fiscalYearStart: new Date(organization.fiscalYearStart),
      primaryColor: organization.primaryColor || '',
      accentColor: organization.accentColor || '',
      donorAccessMode: organization.donorAccessMode || 'REQUIRE_APPROVAL',
      paymentInstructions: organization.paymentInstructions || '',
      donationsAccountId: organization.donationsAccountId || null,
      publicTransparency: organization.publicTransparency ?? false,
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
          primaryColor: data.primaryColor || null,
          accentColor: data.accentColor || null,
          donorAccessMode: data.donorAccessMode,
          paymentInstructions: data.paymentInstructions || null,
          donationsAccountId: data.donationsAccountId || null,
          publicTransparency: data.publicTransparency,
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingLogo(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/organizations/${organization.slug}/logo`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to upload logo');
      }

      const { logoUrl } = await response.json();
      setCurrentLogoUrl(logoUrl);
      toast({ title: 'Logo uploaded', description: 'Organization logo has been updated.' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload logo',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    try {
      setIsUploadingLogo(true);
      const response = await fetch(`/api/organizations/${organization.slug}/logo`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove logo');

      setCurrentLogoUrl('');
      toast({ title: 'Logo removed' });
      router.refresh();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to remove logo', variant: 'destructive' });
    } finally {
      setIsUploadingLogo(false);
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

            <FormField
              control={form.control}
              name="publicTransparency"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Public Transparency</FormLabel>
                    <FormDescription>
                      When enabled, unauthenticated visitors can view financial summaries,
                      active campaigns, and program spending on your public page.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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

      {/* Branding Section */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-6 text-xl font-semibold text-gray-900">
          <Palette className="mr-2 inline-block h-5 w-5" />
          Branding
        </h2>

        {/* Logo Upload */}
        <div className="mb-6 space-y-4">
          <label className="block text-sm font-medium text-gray-700">Organization Logo</label>
          {currentLogoUrl ? (
            <div className="flex items-center gap-4">
              <img
                src={currentLogoUrl}
                alt={organization.name}
                className="h-20 w-20 rounded-lg border object-contain bg-white"
              />
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Current Logo</p>
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={isUploadingLogo}
                    />
                    <span className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <Upload className="h-3.5 w-3.5" />
                      Replace
                    </span>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleLogoRemove}
                    disabled={isUploadingLogo}
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={isUploadingLogo}
              />
              <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-gray-400 hover:bg-gray-100">
                <div className="text-center">
                  {isUploadingLogo ? (
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
                  ) : (
                    <Upload className="mx-auto h-8 w-8 text-gray-400" />
                  )}
                  <p className="mt-2 text-sm text-gray-600">
                    {isUploadingLogo ? 'Uploading...' : 'Click to upload logo'}
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPEG, WebP, or SVG · Max 500KB</p>
                </div>
              </div>
            </label>
          )}
        </div>

        {/* Theme Colors */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Color</FormLabel>
                    <FormDescription>Used for navigation accents and active states</FormDescription>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={field.value || '#3b82f6'}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="h-10 w-10 cursor-pointer rounded border p-0.5"
                      />
                      <FormControl>
                        <Input
                          placeholder="#3b82f6"
                          {...field}
                          className="font-mono"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accentColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accent Color</FormLabel>
                    <FormDescription>Used for highlights and interactive elements</FormDescription>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={field.value || '#2563eb'}
                        onChange={(e) => field.onChange(e.target.value)}
                        className="h-10 w-10 cursor-pointer rounded border p-0.5"
                      />
                      <FormControl>
                        <Input
                          placeholder="#2563eb"
                          {...field}
                          className="font-mono"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Live preview */}
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">Preview</p>
              <div className="flex items-center gap-3 rounded-md p-3" style={{ backgroundColor: `${form.watch('primaryColor') || '#3b82f6'}15` }}>
                {currentLogoUrl && (
                  <img src={currentLogoUrl} alt="" className="h-8 w-8 rounded object-contain" />
                )}
                <span className="text-sm font-medium" style={{ color: form.watch('primaryColor') || '#3b82f6' }}>
                  {organization.name}
                </span>
                <span className="ml-auto text-xs" style={{ color: form.watch('accentColor') || '#2563eb' }}>
                  Active Link
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Branding
              </Button>
            </div>
          </form>
        </Form>
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
