import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { TransactionList } from '@/components/transactions/TransactionList';
import { RecordTransactionButton } from '@/components/transactions/RecordTransactionButton';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { checkOrganizationAccess, VerificationStatusMessage } from '@/lib/organization-access';

interface TransactionsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function TransactionsPage({ params }: TransactionsPageProps) {
  const { slug } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/login');
  }

  const { organization, userAccess, user } = await checkOrganizationAccess(slug, clerkUserId, false);

  if (!userAccess || (userAccess.role !== 'ORG_ADMIN' && !user.isPlatformAdmin)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">
            You don&apos;t have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  const verificationMessage = VerificationStatusMessage({
    status: organization.verificationStatus,
    organizationName: organization.name,
    notes: organization.verificationNotes,
  });

  if (verificationMessage) {
    return verificationMessage;
  }

  return (
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Transactions
              </h1>
              <p className="mt-2 text-gray-600">
                View, search, and export your organization&apos;s transaction history.
              </p>
            </div>
            <RecordTransactionButton organizationSlug={slug} />
          </div>

          <TransactionList organizationSlug={slug} />
        </div>
      </div>
    </OrganizationLayoutWrapper>
  );
}
