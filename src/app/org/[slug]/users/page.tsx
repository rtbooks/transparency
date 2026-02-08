import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { UserList } from '@/components/users/UserList';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

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
  
  // Only ORG_ADMIN and PLATFORM_ADMIN can access user management
  if (!userAccess || userAccess.role === 'DONOR' || userAccess.role === 'PUBLIC') {
    return (
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
    );
  }

  // Fetch all organization users with their user data
  const organizationUsers = await prisma.organizationUser.findMany({
    where: {
      organizationId: organization.id,
    },
    include: {
      user: true,
    },
    orderBy: {
      joinedAt: 'asc',
    },
  });

  // Serialize the data to convert Decimal to number for client component
  const serializedUsers = organizationUsers.map((orgUser) => ({
    ...orgUser,
    user: {
      ...orgUser.user,
      totalDonated: Number(orgUser.user.totalDonated),
    },
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href={`/org/${slug}/dashboard`}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <UserList
            organizationId={organization.id}
            organizationSlug={slug}
            users={serializedUsers}
            currentUserRole={userAccess.role}
          />
        </div>
      </div>
    </div>
  );
}
