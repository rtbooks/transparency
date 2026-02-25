import { redirect, notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { getCampaignById } from '@/services/campaign.service';
import { createAccessRequest } from '@/services/access-request.service';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { NewPledgeFormClient } from '@/components/org/NewPledgeFormClient';

interface Props {
  params: Promise<{ slug: string; campaignId: string }>;
}

export default async function CampaignPledgePage({ params }: Props) {
  const { slug, campaignId } = await params;
  const { userId: clerkUserId } = await auth();

  // If not signed in, redirect to sign-in with return URL
  if (!clerkUserId) {
    const returnUrl = `/org/${slug}/donate/${campaignId}/pledge`;
    redirect(`/login?redirect_url=${encodeURIComponent(returnUrl)}`);
  }

  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
  });

  if (!organization || organization.verificationStatus !== 'VERIFIED') {
    notFound();
  }

  // Verify campaign exists and is active
  const campaign = await getCampaignById(campaignId);
  if (!campaign || campaign.organizationId !== organization.id || campaign.status !== 'ACTIVE') {
    notFound();
  }

  const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
  if (!user) {
    redirect(`/login?redirect_url=${encodeURIComponent(`/org/${slug}/donate/${campaignId}/pledge`)}`);
  }

  // Check if user is already a member
  const existingMembership = await prisma.organizationUser.findFirst({
    where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
  });

  if (!existingMembership) {
    // Auto-join the organization as SUPPORTER
    try {
      await createAccessRequest({
        organizationId: organization.id,
        userId: user.id,
        message: `Joining to donate to campaign: ${campaign.name}`,
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
  }

  return (
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <NewPledgeFormClient
        organizationSlug={slug}
        organizationName={organization.name}
        paymentInstructions={organization.paymentInstructions}
        initialCampaignId={campaignId}
      />
    </OrganizationLayoutWrapper>
  );
}
