import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { DashboardSummary } from '@/components/dashboard/DashboardSummary';
import { RecordTransactionButton } from '@/components/transactions/RecordTransactionButton';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import { checkOrganizationAccess, VerificationStatusMessage } from '@/lib/organization-access';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface DashboardPageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrganizationDashboard({
  params,
}: DashboardPageProps) {
  const { slug } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/login');
  }

  const { organization, userAccess, user } = await checkOrganizationAccess(slug, clerkUserId, false);

  // Check if user has access to this organization
  if (!userAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-gray-600">
            You don't have permission to access this organization's dashboard.
          </p>
        </div>
      </div>
    );
  }

  // Show verification status messages for non-verified organizations
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
              {organization.name} Dashboard
            </h1>
            <p className="mt-2 text-gray-600">
              Role: {userAccess.role}
            </p>
          </div>
          <div className="flex gap-2">
            {userAccess.role === 'ORG_ADMIN' && (
              <>
                <Link href={`/org/${slug}/settings`}>
                  <Button variant="outline">Settings</Button>
                </Link>
                <Link href={`/org/${slug}/users`}>
                  <Button variant="outline">Manage Users</Button>
                </Link>
              </>
            )}
            <RecordTransactionButton organizationSlug={slug} />
          </div>
        </div>
        
        <DashboardSummary organizationSlug={slug} />
      </div>
      </div>
    </OrganizationLayoutWrapper>
  );
}
