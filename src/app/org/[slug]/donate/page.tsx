import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { DonationFlow } from '@/components/donations/DonationFlow';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ campaignId?: string }>;
}

export const metadata: Metadata = { title: "Donate" };

export default async function DonatePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { campaignId } = await searchParams;

  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
  });

  if (!organization || organization.verificationStatus !== 'VERIFIED') {
    notFound();
  }

  // If a campaign is specified, look it up for context
  let campaignName: string | null = null;
  if (campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { name: true, organizationId: true, status: true },
    });
    if (campaign && campaign.organizationId === organization.id && campaign.status === 'ACTIVE') {
      campaignName = campaign.name;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <DonationFlow
        organizationSlug={slug}
        organizationName={organization.name}
        primaryColor={organization.primaryColor}
        campaignId={campaignId || null}
        campaignName={campaignName}
      />
    </div>
  );
}
