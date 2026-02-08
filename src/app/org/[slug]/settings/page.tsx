import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { OrganizationSettingsForm } from '@/components/forms/OrganizationSettingsForm';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';

interface OrganizationSettingsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrganizationSettingsPage({
  params,
}: OrganizationSettingsPageProps) {
  const { slug } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect('/login');
  }

  // Find the user in our database
  const user = await prisma.user.findUnique({
    where: { authId: clerkUserId },
  });

  if (!user) {
    redirect('/profile');
  }

  // Find organization and check if user has access
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
  
  // Only ORG_ADMIN can access settings
  if (!userAccess || userAccess.role !== 'ORG_ADMIN') {
    return (
      <OrganizationLayoutWrapper organizationSlug={slug}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-gray-600">
              Only organization administrators can access settings.
            </p>
          </div>
        </div>
      </OrganizationLayoutWrapper>
    );
  }

  return (
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Organization Settings
            </h1>
            <p className="mt-2 text-gray-600">
              Manage {organization.name}'s configuration and details
            </p>
          </div>

          <div className="space-y-6">
            <OrganizationSettingsForm organization={organization} />
          </div>
        </div>
      </div>
    </OrganizationLayoutWrapper>
  );
}
