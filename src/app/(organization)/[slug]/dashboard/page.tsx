import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AccountTree } from '@/components/accounts/AccountTree';
import { RecordTransactionButton } from '@/components/transactions/RecordTransactionButton';

interface DashboardPageProps {
  params: { slug: string };
}

export default async function OrganizationDashboard({
  params,
}: DashboardPageProps) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/login');
  }

  // First, find the user in our database by their Clerk auth ID
  const user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
  });

  if (!user) {
    redirect('/profile'); // Will create user record
  }

  // Now find the organization and check if user has access
  const organization = await prisma.organization.findUnique({
    where: { slug: params.slug },
    include: {
      organizationUsers: {
        where: { userId: user.id },
      },
    },
  });

  if (!organization) {
    notFound();
  }

  // Check if user has access to this organization
  const userAccess = organization.organizationUsers[0];
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

  return (
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
          <RecordTransactionButton organizationSlug={params.slug} />
        </div>
        
        <div className="space-y-8">
          <AccountTree organizationSlug={params.slug} />
        </div>
      </div>
    </div>
  );
}
