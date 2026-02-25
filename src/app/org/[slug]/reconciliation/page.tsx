import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { redirect } from 'next/navigation';
import { ReconciliationPageClient } from '@/components/reconciliation/ReconciliationPageClient';

export default async function ReconciliationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) redirect('/login');

  const user = await prisma.user.findUnique({ where: { authId: clerkUserId } });
  if (!user) redirect('/login');

  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
  });
  if (!organization) redirect('/');

  // Check user has admin access
  const orgUser = await prisma.organizationUser.findFirst({
    where: buildCurrentVersionWhere({
      organizationId: organization.id,
      userId: user.id,
    }),
  });

  if (!orgUser || (orgUser.role !== 'ORG_ADMIN' && orgUser.role !== 'PLATFORM_ADMIN')) {
    redirect(`/org/${slug}/dashboard`);
  }

  // Get bank accounts with linked account names
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { organizationId: organization.id, isActive: true },
    orderBy: { bankName: 'asc' },
  });

  // Resolve account names
  const accountIds = bankAccounts.map((ba) => ba.accountId);
  const accounts = await prisma.account.findMany({
    where: buildCurrentVersionWhere({ id: { in: accountIds } }),
    select: { id: true, name: true, code: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const bankAccountsWithNames = bankAccounts.map((ba) => ({
    id: ba.id,
    bankName: ba.bankName,
    accountNumberLast4: ba.accountNumberLast4,
    accountType: ba.accountType,
    accountName: accountMap.get(ba.accountId)?.name || 'Unknown',
    accountCode: accountMap.get(ba.accountId)?.code || '',
  }));

  return (
    <ReconciliationPageClient
      slug={slug}
      bankAccounts={bankAccountsWithNames}
    />
  );
}
