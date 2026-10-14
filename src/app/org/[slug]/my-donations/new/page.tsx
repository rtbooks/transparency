import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { checkOrganizationAccess, VerificationStatusMessage } from '@/lib/organization-access';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { NewPledgeFormClient } from '@/components/org/NewPledgeFormClient';

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

  const { organization } = await checkOrganizationAccess(slug, clerkUserId, false);

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
