import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { PublicOrgContent } from '@/components/org/PublicOrgContent';

interface OrganizationPageProps {
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: "Home" };

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

  // Get basic financial summary using double-entry principles:
  // Net expenses = debits to expense accounts - credits to expense accounts
  // Net revenue  = credits to revenue accounts - debits to revenue accounts
  const [expenseAccounts, revenueAccounts] = await Promise.all([
    prisma.account.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, type: 'EXPENSE' }),
      select: { id: true },
    }),
    prisma.account.findMany({
      where: buildCurrentVersionWhere({ organizationId: organization.id, type: 'REVENUE' }),
      select: { id: true },
    }),
  ]);
  const expenseAccountIds = expenseAccounts.map(a => a.id);
  const revenueAccountIds = revenueAccounts.map(a => a.id);

  const baseWhere = buildCurrentVersionWhere({ organizationId: organization.id, isVoided: false });

  const [transactionCount, expenseDebits, expenseCredits, revenueCredits, revenueDebits] = await Promise.all([
    prisma.transaction.count({ where: baseWhere }),
    // Debits to expense accounts (expenses incurred)
    expenseAccountIds.length > 0
      ? prisma.transaction.aggregate({
          where: { ...baseWhere, debitAccountId: { in: expenseAccountIds } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    // Credits to expense accounts (expense reductions / reimbursements)
    expenseAccountIds.length > 0
      ? prisma.transaction.aggregate({
          where: { ...baseWhere, creditAccountId: { in: expenseAccountIds } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    // Credits to revenue accounts (revenue earned)
    revenueAccountIds.length > 0
      ? prisma.transaction.aggregate({
          where: { ...baseWhere, creditAccountId: { in: revenueAccountIds } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    // Debits to revenue accounts (revenue reversals)
    revenueAccountIds.length > 0
      ? prisma.transaction.aggregate({
          where: { ...baseWhere, debitAccountId: { in: revenueAccountIds } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
  ]);

  const netExpenses = Number(expenseDebits._sum.amount || 0) - Number(expenseCredits._sum.amount || 0);
  const netRevenue = Number(revenueCredits._sum.amount || 0) - Number(revenueDebits._sum.amount || 0);

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
          totalRevenue: netRevenue,
          totalExpenses: netExpenses,
        }}
        campaigns={campaigns}
        programSpending={programSpending}
        userState={userState}
      />
    </OrganizationLayoutWrapper>
  );
}
