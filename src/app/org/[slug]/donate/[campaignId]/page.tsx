import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { getCampaignById } from '@/services/campaign.service';
import { PublicCampaignPage } from '@/components/campaigns/PublicCampaignPage';

interface Props {
  params: Promise<{ slug: string; campaignId: string }>;
}

export default async function DonateCampaignPage({ params }: Props) {
  const { slug, campaignId } = await params;

  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
  });

  if (!organization || organization.verificationStatus !== 'VERIFIED') {
    notFound();
  }

  const campaign = await getCampaignById(campaignId);

  if (!campaign || campaign.organizationId !== organization.id || campaign.status !== 'ACTIVE') {
    notFound();
  }

  // Serialize Decimal fields
  const serializedCampaign = {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    targetAmount: campaign.targetAmount ? Number(campaign.targetAmount) : null,
    amountRaised: campaign.amountRaised ? Number(campaign.amountRaised) : 0,
    donationCount: campaign.donationCount ?? 0,
    progressPercent: campaign.progressPercent ?? 0,
    campaignType: campaign.campaignType,
    unitPrice: campaign.unitPrice ? Number(campaign.unitPrice) : null,
    maxUnits: campaign.maxUnits,
    unitLabel: campaign.unitLabel,
    allowMultiUnit: campaign.allowMultiUnit,
    unitsSold: campaign.unitsSold ?? 0,
    unitsRemaining: campaign.unitsRemaining ?? null,
    startDate: campaign.startDate?.toISOString() ?? null,
    endDate: campaign.endDate?.toISOString() ?? null,
    tiers: ((campaign as any).tiers || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      amount: Number(t.amount),
      maxSlots: t.maxSlots,
      slotsFilled: t.slotsFilled ?? 0,
    })),
  };

  return (
    <PublicCampaignPage
      campaign={serializedCampaign}
      organizationName={organization.name}
      organizationSlug={slug}
      organizationMission={organization.mission}
      primaryColor={organization.primaryColor}
    />
  );
}
