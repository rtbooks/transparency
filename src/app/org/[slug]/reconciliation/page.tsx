import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { redirect } from 'next/navigation';
import { ReconciliationPageClient } from '@/components/reconciliation/ReconciliationPageClient';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { checkOrganizationAccess, VerificationStatusMessage } from '@/lib/organization-access';

export default async function ReconciliationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) redirect('/login');

  const { organization, userAccess } = await checkOrganizationAccess(slug, clerkUserId, false);

  if (!userAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">You don&apos;t have permission to view this page.</p>
        </div>
      </div>
    );
  }

  if (userAccess.role !== 'ORG_ADMIN' && userAccess.role !== 'PLATFORM_ADMIN') {
    redirect(`/org/${slug}/dashboard`);
  }

  const verificationMessage = VerificationStatusMessage({
    status: organization.verificationStatus,
    organizationName: organization.name,
    notes: organization.verificationNotes,
  });

  if (verificationMessage) {
    return verificationMessage;
  }

  // Get bank accounts with linked account names
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { organizationId: organization.id, isActive: true },
    orderBy: { bankName: 'asc' },
  });

  // Resolve account names
  const accountIds = bankAccounts.map((ba) => ba.accountId);
  const accounts = accountIds.length > 0
    ? await prisma.account.findMany({
        where: buildCurrentVersionWhere({ id: { in: accountIds } }),
        select: { id: true, name: true, code: true },
      })
    : [];
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
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <ReconciliationPageClient
            slug={slug}
            bankAccounts={bankAccountsWithNames}
          />
        </div>
      </div>
    </OrganizationLayoutWrapper>
  );
}
