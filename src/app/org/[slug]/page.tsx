import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { PublicOrgContent } from '@/components/org/PublicOrgContent';

interface OrganizationPageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrganizationPublicPage({
  params,
}: OrganizationPageProps) {
  const { slug } = await params;

  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
  });

  if (!organization || organization.verificationStatus !== 'VERIFIED') {
    notFound();
  }

  // Get basic financial summary (always fetched for member display)
  const [transactionCount, totalRevenue, totalExpenses] = await Promise.all([
    prisma.transaction.count({
      where: buildCurrentVersionWhere({ organizationId: organization.id, isVoided: false }),
    }),
    prisma.transaction.aggregate({
      where: buildCurrentVersionWhere({ organizationId: organization.id, type: 'INCOME', isVoided: false }),
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: buildCurrentVersionWhere({ organizationId: organization.id, type: 'EXPENSE', isVoided: false }),
      _sum: { amount: true },
    }),
  ]);

  // Fetch additional public data when transparency is enabled
  let campaigns: Array<{ id: string; name: string; targetAmount: number | null; status: string }> = [];
  let programSpending: Array<{ id: string; title: string; amount: number; status: string }> = [];

  if (organization.publicTransparency) {
    const [campaignRows, spendingRows] = await Promise.all([
      prisma.campaign.findMany({
        where: { organizationId: organization.id, status: 'ACTIVE' },
        select: { id: true, name: true, targetAmount: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.programSpending.findMany({
        where: buildCurrentVersionWhere({ organizationId: organization.id }),
        select: { id: true, title: true, estimatedAmount: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    campaigns = campaignRows.map(c => ({
      ...c,
      targetAmount: c.targetAmount ? Number(c.targetAmount) : null,
      status: c.status,
    }));

    programSpending = spendingRows.map(s => ({
      ...s,
      amount: Number(s.estimatedAmount),
    }));
  }

  // Check auth state for access request CTA
  const { userId: clerkUserId } = await auth();
  let userState: 'anonymous' | 'member' | 'pending_request' | 'can_request' = 'anonymous';

  if (clerkUserId) {
    const user = await prisma.user.findUnique({
      where: { authId: clerkUserId },
    });

    if (user) {
      const orgUsers = await prisma.organizationUser.findMany({
        where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
      });

      if (orgUsers[0]) {
        userState = 'member';
      } else {
        // Check for pending access request
        const existingRequest = await prisma.accessRequest.findFirst({
          where: { organizationId: organization.id, userId: user.id, status: 'PENDING' },
        });
        userState = existingRequest ? 'pending_request' : 'can_request';
      }
    }
  }

  return (
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <PublicOrgContent
        organization={{
          name: organization.name,
          slug: organization.slug,
          mission: organization.mission,
          ein: organization.ein,
          donorAccessMode: organization.donorAccessMode,
          publicTransparency: organization.publicTransparency,
        }}
        financials={{
          transactionCount,
          totalRevenue: Number(totalRevenue._sum.amount || 0),
          totalExpenses: Number(totalExpenses._sum.amount || 0),
        }}
        campaigns={campaigns}
        programSpending={programSpending}
        userState={userState}
      />
    </OrganizationLayoutWrapper>
  );
}
