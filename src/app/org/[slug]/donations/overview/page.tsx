import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
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

  const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
  if (!user) redirect('/sign-in');

  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
  });
  if (!organization) redirect('/');

  // Verify membership
  const orgUsers = await prisma.organizationUser.findMany({
    where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
  });
  if (!orgUsers[0]) redirect('/');

  return (
    <AllDonationsPageClient
      organizationSlug={slug}
      organizationName={organization.name}
    />
  );
}
