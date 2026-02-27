import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { OrganizationSettingsForm } from '@/components/forms/OrganizationSettingsForm';
import { PaymentMethodsManager } from '@/components/settings/PaymentMethodsManager';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { checkOrganizationAccess, VerificationStatusMessage } from '@/lib/organization-access';

interface OrganizationSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: "Settings" };

export default async function OrganizationSettingsPage({
  params,
}: OrganizationSettingsPageProps) {
  const { slug } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/login');
  }

  const { organization, userAccess, user } = await checkOrganizationAccess(slug, clerkUserId, false);
  
  // Platform admins have access, otherwise need ORG_ADMIN role in this org
  const hasAccess = user.isPlatformAdmin || (userAccess && userAccess.role === 'ORG_ADMIN');
  
  if (!hasAccess) {
    return (
      <OrganizationLayoutWrapper organizationSlug={slug}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-gray-600">
              Only organization administrators can access settings.
            </p>
          </div>
        </div>
      </OrganizationLayoutWrapper>
    );
  }

  const verificationMessage = VerificationStatusMessage({
    status: organization.verificationStatus,
    organizationName: organization.name,
    notes: organization.verificationNotes,
  });

  if (verificationMessage) {
    return verificationMessage;
  }

  return (
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Organization Settings
            </h1>
            <p className="mt-2 text-gray-600">
              Manage {organization.name}'s configuration and details
            </p>
          </div>

          <div className="space-y-6">
            <OrganizationSettingsForm
              organization={organization}
              paymentMethodsSlot={<PaymentMethodsManager organizationSlug={slug} />}
            />
          </div>
        </div>
      </div>
    </OrganizationLayoutWrapper>
  );
}
