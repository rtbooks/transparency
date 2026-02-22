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

  // Get financial summary (public transparency data)
  const [transactionCount, totalRevenue, totalExpenses] = await Promise.all([
    prisma.transaction.count({
      where: buildCurrentVersionWhere({ organizationId: organization.id }),
    }),
    prisma.transaction.aggregate({
      where: buildCurrentVersionWhere({ organizationId: organization.id, type: 'INCOME' }),
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: buildCurrentVersionWhere({ organizationId: organization.id, type: 'EXPENSE' }),
      _sum: { amount: true },
    }),
  ]);

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
        }}
        financials={{
          transactionCount,
          totalRevenue: Number(totalRevenue._sum.amount || 0),
          totalExpenses: Number(totalExpenses._sum.amount || 0),
        }}
        userState={userState}
      />
    </OrganizationLayoutWrapper>
  );
}
