import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AccountTree } from '@/components/accounts/AccountTree';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';

interface AccountsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AccountsPage({ params }: AccountsPageProps) {
  const { slug } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
  });

  if (!user) {
    redirect('/profile');
  }

  const organization = await prisma.organization.findUnique({
    where: { slug },
    include: {
      organizationUsers: {
        where: { userId: user.id },
      },
    },
  });

  if (!organization) {
    notFound();
  }

  const userAccess = organization.organizationUsers[0];
  if (!userAccess || (userAccess.role !== 'ORG_ADMIN' && userAccess.role !== 'PLATFORM_ADMIN')) {
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

  return (
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Chart of Accounts
            </h1>
            <p className="mt-2 text-gray-600">
              Manage your organization&apos;s chart of accounts.
            </p>
          </div>

          <AccountTree organizationSlug={slug} />
        </div>
      </div>
    </OrganizationLayoutWrapper>
  );
}
