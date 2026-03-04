import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { checkOrganizationAccess, VerificationStatusMessage } from '@/lib/organization-access';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { NewPledgeFormClient } from '@/components/org/NewPledgeFormClient';
import { createAccessRequest } from '@/services/access-request.service';

interface NewPledgePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ campaignId?: string }>;
}

export const metadata: Metadata = { title: "Record Donation" };

export default async function NewPledgePage({ params, searchParams }: NewPledgePageProps) {
  const { slug } = await params;
  const { campaignId } = await searchParams;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    const returnUrl = campaignId
      ? `/org/${slug}/my-donations/new?campaignId=${campaignId}`
      : `/org/${slug}/my-donations/new`;
    redirect(`/login?redirect_url=${encodeURIComponent(returnUrl)}`);
  }

  const { organization, userAccess, user } = await checkOrganizationAccess(slug, clerkUserId, false);

  // Auto-join the organization as SUPPORTER when arriving via campaign invitation
  if (!userAccess && !user.isPlatformAdmin && campaignId) {
    try {
      const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
      const campaignName = campaign?.name || 'a campaign';

      await createAccessRequest({
        organizationId: organization.id,
        userId: user.id,
        message: `Joining to donate to campaign: ${campaignName}`,
      });
    } catch (error: any) {
      // If already has membership or pending request, continue
      if (!error?.message?.includes('already')) {
        throw error;
      }
    }

    // If org requires approval, show pending message
    if (organization.donorAccessMode === 'REQUIRE_APPROVAL') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <div className="mx-auto max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Access Request Submitted</h2>
            <p className="mt-2 text-gray-600">
              Your request to join {organization.name} has been submitted and is awaiting approval.
              You&apos;ll be able to donate once approved.
            </p>
            <a
              href={`/org/${slug}`}
              className="mt-4 inline-block text-sm text-blue-600 hover:underline"
            >
              Return to {organization.name}
            </a>
          </div>
        </div>
      );
    }

    // Re-check access after auto-join (for AUTO_APPROVE mode)
    const { userAccess: refreshedAccess } = await checkOrganizationAccess(slug, clerkUserId, false);
    if (!refreshedAccess) {
      return (
        <OrganizationLayoutWrapper organizationSlug={slug}>
          <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
              <p className="mt-2 text-gray-600">
                You need to be a member of this organization to create a pledge.
              </p>
            </div>
          </div>
        </OrganizationLayoutWrapper>
      );
    }
  } else if (!userAccess && !user.isPlatformAdmin) {
    return (
      <OrganizationLayoutWrapper organizationSlug={slug}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-gray-600">
              You need to be a member of this organization to create a pledge.
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
      <NewPledgeFormClient
        organizationSlug={slug}
        organizationName={organization.name}
        initialCampaignId={campaignId}
      />
    </OrganizationLayoutWrapper>
  );
}
