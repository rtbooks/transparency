import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { DonationFlow } from '@/components/donations/DonationFlow';

interface Props {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: "Donate" };

export default async function DonatePage({ params }: Props) {
  const { slug } = await params;

  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
  });

  if (!organization || organization.verificationStatus !== 'VERIFIED') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <DonationFlow
        organizationSlug={slug}
        organizationName={organization.name}
        primaryColor={organization.primaryColor}
      />
    </div>
  );
}
