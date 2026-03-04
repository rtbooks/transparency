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

  // If a campaign is specified, fetch full campaign data for type-specific UI
  let campaignData: any = null;
  if (campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        tiers: { orderBy: { sortOrder: 'asc' } },
        items: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (campaign && campaign.organizationId === organization.id && campaign.status === 'ACTIVE') {
      campaignData = {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        campaignType: campaign.campaignType,
        unitPrice: campaign.unitPrice ? Number(campaign.unitPrice) : null,
        unitLabel: campaign.unitLabel,
        maxUnits: campaign.maxUnits,
        allowMultiUnit: campaign.allowMultiUnit,
        tiers: campaign.tiers.map((t) => ({
          id: t.id,
          name: t.name,
          amount: Number(t.amount),
          maxSlots: t.maxSlots,
        })),
        items: campaign.items.map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          category: i.category,
          price: Number(i.price),
          maxQuantity: i.maxQuantity,
          minPerOrder: i.minPerOrder,
          maxPerOrder: i.maxPerOrder,
          isRequired: i.isRequired,
        })),
      };
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <DonationFlow
        organizationSlug={slug}
        organizationName={organization.name}
        primaryColor={organization.primaryColor}
        campaignId={campaignId || null}
        campaignName={campaignData?.name || null}
        campaign={campaignData}
      />
    </div>
  );
}
