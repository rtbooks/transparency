import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { checkOrganizationAccess, VerificationStatusMessage } from '@/lib/organization-access';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { AllDonationsPageClient } from '@/components/donations/AllDonationsPageClient';

export default async function DonationsOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/sign-in');
  }

  const { organization, userAccess, user } = await checkOrganizationAccess(slug, clerkUserId, false);

  if (!userAccess && !user.isPlatformAdmin) {
    return (
      <OrganizationLayoutWrapper organizationSlug={slug}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-gray-600">
              You need to be a member of this organization to view donations.
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
      <AllDonationsPageClient
        organizationSlug={slug}
        organizationName={organization.name}
      />
    </OrganizationLayoutWrapper>
  );
}
