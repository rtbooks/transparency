import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildCurrentVersionWhere } from '@/lib/temporal/temporal-utils';
import { UsersPageClient } from './UsersPageClient';
import { OrganizationLayoutWrapper } from '@/components/navigation/OrganizationLayoutWrapper';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface UsersPageProps {
  params: Promise<{ slug: string }>;
}

export default async function UsersPage({ params }: UsersPageProps) {
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
  const organization = await prisma.organization.findFirst({
    where: buildCurrentVersionWhere({ slug }),
  });

  if (!organization) {
    notFound();
  }

  const userOrgUsers = await prisma.organizationUser.findMany({
    where: buildCurrentVersionWhere({ organizationId: organization.id, userId: user.id }),
  });
  const userAccess = userOrgUsers[0];
  
  // Only ORG_ADMIN and PLATFORM_ADMIN can access user management
  if (!userAccess || userAccess.role === 'SUPPORTER' || userAccess.role === 'PUBLIC') {
    return (
      <OrganizationLayoutWrapper organizationSlug={slug}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-gray-600">
              You don't have permission to manage users in this organization.
            </p>
            <Link href={`/org/${slug}/dashboard`} className="mt-4 inline-block">
              <Button>Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </OrganizationLayoutWrapper>
    );
  }

  // Fetch all organization users with their user data
  const organizationUsers = await prisma.organizationUser.findMany({
    where: buildCurrentVersionWhere({
      organizationId: organization.id,
    }),
    orderBy: {
      joinedAt: 'asc',
    },
  });

  // Fetch user details for org users
  const orgUserUserIds = organizationUsers.map(ou => ou.userId);
  const orgUserUsers = orgUserUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: orgUserUserIds } },
      })
    : [];
  const orgUserUserMap = new Map(orgUserUsers.map(u => [u.id, u]));

  // Fetch pending invitations
  const pendingInvitations = await prisma.invitation.findMany({
    where: {
      organizationId: organization.id,
      status: 'PENDING',
    },
    include: {
      invitedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Serialize the data to convert Decimal to number for client component
  const serializedUsers = organizationUsers.map((orgUser) => ({
    ...orgUser,
    user: {
      ...(orgUserUserMap.get(orgUser.userId) || {}),
      totalDonated: Number(orgUserUserMap.get(orgUser.userId)?.totalDonated || 0),
    },
  }));

  // Serialize invitations
  const serializedInvitations = pendingInvitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    token: inv.token,
    status: inv.status,
    invitedBy: inv.invitedBy,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
  }));

  const canManageUsers = userAccess.role === 'ORG_ADMIN' || userAccess.role === 'PLATFORM_ADMIN';

  return (
    <OrganizationLayoutWrapper organizationSlug={slug}>
      <UsersPageClient
        slug={slug}
        organizationName={organization.name}
        users={serializedUsers}
        organizationId={organization.id}
        canManageUsers={canManageUsers}
        currentUserRole={userAccess.role}
        pendingInvitations={serializedInvitations}
      />
    </OrganizationLayoutWrapper>
  );
}
