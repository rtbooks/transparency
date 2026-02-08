'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const organizationSchema = z.object({
  name: z.string().min(3, 'Organization name must be at least 3 characters'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug must be less than 50 characters')
    .regex(
      /^[a-z0-9-]+$/,
      'Slug can only contain lowercase letters, numbers, and hyphens'
    ),
  ein: z.string().optional(),
  mission: z.string().optional(),
  fiscalYearStart: z.date(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

interface CreateOrganizationFormProps {
  onSuccess?: (slug: string) => void;
}

export function CreateOrganizationForm({ onSuccess }: CreateOrganizationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoGenerateSlug, setAutoGenerateSlug] = useState(true);

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: '',
      slug: '',
      ein: '',
      mission: '',
      fiscalYearStart: new Date(new Date().getFullYear(), 0, 1), // January 1st of current year
    },
  });

  const organizationName = form.watch('name');

  // Auto-generate slug from organization name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  };

  // Update slug when name changes (if auto-generate is enabled)
  if (autoGenerateSlug && organizationName) {
    const newSlug = generateSlug(organizationName);
    if (newSlug !== form.getValues('slug')) {
      form.setValue('slug', newSlug);
    }
  }

  const onSubmit = async (data: OrganizationFormData) => {
    try {
      setIsSubmitting(true);

      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          slug: data.slug,
          ein: data.ein || null,
          mission: data.mission || null,
          fiscalYearStart: data.fiscalYearStart.toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create organization');
      }

      const result = await response.json();

      toast({
        title: 'Success!',
        description: `${data.name} has been created successfully.`,
      });

      if (onSuccess) {
        onSuccess(result.slug);
      } else {
        router.push(`/org/${result.slug}/dashboard`);
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create organization',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., GRIT Hoops Westwood Basketball"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                The full legal name of your nonprofit organization
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL Slug</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="e.g., grit-hoops"
                    {...field}
                    disabled={autoGenerateSlug}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAutoGenerateSlug(!autoGenerateSlug)}
                  >
                    {autoGenerateSlug ? 'Manual' : 'Auto'}
                  </Button>
                </div>
              </FormControl>
              <FormDescription>
                This will be part of your organization's URL: yourdomain.com/
                {field.value || 'slug'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ein"
          render={({ field }) => (
            <FormItem>
              <FormLabel>EIN / Tax ID (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., 12-3456789"
                  {...field}
                />
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
                Most nonprofits use January 1st or July 1st
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Organization
          </Button>
        </div>
      </form>
    </Form>
  );
}
